package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AuditController 审计控制器
type AuditController struct {
	auditService *services.AuditService
}

// NewAuditController 创建审计控制器实例
func NewAuditController(auditService *services.AuditService) *AuditController {
	return &AuditController{
		auditService: auditService,
	}
}

// GetLoginLogs 获取登录日志列表
// @Summary      获取登录日志列表
// @Description  获取用户登录日志记录，支持分页和条件过滤
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page       query   int     false  "页码"
// @Param        page_size  query   int     false  "每页数量"
// @Param        username   query   string  false  "用户名"
// @Param        status     query   string  false  "状态"
// @Param        ip         query   string  false  "IP地址"
// @Param        start_time query   string  false  "开始时间"
// @Param        end_time   query   string  false  "结束时间"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/login-logs [get]
func (ac *AuditController) GetLoginLogs(c *gin.Context) {
	var req models.LoginLogListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid request parameters")
		return
	}

	logs, total, err := ac.auditService.GetLoginLogs(&req)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to get login logs")
		return
	}

	utils.RespondWithPagination(c, logs, req.Page, req.PageSize, total)
}

// GetOperationLogs 获取操作日志列表
// @Summary      获取操作日志列表
// @Description  获取用户操作日志记录，支持分页和条件过滤
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page       query   int     false  "页码"
// @Param        page_size  query   int     false  "每页数量"
// @Param        username   query   string  false  "用户名"
// @Param        action     query   string  false  "操作类型"
// @Param        resource   query   string  false  "资源类型"
// @Param        status     query   int     false  "状态码"
// @Param        ip         query   string  false  "IP地址"
// @Param        start_time query   string  false  "开始时间"
// @Param        end_time   query   string  false  "结束时间"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/operation-logs [get]
func (ac *AuditController) GetOperationLogs(c *gin.Context) {
	var req models.OperationLogListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid request parameters")
		return
	}

	logs, total, err := ac.auditService.GetOperationLogs(&req)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to get operation logs")
		return
	}

	utils.RespondWithPagination(c, logs, req.Page, req.PageSize, total)
}

// GetSessionRecords 获取会话记录列表
// @Summary      获取会话记录列表
// @Description  获取用户会话记录，支持分页和条件过滤
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page       query   int     false  "页码"
// @Param        page_size  query   int     false  "每页数量"
// @Param        username   query   string  false  "用户名"
// @Param        asset_name query   string  false  "资产名称"
// @Param        protocol   query   string  false  "协议类型"
// @Param        status     query   string  false  "状态"
// @Param        ip         query   string  false  "IP地址"
// @Param        start_time query   string  false  "开始时间"
// @Param        end_time   query   string  false  "结束时间"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/session-records [get]
func (ac *AuditController) GetSessionRecords(c *gin.Context) {
	var req models.SessionRecordListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid request parameters")
		return
	}

	records, total, err := ac.auditService.GetSessionRecords(&req)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to get session records")
		return
	}

	utils.RespondWithPagination(c, records, req.Page, req.PageSize, total)
}

// GetCommandLogs 获取命令日志列表
// @Summary      获取命令日志列表
// @Description  获取用户命令执行日志，支持分页和条件过滤
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page       query   int     false  "页码"
// @Param        page_size  query   int     false  "每页数量"
// @Param        session_id query   string  false  "会话ID"
// @Param        username   query   string  false  "用户名"
// @Param        asset_id   query   uint    false  "资产ID"
// @Param        command    query   string  false  "命令内容"
// @Param        risk       query   string  false  "风险等级"
// @Param        start_time query   string  false  "开始时间"
// @Param        end_time   query   string  false  "结束时间"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/command-logs [get]
func (ac *AuditController) GetCommandLogs(c *gin.Context) {
	var req models.CommandLogListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid request parameters")
		return
	}

	logs, total, err := ac.auditService.GetCommandLogs(&req)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to get command logs")
		return
	}

	utils.RespondWithPagination(c, logs, req.Page, req.PageSize, total)
}

// GetAuditStatistics 获取审计统计数据
// @Summary      获取审计统计数据
// @Description  获取审计相关的统计数据，包括登录、操作、会话等统计信息
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/statistics [get]
func (ac *AuditController) GetAuditStatistics(c *gin.Context) {
	stats, err := ac.auditService.GetAuditStatistics()
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to get audit statistics")
		return
	}

	utils.RespondWithData(c, stats)
}

// GetSessionRecord 获取单个会话记录详情
// @Summary      获取会话记录详情
// @Description  获取指定会话的详细信息
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      uint  true  "会话记录ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "会话记录不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/session-records/{id} [get]
func (ac *AuditController) GetSessionRecord(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid session record ID")
		return
	}

	var sessionRecord models.SessionRecord
	if err := utils.GetDB().Where("id = ?", id).First(&sessionRecord).Error; err != nil {
		utils.RespondWithNotFound(c, "Session record not found")
		return
	}

	utils.RespondWithData(c, sessionRecord.ToResponse())
}

// GetOperationLog 获取单个操作日志详情
// @Summary      获取操作日志详情
// @Description  获取指定操作日志的详细信息
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      uint  true  "操作日志ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "操作日志不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/operation-logs/{id} [get]
func (ac *AuditController) GetOperationLog(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid operation log ID")
		return
	}

	var operationLog models.OperationLog
	if err := utils.GetDB().Where("id = ?", id).First(&operationLog).Error; err != nil {
		utils.RespondWithNotFound(c, "Operation log not found")
		return
	}

	utils.RespondWithData(c, operationLog.ToResponse())
}

// GetCommandLog 获取单个命令日志详情
// @Summary      获取命令日志详情
// @Description  获取指定命令日志的详细信息
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      uint  true  "命令日志ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "命令日志不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/command-logs/{id} [get]
func (ac *AuditController) GetCommandLog(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid command log ID")
		return
	}

	var commandLog models.CommandLog
	if err := utils.GetDB().Where("id = ?", id).First(&commandLog).Error; err != nil {
		utils.RespondWithNotFound(c, "Command log not found")
		return
	}

	utils.RespondWithData(c, commandLog.ToResponse())
}

// CleanupAuditLogs 清理过期审计日志
// @Summary      清理过期审计日志
// @Description  清理超过保留期限的审计日志
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "清理成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/cleanup [post]
func (ac *AuditController) CleanupAuditLogs(c *gin.Context) {
	// 检查权限（只有管理员可以清理日志）
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}

	user := userInterface.(*models.User)
	if !user.HasRole("admin") {
		utils.RespondWithForbidden(c, "Permission denied")
		return
	}

	if err := ac.auditService.CleanupAuditLogs(); err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to cleanup audit logs")
		return
	}

	utils.RespondWithSuccess(c, "Audit logs cleanup completed")
}

// DeleteSessionRecord 删除会话记录
// @Summary      删除会话记录
// @Description  删除指定的会话记录
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "会话记录不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/session-records/{id} [delete]
func (ac *AuditController) DeleteSessionRecord(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid session ID")
		return
	}

	// 获取当前用户信息（用于审计日志）
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}

	user := userInterface.(*models.User)

	// 执行删除操作
	if err := ac.auditService.DeleteSessionRecord(sessionID, user.Username, c.ClientIP(), "手动删除操作"); err != nil {
		if err.Error() == "session record not found" {
			utils.RespondWithNotFound(c, "请求的资源不存在")
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "删除失败")
		return
	}

	utils.RespondWithSuccess(c, "会话记录删除成功")
}

// BatchDeleteSessionRecords 批量删除会话记录
// @Summary      批量删除会话记录
// @Description  批量删除指定的会话记录
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request  body  object  true  "批量删除请求"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/session-records/batch/delete [post]
func (ac *AuditController) BatchDeleteSessionRecords(c *gin.Context) {
	var req struct {
		SessionIDs []string `json:"session_ids" binding:"required"`
		Reason     string   `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "Invalid request parameters")
		return
	}

	if len(req.SessionIDs) == 0 {
		utils.RespondWithValidationError(c, "Session IDs cannot be empty")
		return
	}

	// 获取当前用户信息（用于审计日志）
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}

	user := userInterface.(*models.User)

	// 执行批量删除操作
	if err := ac.auditService.BatchDeleteSessionRecords(req.SessionIDs, user.Username, c.ClientIP(), req.Reason); err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "批量删除失败")
		return
	}

	utils.RespondWithData(c, gin.H{
		"message": "批量删除成功",
		"deleted_count": len(req.SessionIDs),
	})
}

// DeleteOperationLog 删除操作日志
// @Summary      删除操作日志
// @Description  删除指定的操作日志
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      uint  true  "操作日志ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "操作日志不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/operation-logs/{id} [delete]
func (ac *AuditController) DeleteOperationLog(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid operation log ID")
		return
	}

	// 获取当前用户信息（用于审计日志）
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}

	user := userInterface.(*models.User)

	// 执行删除操作
	if err := ac.auditService.DeleteOperationLog(uint(id), user.Username, c.ClientIP(), "手动删除操作"); err != nil {
		if err.Error() == "operation log not found" {
			utils.RespondWithNotFound(c, "请求的资源不存在")
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "删除失败")
		return
	}

	utils.RespondWithSuccess(c, "操作日志删除成功")
}

// BatchDeleteOperationLogs 批量删除操作日志
// @Summary      批量删除操作日志
// @Description  批量删除指定的操作日志
// @Tags         审计管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request  body  object  true  "批量删除请求"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/operation-logs/batch/delete [post]
func (ac *AuditController) BatchDeleteOperationLogs(c *gin.Context) {
	var req struct {
		IDs    []uint `json:"ids" binding:"required"`
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "Invalid request parameters")
		return
	}

	if len(req.IDs) == 0 {
		utils.RespondWithValidationError(c, "Operation log IDs cannot be empty")
		return
	}

	// 获取当前用户信息（用于审计日志）
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}

	user := userInterface.(*models.User)

	// 执行批量删除操作
	if err := ac.auditService.BatchDeleteOperationLogs(req.IDs, user.Username, c.ClientIP(), req.Reason); err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "批量删除失败")
		return
	}

	utils.RespondWithData(c, gin.H{
		"message": "批量删除成功",
		"deleted_count": len(req.IDs),
	})
}

