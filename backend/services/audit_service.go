package services

import (
	"bastion/config"
	"bastion/models"
	"bastion/utils"
	"encoding/json"
	"fmt"
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

	// 转换为响应格式，确保初始化为空切片而不是nil
	responses := make([]*models.LoginLogResponse, 0, len(logs))
	for _, log := range logs {
		responses = append(responses, log.ToResponse())
	}

	return responses, total, nil
}

// ======================== 操作日志相关 ========================

// RecordOperationLog 记录操作日志
func (a *AuditService) RecordOperationLog(userID uint, username, ip, method, url, action, resource string, resourceID uint, sessionID string, status int, message string, requestData, responseData interface{}, duration int64, isSystemOperation bool) error {
	if !config.GlobalConfig.Audit.EnableOperationLog {
		return nil
	}

	// 跳过审计系统自身的管理操作，避免死循环
	if isSystemOperation {
		return nil
	}

	// 注意：测试连接操作已在shouldLogOperationWithContext中完全屏蔽
	// 这里不再需要单独的去重逻辑，因为test类型操作不会达到这里

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
		SessionID:    sessionID, // 新增：记录完整会话标识符
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

	// 转换为响应格式，确保初始化为空切片而不是nil
	responses := make([]*models.OperationLogResponse, 0, len(logs))
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

	// 检查是否存在活跃的会话记录，避免重复记录
	var existingRecord models.SessionRecord
	err := a.db.Where("session_id = ? AND status = ? AND (is_terminated IS NULL OR is_terminated = ?)", 
		sessionID, "active", false).First(&existingRecord).Error
	
	if err == nil {
		// 存在活跃会话，跳过创建
		logrus.WithField("session_id", sessionID).Warn("Active session record already exists, skipping duplicate creation")
		return nil
	} else if err != gorm.ErrRecordNotFound {
		// 查询错误
		logrus.WithError(err).Error("Failed to check existing session")
		return fmt.Errorf("failed to check existing session: %v", err)
	}

	// 不存在活跃会话，创建新记录（即使存在已终止的记录）
	logrus.WithFields(logrus.Fields{
		"session_id": sessionID,
		"user_id":    userID,
		"asset_id":   assetID,
	}).Info("Creating new session record")

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

	// 转换为响应格式，确保初始化为空切片而不是nil
	responses := make([]*models.SessionRecordResponse, 0, len(records))
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
func (a *AuditService) RecordCommandLog(sessionID string, userID uint, username string, assetID uint, command, output string, exitCode int, action string, startTime time.Time, endTime *time.Time) error {
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
		Action:    action,
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

	// 转换为响应格式，确保初始化为空切片而不是nil
	responses := make([]*models.CommandLogResponse, 0, len(logs))
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

// shouldLogOperation 判断是否需要记录操作日志
func (a *AuditService) shouldLogOperation(method, path string) bool {
	// 跳过健康检查等系统接口
	if strings.Contains(path, "/health") || strings.Contains(path, "/metrics") {
		return false
	}

	// 跳过操作日志删除接口，避免删除操作产生新的审计记录导致死循环
	if strings.Contains(path, "/audit/operation-logs") {
		// 跳过所有操作日志相关的DELETE和批量删除操作
		if method == "DELETE" || 
		   (method == "POST" && strings.Contains(path, "/batch/delete")) {
			logrus.WithFields(logrus.Fields{
				"method": method,
				"path":   path,
			}).Debug("Skipping audit log for operation-logs delete operation")
			return false
		}
	}

	// 只记录修改操作，跳过所有GET请求（浏览操作）
	if method == "GET" {
		return false
	}

	// 记录所有非GET操作（POST、PUT、DELETE、PATCH等）
	return true
}

// shouldLogOperationWithContext 判断是否需要记录操作日志（包含上下文信息）
func (a *AuditService) shouldLogOperationWithContext(method, path, userAgent, referer string) bool {
	// 跳过健康检查等系统接口
	if strings.Contains(path, "/health") || strings.Contains(path, "/metrics") {
		return false
	}

	// 跳过操作日志删除接口，避免删除操作产生新的审计记录导致死循环
	if strings.Contains(path, "/audit/operation-logs") {
		// 跳过所有操作日志相关的DELETE和批量删除操作
		if method == "DELETE" || 
		   (method == "POST" && strings.Contains(path, "/batch/delete")) {
			logrus.WithFields(logrus.Fields{
				"method": method,
				"path":   path,
			}).Debug("Skipping audit log for operation-logs delete operation")
			return false
		}
	}

	// 完全屏蔽测试连接操作的审计记录
	if strings.Contains(path, "/assets/test-connection") && method == "POST" {
		logrus.WithFields(logrus.Fields{
			"method": method,
			"path":   path,
			"referer": referer,
		}).Debug("跳过测试连接操作的审计记录")
		return false // 直接跳过，不记录任何测试连接操作
	}

	// 只记录修改操作，跳过所有GET请求（浏览操作）
	if method == "GET" {
		return false
	}

	// 记录所有非GET操作（POST、PUT、DELETE、PATCH等）
	return true
}

// LogMiddleware 创建操作日志中间件
func (a *AuditService) LogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// 获取请求数据
		var requestData interface{}
		var requestBody []byte
		if c.Request.Method != "GET" && c.Request.ContentLength > 0 {
			if body, err := c.GetRawData(); err == nil {
				requestBody = body
				json.Unmarshal(body, &requestData)
				// 重新设置请求体供后续处理
				c.Request.Body = utils.ResetRequestBody(c.Request, body)
			}
		}

		// 处理请求
		c.Next()

		// 判断是否需要记录操作日志（使用上下文信息）
		userAgent := c.GetHeader("User-Agent")
		referer := c.GetHeader("Referer")
		if !a.shouldLogOperationWithContext(c.Request.Method, c.Request.URL.Path, userAgent, referer) {
			return
		}

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

		// 解析操作类型、资源和资源ID
		action, resource, resourceID := a.parseResourceInfo(c.Request.Method, c.Request.URL.Path, string(requestBody))
		
		// 提取SessionID（主要用于SSH会话）
		sessionID := a.extractSessionIDFromContext(c, resource)

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
			resourceID, // 智能解析的ResourceID
			sessionID,  // 完整会话标识符
			c.Writer.Status(),
			"",
			requestData,
			responseData,
			duration,
			false, // isSystemOperation=false，正常业务操作需要记录审计日志
		)
	}
}

// parseActionAndResource 解析操作类型和资源（保持向后兼容）
func (a *AuditService) parseActionAndResource(method, path string) (string, string) {
	action, resource, _ := a.parseResourceInfo(method, path, "")
	return action, resource
}

// parseResourceInfo 解析操作类型、资源和资源ID
func (a *AuditService) parseResourceInfo(method, path, requestBody string) (string, string, uint) {
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 3 {
		return "unknown", "unknown", 0
	}

	// 对于 /api/v1/assets/ 格式，资源名称在第3个位置（索引2）
	resource := parts[2]
	
	// 处理特殊情况：审计相关的路径
	if len(parts) >= 4 && parts[2] == "audit" {
		// /api/v1/audit/operation-logs -> operation-logs
		resource = parts[3]
	}
	
	// 处理SSH会话特殊情况：ssh/sessions -> session
	if len(parts) >= 4 && parts[2] == "ssh" && parts[3] == "sessions" {
		resource = "session"
	}

	// 简化：ResourceID统一设为0，不进行复杂解析
	resourceID := uint(0)

	// 简化：使用标准HTTP方法映射
	action := a.determineAction(method, path)
	
	return action, resource, resourceID
}

// determineAction 确定操作类型
func (a *AuditService) determineAction(method, path string) string {
	// 特殊路径处理
	if strings.Contains(path, "/delete") || strings.Contains(path, "batch-delete") {
		return "delete"
	}
	if strings.Contains(path, "/archive") {
		return "archive"
	}
	if strings.Contains(path, "test-connection") {
		return "test"
	}
	
	// 标准HTTP方法处理
	switch method {
	case "GET":
		return "read"
	case "POST":
		return "create"
	case "PUT":
		return "update"
	case "DELETE":
		return "delete"
	case "PATCH":
		return "update"
	default:
		return "unknown"
	}
}


// extractSessionIDFromContext 从Gin上下文中提取SessionID
func (a *AuditService) extractSessionIDFromContext(c *gin.Context, resource string) string {
	// 只对session类型的资源提取SessionID
	if resource != "session" {
		return ""
	}
	
	// 尝试从响应中提取SessionID (针对SSH会话创建)
	if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
		// 这里需要从响应体中解析SessionID，但由于响应已经写入，
		// 我们采用延迟更新的方式，先返回空，后续通过UpdateOperationLogSessionID更新
		return ""
	}
	
	// 从请求参数或路径中提取SessionID（针对会话操作）
	if sessionID := c.Param("sessionId"); sessionID != "" {
		return sessionID
	}
	if sessionID := c.Query("sessionId"); sessionID != "" {
		return sessionID
	}
	
	return ""
}

// UpdateOperationLogSessionID 更新操作日志的SessionID
func (a *AuditService) UpdateOperationLogSessionID(userID uint, path, sessionID string, timestamp time.Time) error {
	if sessionID == "" {
		return fmt.Errorf("sessionID cannot be empty")
	}

	// 更新最近创建的相关操作日志记录
	// 查找最近1分钟内的相关记录并更新SessionID（不更新ResourceID）
	result := a.db.Model(&models.OperationLog{}).
		Where("user_id = ? AND url = ? AND (session_id = '' OR session_id IS NULL) AND created_at >= ?", 
			userID, path, timestamp.Add(-1*time.Minute)).
		Update("session_id", sessionID)

	if result.Error != nil {
		logrus.WithError(result.Error).
			WithField("sessionID", sessionID).
			Error("Failed to update operation log session ID")
		return result.Error
	}

	if result.RowsAffected > 0 {
		logrus.WithField("sessionID", sessionID).
			WithField("rowsAffected", result.RowsAffected).
			Debug("Successfully updated operation log session ID")
	}

	return nil
}

// UpdateOperationLogWithResourceInfo 更新操作日志的SessionID和ResourceID以及详细信息
func (a *AuditService) UpdateOperationLogWithResourceInfo(userID uint, path, sessionID string, resourceID uint, resourceInfo string, timestamp time.Time) error {
	if sessionID == "" {
		return fmt.Errorf("sessionID cannot be empty")
	}

	// 构建更新字段
	updates := map[string]interface{}{
		"session_id":  sessionID,
		"resource_id": resourceID,
	}
	
	// 如果有资源信息，更新message字段
	if resourceInfo != "" {
		updates["message"] = resourceInfo
	}

	// 更新最近创建的相关操作日志记录
	result := a.db.Model(&models.OperationLog{}).
		Where("user_id = ? AND url = ? AND (session_id = '' OR session_id IS NULL) AND created_at >= ?", 
			userID, path, timestamp.Add(-1*time.Minute)).
		Updates(updates)

	if result.Error != nil {
		logrus.WithError(result.Error).
			WithField("sessionID", sessionID).
			WithField("resourceID", resourceID).
			Error("Failed to update operation log with resource info")
		return result.Error
	}

	if result.RowsAffected > 0 {
		logrus.WithField("sessionID", sessionID).
			WithField("resourceID", resourceID).
			WithField("rowsAffected", result.RowsAffected).
			Debug("Successfully updated operation log with resource info")
	}

	return nil
}


// CleanupAuditLogs 清理过期的审计日志
func (a *AuditService) CleanupAuditLogs() error {
	retentionDays := config.GlobalConfig.Audit.RetentionDays
	if retentionDays <= 0 {
		return nil
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)

	// 清理登录日志（物理删除）
	if err := a.db.Unscoped().Where("created_at < ?", cutoff).Delete(&models.LoginLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup login logs")
	}

	// 清理操作日志（物理删除）
	if err := a.db.Unscoped().Where("created_at < ?", cutoff).Delete(&models.OperationLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup operation logs")
	}

	// 清理会话记录（物理删除）
	if err := a.db.Unscoped().Where("created_at < ?", cutoff).Delete(&models.SessionRecord{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup session records")
	}

	// 清理命令日志（物理删除）
	if err := a.db.Unscoped().Where("created_at < ?", cutoff).Delete(&models.CommandLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to cleanup command logs")
	}

	logrus.WithField("cutoff", cutoff).Info("Audit logs cleanup completed")
	return nil
}

// DeleteSessionRecord 删除会话记录
func (a *AuditService) DeleteSessionRecord(sessionID, username, ip, reason string) error {
	// 检查会话记录是否存在
	var sessionRecord models.SessionRecord
	if err := a.db.Where("session_id = ?", sessionID).First(&sessionRecord).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("session record not found")
		}
		logrus.WithError(err).Error("Failed to find session record")
		return err
	}

	// 删除会话记录
	if err := a.db.Where("session_id = ?", sessionID).Delete(&models.SessionRecord{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to delete session record")
		return err
	}

	// 记录操作日志（系统操作，不记录到审计日志避免死循环）
	go a.RecordOperationLog(
		sessionRecord.UserID,
		username,
		ip,
		"DELETE",
		fmt.Sprintf("/audit/session-records/%s", sessionID),
		"delete",
		"session_record",
		uint(sessionRecord.ID),
		sessionID, // 记录被删除的会话ID
		200,
		fmt.Sprintf("删除会话记录: %s, 原因: %s", sessionID, reason),
		nil,
		nil,
		0,
		true, // isSystemOperation=true，避免审计管理操作记录死循环
	)

	logrus.WithFields(logrus.Fields{
		"session_id": sessionID,
		"username":   username,
		"reason":     reason,
	}).Info("Session record deleted")

	return nil
}

// BatchDeleteSessionRecords 批量删除会话记录
func (a *AuditService) BatchDeleteSessionRecords(sessionIDs []string, username, ip, reason string) error {
	if len(sessionIDs) == 0 {
		return fmt.Errorf("session IDs cannot be empty")
	}

	// 检查所有会话记录是否存在
	var existingRecords []models.SessionRecord
	if err := a.db.Where("session_id IN ?", sessionIDs).Find(&existingRecords).Error; err != nil {
		logrus.WithError(err).Error("Failed to find session records")
		return err
	}

	if len(existingRecords) != len(sessionIDs) {
		// 找出不存在的会话ID
		existingSessionIDs := make(map[string]bool)
		for _, record := range existingRecords {
			existingSessionIDs[record.SessionID] = true
		}

		var missingIDs []string
		for _, sessionID := range sessionIDs {
			if !existingSessionIDs[sessionID] {
				missingIDs = append(missingIDs, sessionID)
			}
		}

		logrus.WithField("missing_ids", missingIDs).Warn("Some session records not found")
		return fmt.Errorf("some session records not found: %v", missingIDs)
	}

	// 批量删除会话记录
	if err := a.db.Where("session_id IN ?", sessionIDs).Delete(&models.SessionRecord{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to batch delete session records")
		return err
	}

	// 记录操作日志（系统操作，不记录到审计日志避免死循环）
	for _, record := range existingRecords {
		go a.RecordOperationLog(
			record.UserID,
			username,
			ip,
			"DELETE",
			"/audit/session-records/batch/delete",
			"batch_delete",
			"session_record",
			uint(record.ID),
			record.SessionID, // 记录被删除的会话ID
			200,
			fmt.Sprintf("批量删除会话记录: %s, 原因: %s", record.SessionID, reason),
			nil,
			nil,
			0,
			true, // isSystemOperation=true，避免审计管理操作记录死循环
		)
	}

	logrus.WithFields(logrus.Fields{
		"session_ids":    sessionIDs,
		"deleted_count":  len(existingRecords),
		"username":       username,
		"reason":         reason,
	}).Info("Session records batch deleted")

	return nil
}

// DeleteOperationLog 删除操作日志
func (a *AuditService) DeleteOperationLog(id uint, username, ip, reason string) error {
	// 检查操作日志是否存在
	var operationLog models.OperationLog
	if err := a.db.Where("id = ?", id).First(&operationLog).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("operation log not found")
		}
		logrus.WithError(err).Error("Failed to find operation log")
		return err
	}

	// 删除操作日志
	if err := a.db.Where("id = ?", id).Delete(&models.OperationLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to delete operation log")
		return err
	}

	// 不再需要手动记录操作日志，中间件已跳过此类操作以避免死循环

	logrus.WithFields(logrus.Fields{
		"operation_log_id": id,
		"username":         username,
		"reason":           reason,
	}).Info("Operation log deleted")

	return nil
}

// BatchDeleteOperationLogs 批量删除操作日志
func (a *AuditService) BatchDeleteOperationLogs(ids []uint, username, ip, reason string) error {
	if len(ids) == 0 {
		return fmt.Errorf("operation log IDs cannot be empty")
	}

	// 检查所有操作日志是否存在
	var existingLogs []models.OperationLog
	if err := a.db.Where("id IN ?", ids).Find(&existingLogs).Error; err != nil {
		logrus.WithError(err).Error("Failed to find operation logs")
		return err
	}

	if len(existingLogs) != len(ids) {
		// 找出不存在的日志ID
		existingIDs := make(map[uint]bool)
		for _, log := range existingLogs {
			existingIDs[log.ID] = true
		}

		var missingIDs []uint
		for _, id := range ids {
			if !existingIDs[id] {
				missingIDs = append(missingIDs, id)
			}
		}

		logrus.WithField("missing_ids", missingIDs).Warn("Some operation logs not found")
		return fmt.Errorf("some operation logs not found: %v", missingIDs)
	}

	// 批量删除操作日志（物理删除）
	if err := a.db.Unscoped().Where("id IN ?", ids).Delete(&models.OperationLog{}).Error; err != nil {
		logrus.WithError(err).Error("Failed to batch delete operation logs")
		return err
	}

	// 不再需要手动记录操作日志，中间件已跳过此类操作以避免死循环

	logrus.WithFields(logrus.Fields{
		"operation_log_ids": ids,
		"deleted_count":     len(existingLogs),
		"username":          username,
		"reason":            reason,
	}).Info("Operation logs batch deleted")

	return nil
}

// BatchDeleteCommandLogs 批量删除命令日志
func (a *AuditService) BatchDeleteCommandLogs(ids []uint, username, ip, reason string) (int, error) {
	if len(ids) == 0 {
		return 0, fmt.Errorf("command log IDs cannot be empty")
	}

	// 检查所有命令日志是否存在
	var existingLogs []models.CommandLog
	if err := a.db.Where("id IN ?", ids).Find(&existingLogs).Error; err != nil {
		logrus.WithError(err).Error("Failed to find command logs")
		return 0, err
	}

	if len(existingLogs) == 0 {
		return 0, fmt.Errorf("no command logs found")
	}

	// 批量删除命令日志（物理删除）
	result := a.db.Unscoped().Where("id IN ?", ids).Delete(&models.CommandLog{})
	if result.Error != nil {
		logrus.WithError(result.Error).Error("Failed to batch delete command logs")
		return 0, result.Error
	}

	deletedCount := int(result.RowsAffected)

	// 记录批量删除操作到操作日志
	auditLog := &models.OperationLog{
		UserID:   0, // 系统记录，不关联具体用户ID
		Username: username,
		IP:       ip,
		Method:   "POST",
		URL:      "/api/audit/command-logs/batch-delete",
		Action:   "delete",
		Resource: "command_log",
		Status:   200,
		Message:  fmt.Sprintf("批量删除了 %d 条命令日志，原因：%s", deletedCount, reason),
		Duration: 0,
	}
	
	if err := a.db.Create(auditLog).Error; err != nil {
		logrus.WithError(err).Error("Failed to create audit log for batch delete command logs")
		// 不影响主要操作
	}

	logrus.WithFields(logrus.Fields{
		"command_log_ids": ids,
		"deleted_count":   deletedCount,
		"username":        username,
		"reason":          reason,
	}).Info("Command logs batch deleted")

	return deletedCount, nil
}
