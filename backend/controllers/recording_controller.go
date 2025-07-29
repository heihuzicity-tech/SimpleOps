package controllers

import (
	"archive/zip"
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// RecordingController 录屏审计控制器
type RecordingController struct {
	recordingService *services.RecordingService
	batchTasks      sync.Map // 批量任务状态存储
	tempDir         string   // 临时文件目录
}

// NewRecordingController 创建录屏审计控制器实例
func NewRecordingController() *RecordingController {
	tempDir := "/tmp/bastion/batch_downloads"
	os.MkdirAll(tempDir, 0755)
	
	return &RecordingController{
		recordingService: services.GlobalRecordingService,
		batchTasks:      sync.Map{},
		tempDir:         tempDir,
	}
}

// GetRecordingList 获取录制列表
// @Summary 获取录制列表
// @Description 获取会话录制列表，支持分页和过滤
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页大小" default(10)
// @Param session_id query string false "会话ID"
// @Param user_id query int false "用户ID"
// @Param asset_id query int false "资产ID"
// @Param status query string false "状态" Enums(recording,completed,failed)
// @Param format query string false "格式" Enums(asciicast,json,mp4)
// @Param start_time query string false "开始时间"
// @Param end_time query string false "结束时间"
// @Success 200 {object} utils.Response{data=utils.PageResult{items=[]models.SessionRecordingResponse}}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 500 {object} utils.Response
// @Security BearerAuth
// @Router /recording/list [get]
func (rc *RecordingController) GetRecordingList(c *gin.Context) {
	var request models.SessionRecordingListRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		utils.RespondWithValidationError(c, "参数验证失败: "+err.Error())
		return
	}

	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	// 检查录屏审计权限
	if !currentUser.HasPermission("recording:view") {
		utils.RespondWithForbidden(c, "没有录屏查看权限")
		return
	}

	// 设置默认值
	if request.Page <= 0 {
		request.Page = 1
	}
	if request.PageSize <= 0 {
		request.PageSize = 10
	}

	db := utils.GetDB()
	
	// 构建查询
	query := db.Model(&models.SessionRecording{}).
		Preload("User").
		Preload("Asset")

	// 应用过滤条件
	if request.SessionID != "" {
		query = query.Where("session_id LIKE ?", "%"+request.SessionID+"%")
	}
	if request.UserName != "" {
		query = query.Joins("LEFT JOIN users ON users.id = session_recordings.user_id").
			Where("users.username LIKE ?", "%"+request.UserName+"%")
	}
	if request.AssetName != "" {
		query = query.Joins("LEFT JOIN assets ON assets.id = session_recordings.asset_id").
			Where("assets.name LIKE ?", "%"+request.AssetName+"%")
	}
	if request.UserID > 0 {
		query = query.Where("user_id = ?", request.UserID)
	}
	if request.AssetID > 0 {
		query = query.Where("asset_id = ?", request.AssetID)
	}
	if request.Status != "" {
		query = query.Where("status = ?", request.Status)
	}
	if request.Format != "" {
		query = query.Where("format = ?", request.Format)
	}
	if request.StartTime != "" {
		query = query.Where("start_time >= ?", request.StartTime)
	}
	if request.EndTime != "" {
		query = query.Where("start_time <= ?", request.EndTime)
	}

	// 统计总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		logrus.WithError(err).Error("统计录制记录总数失败")
		utils.RespondWithError(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 分页查询
	var recordings []models.SessionRecording
	offset := (request.Page - 1) * request.PageSize
	if err := query.Order("created_at DESC").
		Offset(offset).
		Limit(request.PageSize).
		Find(&recordings).Error; err != nil {
		logrus.WithError(err).Error("查询录制记录失败")
		utils.RespondWithError(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 转换为响应格式
	items := make([]models.SessionRecordingResponse, len(recordings))
	for i, recording := range recordings {
		items[i] = *recording.ToResponse()
	}

	utils.RespondWithPagination(c, items, request.Page, request.PageSize, total)
}

// GetRecordingDetail 获取录制详情
// @Summary 获取录制详情
// @Description 获取指定录制的详细信息
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param id path int true "录制ID"
// @Success 200 {object} utils.Response{data=models.SessionRecordingResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Security BearerAuth
// @Router /recording/{id} [get]
func (rc *RecordingController) GetRecordingDetail(c *gin.Context) {
	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	if !currentUser.HasPermission("recording:view") {
		utils.RespondWithForbidden(c, "没有录屏查看权限")
		return
	}

	// 获取录制ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "无效的录制ID")
		return
	}

	db := utils.GetDB()
	var recording models.SessionRecording
	if err := db.Preload("User").
		Preload("Asset").
		Where("id = ?", id).
		First(&recording).Error; err != nil {
		utils.RespondWithNotFound(c, "录制记录不存在")
		return
	}

	utils.RespondWithData(c, recording.ToResponse())
}

// DownloadRecording 下载录制文件
// @Summary 下载录制文件
// @Description 下载指定的录制文件
// @Tags 录屏审计
// @Accept json
// @Produce application/octet-stream
// @Param id path int true "录制ID"
// @Success 200 {file} file
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Security BearerAuth
// @Router /recording/{id}/download [get]
func (rc *RecordingController) DownloadRecording(c *gin.Context) {
	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	if !currentUser.HasPermission("recording:download") {
		utils.RespondWithForbidden(c, "没有录屏下载权限")
		return
	}

	// 获取录制ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的录制ID")
		return
	}

	db := utils.GetDB()
	var recording models.SessionRecording
	if err := db.Where("id = ?", id).First(&recording).Error; err != nil {
		utils.RespondWithNotFound(c, "录制记录")
		return
	}

	// 检查文件是否存在
	if recording.FilePath == "" {
		utils.RespondWithError(c, http.StatusNotFound, "录制文件路径为空")
		return
	}

	if !fileExists(recording.FilePath) {
		logrus.WithFields(logrus.Fields{
			"recording_id": id,
			"file_path":    recording.FilePath,
		}).Error("录制文件不存在")
		utils.RespondWithError(c, http.StatusNotFound, "录制文件不存在")
		return
	}

	// 检查是否为播放器请求（通过查询参数或Accept头）
	isPlayerRequest := c.Query("format") == "json" || 
		c.GetHeader("Accept") == "application/json" ||
		c.GetHeader("X-Player-Request") == "true"

	// 记录下载审计日志
	utils.LogAudit(currentUser.ID, "下载录制文件", 
		fmt.Sprintf("下载录制文件，会话ID: %s, 录制ID: %d, 播放器请求: %t", recording.SessionID, recording.ID, isPlayerRequest))

	if isPlayerRequest {
		// 播放器请求：返回原始JSON数据
		data, err := readRecordingFile(recording.FilePath)
		if err != nil {
			logrus.WithError(err).Error("读取录制文件失败")
			utils.RespondWithInternalError(c, "读取录制文件失败")
			return
		}

		c.Header("Content-Type", "application/json")
		c.Data(http.StatusOK, "application/json", data)
	} else {
		// 普通下载：返回原始压缩文件
		fileName := filepath.Base(recording.FilePath)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Content-Description", "File Transfer")
		c.File(recording.FilePath)
	}
}

// DeleteRecording 删除录制
// @Summary 删除录制
// @Description 删除指定的录制记录和文件
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param id path int true "录制ID"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Security BearerAuth
// @Router /recording/{id} [delete]
func (rc *RecordingController) DeleteRecording(c *gin.Context) {
	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	if !currentUser.HasPermission("recording:delete") {
		utils.RespondWithForbidden(c, "没有录屏删除权限")
		return
	}

	// 获取录制ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的录制ID")
		return
	}

	db := utils.GetDB()
	var recording models.SessionRecording
	if err := db.Where("id = ?", id).First(&recording).Error; err != nil {
		utils.RespondWithNotFound(c, "录制记录")
		return
	}

	// 删除文件
	if recording.FilePath != "" {
		if err := os.Remove(recording.FilePath); err != nil && !os.IsNotExist(err) {
			logrus.WithError(err).WithField("file_path", recording.FilePath).Warn("删除录制文件失败")
			utils.RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("删除录制文件失败: %v", err))
			return
		}
	}

	// 删除数据库记录
	if err := db.Delete(&recording).Error; err != nil {
		logrus.WithError(err).Error("删除录制数据库记录失败")
		utils.RespondWithError(c, http.StatusInternalServerError, "删除录制记录失败")
		return
	}

	// 记录审计日志
	utils.LogAudit(currentUser.ID, "删除录制", 
		fmt.Sprintf("删除录制文件，会话ID: %s, 录制ID: %d", recording.SessionID, recording.ID))

	utils.RespondWithSuccess(c, "录制删除成功")
}

// GetActiveRecordings 获取活跃录制
// @Summary 获取活跃录制
// @Description 获取当前正在录制的会话列表
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Success 200 {object} utils.Response{data=map[string]interface{}}
// @Failure 401 {object} utils.Response
// @Security BearerAuth
// @Router /recording/active [get]
func (rc *RecordingController) GetActiveRecordings(c *gin.Context) {
	utils.RespondWithData(c, gin.H{
		"active_recordings": gin.H{},
		"total_count":       0,
	})
}

// BatchDeleteRecording 批量删除录制
// @Summary 批量删除录制
// @Description 批量删除指定的录制记录和文件
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param request body models.BatchOperationRequest true "批量操作请求"
// @Success 202 {object} utils.Response{data=models.BatchOperationResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Security BearerAuth
// @Router /recording/batch/delete [post]
func (rc *RecordingController) BatchDeleteRecording(c *gin.Context) {
	var request models.BatchOperationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数验证失败",
			"error":   err.Error(),
		})
		return
	}

	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	// 验证录制记录数量限制
	if len(request.RecordingIDs) == 0 {
		utils.RespondWithValidationError(c, "录制ID列表不能为空")
		return
	}
	if len(request.RecordingIDs) > 50 {
		utils.RespondWithValidationError(c, "单次最多只能批量操作50个录制")
		return
	}

	// 检查每个录制的删除权限
	db := utils.GetDB()
	var recordings []models.SessionRecording
	if err := db.Where("id IN ?", request.RecordingIDs).Find(&recordings).Error; err != nil {
		utils.RespondWithInternalError(c, "查询录制记录失败")
		return
	}

	// 验证权限
	for _, recording := range recordings {
		if !currentUser.HasPermission("recording:delete") {
			utils.RespondWithForbidden(c, fmt.Sprintf("没有删除录制 %d 的权限", recording.ID))
			return
		}
	}

	// 创建批量操作任务
	taskID := utils.GenerateUUID()
	
	// 异步执行批量删除
	go rc.executeBatchDelete(taskID, request.RecordingIDs, currentUser.ID, request.Reason)

	// 记录审计日志
	utils.LogAudit(currentUser.ID, "批量删除录制", 
		fmt.Sprintf("批量删除 %d 个录制，原因: %s", len(request.RecordingIDs), request.Reason))

	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"message": "批量删除任务已创建",
		"data": gin.H{
			"task_id":     taskID,
			"total_count": len(request.RecordingIDs),
			"status":      "pending",
		},
	})
}

// BatchDownloadRecording 批量下载录制
// @Summary 批量下载录制
// @Description 批量下载指定的录制文件（ZIP格式）
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param request body models.BatchOperationRequest true "批量操作请求"
// @Success 202 {object} utils.Response{data=models.BatchOperationResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Security BearerAuth
// @Router /recording/batch/download [post]
func (rc *RecordingController) BatchDownloadRecording(c *gin.Context) {
	var request models.BatchOperationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数验证失败",
			"error":   err.Error(),
		})
		return
	}

	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	// 验证录制记录数量限制
	if len(request.RecordingIDs) == 0 || len(request.RecordingIDs) > 50 {
		utils.RespondWithValidationError(c, "录制数量必须在1-50之间")
		return
	}

	// 检查每个录制的下载权限
	db := utils.GetDB()
	var recordings []models.SessionRecording
	if err := db.Where("id IN ?", request.RecordingIDs).Find(&recordings).Error; err != nil {
		utils.RespondWithInternalError(c, "查询录制记录失败")
		return
	}

	// 验证权限
	for _, recording := range recordings {
		if !currentUser.HasPermission("recording:download") {
			utils.RespondWithForbidden(c, fmt.Sprintf("没有下载录制 %d 的权限", recording.ID))
			return
		}
	}

	// 创建批量下载任务
	taskID := utils.GenerateUUID()
	downloadURL := fmt.Sprintf("/api/v1/recording/download/batch/%s", taskID)
	
	// 异步执行批量下载
	go rc.executeBatchDownload(taskID, request.RecordingIDs, currentUser.ID)

	// 记录审计日志
	utils.LogAudit(currentUser.ID, "批量下载录制", 
		fmt.Sprintf("批量下载 %d 个录制", len(request.RecordingIDs)))

	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"message": "批量下载任务已创建",
		"data": gin.H{
			"task_id":      taskID,
			"total_count":  len(request.RecordingIDs),
			"status":       "pending",
			"download_url": downloadURL,
		},
	})
}

// BatchArchiveRecording 批量归档录制
// @Summary 批量归档录制
// @Description 批量归档指定的录制记录
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param request body models.BatchOperationRequest true "批量操作请求"
// @Success 202 {object} utils.Response{data=models.BatchOperationResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Security BearerAuth
// @Router /recording/batch/archive [post]
func (rc *RecordingController) BatchArchiveRecording(c *gin.Context) {
	var request models.BatchOperationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数验证失败",
			"error":   err.Error(),
		})
		return
	}

	// 验证用户权限
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	// 验证录制记录数量限制
	if len(request.RecordingIDs) == 0 || len(request.RecordingIDs) > 50 {
		utils.RespondWithValidationError(c, "录制数量必须在1-50之间")
		return
	}

	// 创建批量归档任务
	taskID := utils.GenerateUUID()
	
	// 异步执行批量归档
	go rc.executeBatchArchive(taskID, request.RecordingIDs, currentUser.ID, request.Reason)

	// 记录审计日志
	utils.LogAudit(currentUser.ID, "批量归档录制", 
		fmt.Sprintf("批量归档 %d 个录制，原因: %s", len(request.RecordingIDs), request.Reason))

	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"message": "批量归档任务已创建",
		"data": gin.H{
			"task_id":     taskID,
			"total_count": len(request.RecordingIDs),
			"status":      "pending",
		},
	})
}

// GetBatchOperationStatus 获取批量操作状态
// @Summary 获取批量操作状态
// @Description 获取指定批量操作任务的执行状态
// @Tags 录屏审计
// @Accept json
// @Produce json
// @Param task_id path string true "任务ID"
// @Success 200 {object} utils.Response{data=models.BatchOperationResponse}
// @Failure 400 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Security BearerAuth
// @Router /recording/batch/status/{task_id} [get]
func (rc *RecordingController) GetBatchOperationStatus(c *gin.Context) {
	taskID := c.Param("task_id")
	if taskID == "" {
		utils.RespondWithValidationError(c, "任务ID不能为空")
		return
	}

	// 从Redis或内存中获取任务状态
	status := rc.getBatchTaskStatus(taskID)
	if status == nil {
		utils.RespondWithNotFound(c, "任务")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "获取任务状态成功",
		"data":    status,
	})
}

// DownloadBatchFile 下载批量操作生成的文件
// @Summary 下载批量操作生成的文件
// @Description 下载指定任务ID的批量操作生成的ZIP文件
// @Tags 录屏审计
// @Accept json
// @Produce application/octet-stream
// @Param task_id path string true "任务ID"
// @Success 200 {file} file
// @Failure 400 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Security BearerAuth
// @Router /recording/download/batch/{task_id} [get]
func (rc *RecordingController) DownloadBatchFile(c *gin.Context) {
	taskID := c.Param("task_id")
	if taskID == "" {
		utils.RespondWithValidationError(c, "任务ID不能为空")
		return
	}

	// 获取任务状态
	task := rc.getBatchTaskStatus(taskID)
	if task == nil {
		utils.RespondWithNotFound(c, "任务")
		return
	}

	// 检查任务类型和状态
	if task.Operation != "download" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "该任务不是下载任务",
		})
		return
	}

	if task.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("任务状态为: %s，无法下载", task.Status),
		})
		return
	}

	// 构建文件路径
	zipFileName := fmt.Sprintf("recordings_%s_%s.zip", taskID, task.CreatedAt.Format("20060102150405"))
	zipFilePath := filepath.Join(rc.tempDir, zipFileName)

	// 检查文件是否存在
	if !fileExists(zipFilePath) {
		utils.RespondWithError(c, http.StatusNotFound, "下载文件不存在或已过期")
		return
	}

	// 验证用户权限（检查用户是否有下载权限）
	user, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "用户未认证")
		return
	}
	currentUser := user.(*models.User)

	if !currentUser.HasPermission("recording:download") {
		utils.RespondWithForbidden(c, "没有下载权限")
		return
	}

	// 记录下载审计日志
	utils.LogAudit(currentUser.ID, "下载批量录制文件", 
		fmt.Sprintf("下载批量录制文件，任务ID: %s", taskID))

	// 设置响应头
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", zipFileName))
	c.Header("Content-Type", "application/zip")
	
	// 发送文件
	c.File(zipFilePath)
}

// ======================== 批量操作执行方法 ========================

// getBatchTaskStatus 获取批量任务状态
func (rc *RecordingController) getBatchTaskStatus(taskID string) *models.BatchTask {
	if value, exists := rc.batchTasks.Load(taskID); exists {
		if task, ok := value.(*models.BatchTask); ok {
			return task
		}
	}
	return nil
}

// setBatchTaskStatus 设置批量任务状态
func (rc *RecordingController) setBatchTaskStatus(task *models.BatchTask) {
	task.UpdatedAt = time.Now()
	rc.batchTasks.Store(task.ID, task)
}

// executeBatchDelete 执行批量删除
func (rc *RecordingController) executeBatchDelete(taskID string, recordingIDs []uint, userID uint, reason string) {
	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"recording_ids": recordingIDs,
		"user_id":       userID,
	}).Info("开始执行批量删除任务")

	// 创建任务
	task := &models.BatchTask{
		ID:           taskID,
		Operation:    "delete",
		RecordingIDs: recordingIDs,
		UserID:       userID,
		Reason:       reason,
		Status:       "running",
		TotalCount:   len(recordingIDs),
		SuccessCount: 0,
		FailedCount:  0,
		Results:      make([]models.BatchOperationResult, 0),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour), // 24小时后过期
	}
	rc.setBatchTaskStatus(task)

	db := utils.GetDB()

	// 执行删除操作
	for _, recordingID := range recordingIDs {
		result := models.BatchOperationResult{
			RecordingID: recordingID,
			Success:     false,
		}

		// 查询录制记录
		var recording models.SessionRecording
		if err := db.Where("id = ?", recordingID).First(&recording).Error; err != nil {
			result.Error = fmt.Sprintf("查询录制记录失败: %v", err)
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		// 删除文件
		if recording.FilePath != "" {
			if err := os.Remove(recording.FilePath); err != nil && !os.IsNotExist(err) {
				logrus.WithError(err).WithField("file_path", recording.FilePath).Warn("删除录制文件失败")
				result.Error = fmt.Sprintf("删除文件失败: %v", err)
				task.Results = append(task.Results, result)
				task.FailedCount++
				continue
			}
		}

		// 删除数据库记录
		if err := db.Delete(&recording).Error; err != nil {
			result.Error = fmt.Sprintf("删除数据库记录失败: %v", err)
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		// 记录审计日志
		utils.LogAudit(userID, "删除录制", 
			fmt.Sprintf("删除录制 %s (ID: %d)，原因: %s", recording.SessionID, recording.ID, reason))

		result.Success = true
		result.Message = "删除成功"
		task.Results = append(task.Results, result)
		task.SuccessCount++
	}

	// 更新任务状态
	task.Status = "completed"
	rc.setBatchTaskStatus(task)

	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"success_count": task.SuccessCount,
		"failed_count":  task.FailedCount,
	}).Info("批量删除任务完成")
}

// executeBatchDownload 执行批量下载
func (rc *RecordingController) executeBatchDownload(taskID string, recordingIDs []uint, userID uint) {
	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"recording_ids": recordingIDs,
		"user_id":       userID,
	}).Info("开始执行批量下载任务")

	// 创建任务
	task := &models.BatchTask{
		ID:           taskID,
		Operation:    "download",
		RecordingIDs: recordingIDs,
		UserID:       userID,
		Status:       "running",
		TotalCount:   len(recordingIDs),
		SuccessCount: 0,
		FailedCount:  0,
		Results:      make([]models.BatchOperationResult, 0),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}
	rc.setBatchTaskStatus(task)

	// 创建ZIP文件
	zipFileName := fmt.Sprintf("recordings_%s_%s.zip", taskID, time.Now().Format("20060102150405"))
	zipFilePath := filepath.Join(rc.tempDir, zipFileName)
	
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		task.Status = "failed"
		task.ErrorMessage = fmt.Sprintf("创建ZIP文件失败: %v", err)
		rc.setBatchTaskStatus(task)
		return
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	db := utils.GetDB()

	// 添加每个录制文件到ZIP
	for _, recordingID := range recordingIDs {
		result := models.BatchOperationResult{
			RecordingID: recordingID,
			Success:     false,
		}

		// 查询录制记录
		var recording models.SessionRecording
		if err := db.Where("id = ?", recordingID).First(&recording).Error; err != nil {
			result.Error = fmt.Sprintf("查询录制记录失败: %v", err)
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		// 检查文件是否存在
		if recording.FilePath == "" || !fileExists(recording.FilePath) {
			result.Error = "录制文件不存在"
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		// 添加文件到ZIP
		if err := rc.addFileToZip(zipWriter, recording); err != nil {
			result.Error = fmt.Sprintf("添加文件到ZIP失败: %v", err)
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		result.Success = true
		result.Message = "添加到下载包成功"
		task.Results = append(task.Results, result)
		task.SuccessCount++
	}

	// 设置下载URL
	task.DownloadURL = fmt.Sprintf("/api/v1/recording/download/batch/%s", taskID)
	task.Status = "completed"
	rc.setBatchTaskStatus(task)

	// 记录审计日志
	utils.LogAudit(userID, "批量下载录制", 
		fmt.Sprintf("批量下载 %d 个录制文件", task.SuccessCount))

	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"success_count": task.SuccessCount,
		"failed_count":  task.FailedCount,
		"zip_file":      zipFilePath,
	}).Info("批量下载任务完成")
}

// executeBatchArchive 执行批量归档
func (rc *RecordingController) executeBatchArchive(taskID string, recordingIDs []uint, userID uint, reason string) {
	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"recording_ids": recordingIDs,
		"user_id":       userID,
	}).Info("开始执行批量归档任务")

	// 创建任务
	task := &models.BatchTask{
		ID:           taskID,
		Operation:    "archive",
		RecordingIDs: recordingIDs,
		UserID:       userID,
		Reason:       reason,
		Status:       "running",
		TotalCount:   len(recordingIDs),
		SuccessCount: 0,
		FailedCount:  0,
		Results:      make([]models.BatchOperationResult, 0),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}
	rc.setBatchTaskStatus(task)

	db := utils.GetDB()
	archiveDir := "/var/bastion/recordings/archive"
	os.MkdirAll(archiveDir, 0755)

	// 执行归档操作
	for _, recordingID := range recordingIDs {
		result := models.BatchOperationResult{
			RecordingID: recordingID,
			Success:     false,
		}

		// 查询录制记录
		var recording models.SessionRecording
		if err := db.Where("id = ?", recordingID).First(&recording).Error; err != nil {
			result.Error = fmt.Sprintf("查询录制记录失败: %v", err)
			task.Results = append(task.Results, result)
			task.FailedCount++
			continue
		}

		// 移动文件到归档目录
		if recording.FilePath != "" && fileExists(recording.FilePath) {
			archiveFileName := fmt.Sprintf("archived_%d_%s", recording.ID, filepath.Base(recording.FilePath))
			archiveFilePath := filepath.Join(archiveDir, archiveFileName)
			
			if err := os.Rename(recording.FilePath, archiveFilePath); err != nil {
				result.Error = fmt.Sprintf("移动文件到归档目录失败: %v", err)
				task.Results = append(task.Results, result)
				task.FailedCount++
				continue
			}

			// 更新数据库中的文件路径
			recording.FilePath = archiveFilePath
			recording.Status = "archived"
			if err := db.Save(&recording).Error; err != nil {
				result.Error = fmt.Sprintf("更新数据库记录失败: %v", err)
				task.Results = append(task.Results, result)
				task.FailedCount++
				continue
			}
		}

		// 记录审计日志
		utils.LogAudit(userID, "归档录制", 
			fmt.Sprintf("归档录制 %s (ID: %d)，原因: %s", recording.SessionID, recording.ID, reason))

		result.Success = true
		result.Message = "归档成功"
		task.Results = append(task.Results, result)
		task.SuccessCount++
	}

	// 更新任务状态
	task.Status = "completed"
	rc.setBatchTaskStatus(task)

	logrus.WithFields(logrus.Fields{
		"task_id":       taskID,
		"success_count": task.SuccessCount,
		"failed_count":  task.FailedCount,
	}).Info("批量归档任务完成")
}

// addFileToZip 添加文件到ZIP
func (rc *RecordingController) addFileToZip(zipWriter *zip.Writer, recording models.SessionRecording) error {
	// 打开源文件
	sourceFile, err := os.Open(recording.FilePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	// 创建ZIP中的文件名
	zipFileName := fmt.Sprintf("%s_%s", recording.SessionID, filepath.Base(recording.FilePath))
	
	// 在ZIP中创建文件
	zipFile, err := zipWriter.Create(zipFileName)
	if err != nil {
		return err
	}

	// 复制文件内容
	_, err = io.Copy(zipFile, sourceFile)
	return err
}

// fileExists 检查文件是否存在
func fileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

// readRecordingFile 读取录制文件，处理各种格式（纯JSON、gzip、混合格式）
func readRecordingFile(filePath string) ([]byte, error) {
	// 打开文件
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	// 读取文件头来检测格式
	header := make([]byte, 2)
	_, err = file.Read(header)
	if err != nil {
		return nil, fmt.Errorf("读取文件头失败: %w", err)
	}

	// 重置文件指针
	file.Seek(0, 0)

	// 检查是否为gzip格式 (magic bytes: 0x1f, 0x8b)
	if header[0] == 0x1f && header[1] == 0x8b {
		// 纯gzip格式，需要解压
		gzipReader, err := gzip.NewReader(file)
		if err != nil {
			return nil, fmt.Errorf("创建gzip reader失败: %w", err)
		}
		defer gzipReader.Close()

		data, err := io.ReadAll(gzipReader)
		if err != nil {
			return nil, fmt.Errorf("读取解压内容失败: %w", err)
		}
		return data, nil
	} else if header[0] == '{' {
		// 可能是纯JSON或混合格式文件
		return parseHybridRecordingFile(file)
	} else {
		// 普通文件，直接读取
		data, err := io.ReadAll(file)
		if err != nil {
			return nil, fmt.Errorf("读取文件内容失败: %w", err)
		}
		return data, nil
	}
}

// parseHybridRecordingFile 解析混合格式的录制文件（头部JSON + 压缩数据）
func parseHybridRecordingFile(file *os.File) ([]byte, error) {
	var result bytes.Buffer
	
	// 读取整个文件内容
	allData, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	
	// 查找第一行结束位置（换行符）
	newlineIndex := bytes.IndexByte(allData, '\n')
	if newlineIndex == -1 {
		return nil, fmt.Errorf("未找到头部行结束标记")
	}
	
	// 分离头部和数据部分
	headerData := allData[:newlineIndex+1] // 包含换行符
	remainingData := allData[newlineIndex+1:] // 剩余数据
	
	// 写入头部到结果
	result.Write(headerData)
	
	// 检查剩余数据是否是gzip格式
	if len(remainingData) >= 2 && remainingData[0] == 0x1f && remainingData[1] == 0x8b {
		// 剩余数据是gzip格式，需要解压
		gzipReader, err := gzip.NewReader(bytes.NewReader(remainingData))
		if err != nil {
			return nil, fmt.Errorf("创建gzip reader失败: %w", err)
		}
		defer gzipReader.Close()
		
		decompressedData, err := io.ReadAll(gzipReader)
		if err != nil {
			return nil, fmt.Errorf("解压数据失败: %w", err)
		}
		
		result.Write(decompressedData)
	} else {
		// 剩余数据不是gzip格式，直接添加
		result.Write(remainingData)
	}
	
	return result.Bytes(), nil
}