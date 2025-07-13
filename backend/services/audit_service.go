package services

import (
	"bastion/config"
	"bastion/models"
	"bastion/utils"
	"encoding/json"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// AuditService 审计服务
type AuditService struct {
	db *gorm.DB
}

// NewAuditService 创建审计服务实例
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{
		db: db,
	}
}

// ======================== 登录日志相关 ========================

// RecordLoginLog 记录登录日志
func (a *AuditService) RecordLoginLog(userID uint, username, ip, userAgent, method, status, message string) error {
	if !config.GlobalConfig.Audit.EnableOperationLog {
		return nil
	}

	loginLog := &models.LoginLog{
		UserID:    userID,
		Username:  username,
		IP:        ip,
		UserAgent: userAgent,
		Method:    method,
		Status:    status,
		Message:   message,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.db.Create(loginLog).Error; err != nil {
		logrus.WithError(err).Error("Failed to record login log")
		return err
	}

	return nil
}

// GetLoginLogs 获取登录日志列表
func (a *AuditService) GetLoginLogs(req *models.LoginLogListRequest) ([]*models.LoginLogResponse, int64, error) {
	var logs []models.LoginLog
	var total int64

	// 构建查询条件
	query := a.db.Model(&models.LoginLog{})

	// 添加过滤条件
	if req.Username != "" {
		query = query.Where("username LIKE ?", "%"+req.Username+"%")
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.IP != "" {
		query = query.Where("ip = ?", req.IP)
	}
	if req.StartTime != "" {
		if startTime, err := time.Parse("2006-01-02", req.StartTime); err == nil {
			query = query.Where("created_at >= ?", startTime)
		}
	}
	if req.EndTime != "" {
		if endTime, err := time.Parse("2006-01-02", req.EndTime); err == nil {
			query = query.Where("created_at <= ?", endTime.Add(24*time.Hour))
		}
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 设置分页
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	var responses []*models.LoginLogResponse
	for _, log := range logs {
		responses = append(responses, log.ToResponse())
	}

	return responses, total, nil
}

// ======================== 操作日志相关 ========================

// RecordOperationLog 记录操作日志
func (a *AuditService) RecordOperationLog(userID uint, username, ip, method, url, action, resource string, resourceID uint, status int, message string, requestData, responseData interface{}, duration int64) error {
	if !config.GlobalConfig.Audit.EnableOperationLog {
		return nil
	}

	var reqData, respData string
	if requestData != nil {
		if data, err := json.Marshal(requestData); err == nil {
			reqData = string(data)
		}
	}
	if responseData != nil {
		if data, err := json.Marshal(responseData); err == nil {
			respData = string(data)
		}
	}

	operationLog := &models.OperationLog{
		UserID:       userID,
		Username:     username,
		IP:           ip,
		Method:       method,
		URL:          url,
		Action:       action,
		Resource:     resource,
		ResourceID:   resourceID,
		Status:       status,
		Message:      message,
		RequestData:  reqData,
		ResponseData: respData,
		Duration:     duration,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := a.db.Create(operationLog).Error; err != nil {
		logrus.WithError(err).Error("Failed to record operation log")
		return err
	}

	return nil
}

// GetOperationLogs 获取操作日志列表
func (a *AuditService) GetOperationLogs(req *models.OperationLogListRequest) ([]*models.OperationLogResponse, int64, error) {
	var logs []models.OperationLog
	var total int64

	// 构建查询条件
	query := a.db.Model(&models.OperationLog{})

	// 添加过滤条件
	if req.Username != "" {
		query = query.Where("username LIKE ?", "%"+req.Username+"%")
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	if req.Resource != "" {
		query = query.Where("resource = ?", req.Resource)
	}
	if req.Status != nil {
		query = query.Where("status = ?", *req.Status)
	}
	if req.IP != "" {
		query = query.Where("ip = ?", req.IP)
	}
	if req.StartTime != "" {
		if startTime, err := time.Parse("2006-01-02", req.StartTime); err == nil {
			query = query.Where("created_at >= ?", startTime)
		}
	}
	if req.EndTime != "" {
		if endTime, err := time.Parse("2006-01-02", req.EndTime); err == nil {
			query = query.Where("created_at <= ?", endTime.Add(24*time.Hour))
		}
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 设置分页
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	var responses []*models.OperationLogResponse
	for _, log := range logs {
		responses = append(responses, log.ToResponse())
	}

	return responses, total, nil
}

// ======================== 会话记录相关 ========================

// RecordSessionStart 记录会话开始
func (a *AuditService) RecordSessionStart(sessionID string, userID uint, username string, assetID uint, assetName, assetAddress string, credentialID uint, protocol, ip string) error {
	if !config.GlobalConfig.Audit.EnableSessionRecord {
		return nil
	}

	sessionRecord := &models.SessionRecord{
		SessionID:    sessionID,
		UserID:       userID,
		Username:     username,
		AssetID:      assetID,
		AssetName:    assetName,
		AssetAddress: assetAddress,
		CredentialID: credentialID,
		Protocol:     protocol,
		IP:           ip,
		Status:       "active",
		StartTime:    time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := a.db.Create(sessionRecord).Error; err != nil {
		logrus.WithError(err).Error("Failed to record session start")
		return err
	}

	return nil
}

// RecordSessionEnd 记录会话结束
func (a *AuditService) RecordSessionEnd(sessionID string, status string) error {
	if !config.GlobalConfig.Audit.EnableSessionRecord {
		return nil
	}

	endTime := time.Now()
	updates := map[string]interface{}{
		"status":     status,
		"end_time":   endTime,
		"updated_at": endTime,
	}

	if err := a.db.Model(&models.SessionRecord{}).Where("session_id = ?", sessionID).Updates(updates).Error; err != nil {
		logrus.WithError(err).Error("Failed to record session end")
		return err
	}

	// 计算并更新会话持续时间
	var sessionRecord models.SessionRecord
	if err := a.db.Where("session_id = ?", sessionID).First(&sessionRecord).Error; err == nil {
		duration := endTime.Sub(sessionRecord.StartTime).Seconds()
		a.db.Model(&models.SessionRecord{}).Where("session_id = ?", sessionID).Update("duration", int64(duration))
	}

	return nil
}

// GetSessionRecords 获取会话记录列表
func (a *AuditService) GetSessionRecords(req *models.SessionRecordListRequest) ([]*models.SessionRecordResponse, int64, error) {
	var records []models.SessionRecord
	var total int64

	// 构建查询条件
	query := a.db.Model(&models.SessionRecord{})

	// 添加过滤条件
	if req.Username != "" {
		query = query.Where("username LIKE ?", "%"+req.Username+"%")
	}
	if req.AssetName != "" {
		query = query.Where("asset_name LIKE ?", "%"+req.AssetName+"%")
	}
	if req.Protocol != "" {
		query = query.Where("protocol = ?", req.Protocol)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.IP != "" {
		query = query.Where("ip = ?", req.IP)
	}
	if req.StartTime != "" {
		if startTime, err := time.Parse("2006-01-02", req.StartTime); err == nil {
			query = query.Where("start_time >= ?", startTime)
		}
	}
	if req.EndTime != "" {
		if endTime, err := time.Parse("2006-01-02", req.EndTime); err == nil {
			query = query.Where("start_time <= ?", endTime.Add(24*time.Hour))
		}
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 设置分页
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("start_time DESC").Find(&records).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	var responses []*models.SessionRecordResponse
	for _, record := range records {
		response := record.ToResponse()
		// 如果会话还在进行中，计算当前持续时间
		if record.Status == "active" {
			response.Duration = record.CalculateDuration()
		}
		responses = append(responses, response)
	}

	return responses, total, nil
}

// ======================== 命令日志相关 ========================

// RecordCommandLog 记录命令日志
func (a *AuditService) RecordCommandLog(sessionID string, userID uint, username string, assetID uint, command, output string, exitCode int, startTime time.Time, endTime *time.Time) error {
	if !config.GlobalConfig.Audit.EnableSessionRecord {
		return nil
	}

	// 计算命令风险等级
	risk := a.calculateCommandRisk(command)

	// 计算执行时间
	var duration int64
	if endTime != nil {
		duration = endTime.Sub(startTime).Milliseconds()
	}

	commandLog := &models.CommandLog{
		SessionID: sessionID,
		UserID:    userID,
		Username:  username,
		AssetID:   assetID,
		Command:   command,
		Output:    output,
		ExitCode:  exitCode,
		Risk:      risk,
		StartTime: startTime,
		EndTime:   endTime,
		Duration:  duration,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.db.Create(commandLog).Error; err != nil {
		logrus.WithError(err).Error("Failed to record command log")
		return err
	}

	return nil
}

// GetCommandLogs 获取命令日志列表
func (a *AuditService) GetCommandLogs(req *models.CommandLogListRequest) ([]*models.CommandLogResponse, int64, error) {
	var logs []models.CommandLog
	var total int64

	// 构建查询条件
	query := a.db.Model(&models.CommandLog{})

	// 添加过滤条件
	if req.SessionID != "" {
		query = query.Where("session_id = ?", req.SessionID)
	}
	if req.Username != "" {
		query = query.Where("username LIKE ?", "%"+req.Username+"%")
	}
	if req.AssetID > 0 {
		query = query.Where("asset_id = ?", req.AssetID)
	}
	if req.Command != "" {
		query = query.Where("command LIKE ?", "%"+req.Command+"%")
	}
	if req.Risk != "" {
		query = query.Where("risk = ?", req.Risk)
	}
	if req.StartTime != "" {
		if startTime, err := time.Parse("2006-01-02", req.StartTime); err == nil {
			query = query.Where("start_time >= ?", startTime)
		}
	}
	if req.EndTime != "" {
		if endTime, err := time.Parse("2006-01-02", req.EndTime); err == nil {
			query = query.Where("start_time <= ?", endTime.Add(24*time.Hour))
		}
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 设置分页
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("start_time DESC").Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	var responses []*models.CommandLogResponse
	for _, log := range logs {
		responses = append(responses, log.ToResponse())
	}

	return responses, total, nil
}

// ======================== 审计统计相关 ========================

// GetAuditStatistics 获取审计统计数据
func (a *AuditService) GetAuditStatistics() (*models.AuditStatistics, error) {
	stats := &models.AuditStatistics{}

	// 获取今天的开始时间
	today := time.Now().Truncate(24 * time.Hour)

	// 统计登录日志
	a.db.Model(&models.LoginLog{}).Count(&stats.TotalLoginLogs)
	a.db.Model(&models.LoginLog{}).Where("created_at >= ?", today).Count(&stats.TodayLogins)
	a.db.Model(&models.LoginLog{}).Where("status = ?", "failed").Count(&stats.FailedLogins)

	// 统计操作日志
	a.db.Model(&models.OperationLog{}).Count(&stats.TotalOperationLogs)
	a.db.Model(&models.OperationLog{}).Where("created_at >= ?", today).Count(&stats.TodayOperations)

	// 统计会话记录
	a.db.Model(&models.SessionRecord{}).Count(&stats.TotalSessionRecords)
	a.db.Model(&models.SessionRecord{}).Where("start_time >= ?", today).Count(&stats.TodaySessions)
	a.db.Model(&models.SessionRecord{}).Where("status = ?", "active").Count(&stats.ActiveSessions)

	// 统计命令日志
	a.db.Model(&models.CommandLog{}).Count(&stats.TotalCommandLogs)
	a.db.Model(&models.CommandLog{}).Where("risk = ?", "high").Count(&stats.DangerousCommands)

	return stats, nil
}

// ======================== 辅助方法 ========================

// calculateCommandRisk 计算命令风险等级
func (a *AuditService) calculateCommandRisk(command string) string {
	command = strings.ToLower(strings.TrimSpace(command))

	// 检查是否为危险命令
	for _, dangerousCmd := range config.GlobalConfig.Audit.DangerousCommands {
		if strings.Contains(command, strings.ToLower(dangerousCmd)) {
			return "high"
		}
	}

	// 检查中等风险命令
	mediumRiskCommands := []string{
		"sudo", "su", "chmod", "chown", "crontab", "systemctl", "service",
		"iptables", "ufw", "firewall", "mount", "umount", "fdisk", "parted",
		"kill", "killall", "pkill", "ps", "top", "htop", "netstat", "ss",
	}

	for _, mediumCmd := range mediumRiskCommands {
		if strings.HasPrefix(command, mediumCmd+" ") || command == mediumCmd {
			return "medium"
		}
	}

	return "low"
}

// LogMiddleware 创建操作日志中间件
func (a *AuditService) LogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// 获取请求数据
		var requestData interface{}
		if c.Request.Method != "GET" && c.Request.ContentLength > 0 {
			if body, err := c.GetRawData(); err == nil {
				json.Unmarshal(body, &requestData)
				// 重新设置请求体供后续处理
				c.Request.Body = utils.ResetRequestBody(c.Request, body)
			}
		}

		// 处理请求
		c.Next()

		// 记录操作日志
		duration := time.Since(start).Milliseconds()

		// 获取用户信息
		var userID uint
		var username string
		if user, exists := c.Get("user"); exists {
			if u, ok := user.(*models.User); ok {
				userID = u.ID
				username = u.Username
			}
		}

		// 获取客户端IP
		ip := c.ClientIP()

		// 解析操作类型和资源
		action, resource := a.parseActionAndResource(c.Request.Method, c.Request.URL.Path)

		// 获取响应数据
		var responseData interface{}
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			// 成功响应不记录响应体，避免日志过大
			responseData = map[string]interface{}{
				"status": "success",
				"code":   c.Writer.Status(),
			}
		} else {
			responseData = map[string]interface{}{
				"status": "error",
				"code":   c.Writer.Status(),
			}
		}

		// 记录日志
		go a.RecordOperationLog(
			userID,
			username,
			ip,
			c.Request.Method,
			c.Request.URL.Path,
			action,
			resource,
			0, // ResourceID 需要从路径中解析
			c.Writer.Status(),
			"",
			requestData,
			responseData,
			duration,
		)
	}
}

// parseActionAndResource 解析操作类型和资源
func (a *AuditService) parseActionAndResource(method, path string) (string, string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 2 {
		return "unknown", "unknown"
	}

	resource := parts[1] // 第二部分通常是资源名称

	switch method {
	case "GET":
		return "read", resource
	case "POST":
		return "create", resource
	case "PUT":
		return "update", resource
	case "DELETE":
		return "delete", resource
	default:
		return "unknown", resource
	}
}

// CleanupAuditLogs 清理过期的审计日志
func (a *AuditService) CleanupAuditLogs() error {
	retentionDays := config.GlobalConfig.Audit.RetentionDays
	if retentionDays <= 0 {
		return nil
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)

	// 清理登录日志
	if err := a.db.Where("created_at < ?", cutoff).Delete(&models.LoginLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup login logs")
	}

	// 清理操作日志
	if err := a.db.Where("created_at < ?", cutoff).Delete(&models.OperationLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup operation logs")
	}

	// 清理会话记录
	if err := a.db.Where("created_at < ?", cutoff).Delete(&models.SessionRecord{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup session records")
	}

	// 清理命令日志
	if err := a.db.Where("created_at < ?", cutoff).Delete(&models.CommandLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup command logs")
	}

	logrus.WithField("cutoff", cutoff).Info("Audit logs cleanup completed")
	return nil
}
