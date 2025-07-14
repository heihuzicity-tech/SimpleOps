package services

import (
	"bastion/config"
	"bastion/models"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// MonitorService 实时监控服务
type MonitorService struct {
	db           *gorm.DB
	redisSession *RedisSessionService
}

// NewMonitorService 创建监控服务实例
func NewMonitorService(db *gorm.DB) *MonitorService {
	return &MonitorService{
		db:           db,
		redisSession: NewRedisSessionService(),
	}
}

// ======================== 活跃会话管理 ========================

// GetActiveSessions 获取活跃会话列表
func (m *MonitorService) GetActiveSessions(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	// 优先使用 Redis 获取活跃会话，但与数据库进行交叉验证
	if m.redisSession != nil {
		redisSessions, _, err := m.getActiveSessionsFromRedis(req)
		if err != nil {
			logrus.WithError(err).Error("Failed to get sessions from Redis, falling back to database")
			return m.getActiveSessionsFromDB(req)
		}
		
		// 与数据库会话进行交叉验证，去除重复或已失效的会话
		validatedSessions := m.validateSessionsWithDB(redisSessions)
		return validatedSessions, int64(len(validatedSessions)), nil
	}
	
	// 备选方案：从数据库获取
	return m.getActiveSessionsFromDB(req)
}

// getActiveSessionsFromRedis 从 Redis 获取活跃会话
func (m *MonitorService) getActiveSessionsFromRedis(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	redisSessions, err := m.redisSession.GetActiveSessions()
	if err != nil {
		logrus.WithError(err).Error("Failed to get sessions from Redis, falling back to database")
		return m.getActiveSessionsFromDB(req)
	}

	// 应用过滤条件
	var filteredSessions []*RedisSessionData
	for _, session := range redisSessions {
		if req.Username != "" && !contains(session.Username, req.Username) {
			continue
		}
		if req.AssetName != "" && !contains(session.AssetName, req.AssetName) {
			continue
		}
		if req.Protocol != "" && session.Protocol != req.Protocol {
			continue
		}
		filteredSessions = append(filteredSessions, session)
	}

	total := int64(len(filteredSessions))

	// 应用分页
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	end := start + pageSize
	if end > len(filteredSessions) {
		end = len(filteredSessions)
	}
	if start > len(filteredSessions) {
		start = len(filteredSessions)
	}

	paginatedSessions := filteredSessions[start:end]

	// 转换为响应格式
	var responses []*models.ActiveSessionResponse
	for _, session := range paginatedSessions {
		response := &models.ActiveSessionResponse{
			SessionRecordResponse: models.SessionRecordResponse{
				SessionID:    session.SessionID,
				UserID:       session.UserID,
				Username:     session.Username,
				AssetID:      session.AssetID,
				AssetName:    session.AssetName,
				AssetAddress: session.AssetAddress,
				CredentialID: session.CredentialID,
				Protocol:     session.Protocol,
				Status:       session.Status,
				StartTime:    session.StartTime,
				CreatedAt:    session.StartTime,
			},
			ConnectionTime: int64(time.Since(session.StartTime).Seconds()),
			InactiveTime:   int64(time.Since(session.LastActive).Seconds()),
			LastActivity:   session.LastActive.Format("2006-01-02 15:04:05"),
			CanTerminate:   true,
		}
		
		// 获取监控相关信息
		response.MonitorCount = m.getSessionMonitorCount(session.SessionID)
		response.UnreadWarnings = m.getUnreadWarningsCount(session.SessionID, session.UserID)
		response.IsMonitored = m.isSessionBeingMonitored(session.SessionID)
		
		responses = append(responses, response)
	}

	return responses, total, nil
}

// validateSessionsWithDB 与数据库交叉验证会话，去除重复和已失效的会话
func (m *MonitorService) validateSessionsWithDB(redisSessions []*models.ActiveSessionResponse) []*models.ActiveSessionResponse {
	if len(redisSessions) == 0 {
		return redisSessions
	}

	// 从数据库获取所有活跃会话的 session_id
	var dbSessionIDs []string
	if err := m.db.Model(&models.SessionRecord{}).
		Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?)", "active", false).
		Pluck("session_id", &dbSessionIDs).Error; err != nil {
		logrus.WithError(err).Error("Failed to validate sessions with database")
		return redisSessions
	}

	// 创建数据库会话ID的映射，用于快速查找
	dbSessionMap := make(map[string]bool)
	for _, sessionID := range dbSessionIDs {
		dbSessionMap[sessionID] = true
	}

	// 过滤掉数据库中不存在或已失效的会话
	var validatedSessions []*models.ActiveSessionResponse
	seenSessions := make(map[string]bool) // 用于去重
	
	for _, session := range redisSessions {
		// 检查会话是否在数据库中存在且活跃
		if !dbSessionMap[session.SessionID] {
			logrus.WithField("session_id", session.SessionID).Warn("Redis中的会话在数据库中不存在或已失效，已清理")
			// 从Redis中清理这个无效会话
			if m.redisSession != nil {
				if err := m.redisSession.CloseSession(session.SessionID, "invalid"); err != nil {
					logrus.WithError(err).WithField("session_id", session.SessionID).Error("Failed to clean invalid session from Redis")
				}
			}
			continue
		}

		// 检查是否重复
		if seenSessions[session.SessionID] {
			logrus.WithField("session_id", session.SessionID).Warn("发现重复会话，已过滤")
			continue
		}

		seenSessions[session.SessionID] = true
		validatedSessions = append(validatedSessions, session)
	}

	logrus.WithFields(logrus.Fields{
		"redis_sessions":      len(redisSessions),
		"validated_sessions":  len(validatedSessions),
		"filtered_sessions":   len(redisSessions) - len(validatedSessions),
	}).Info("会话验证完成")

	return validatedSessions
}

// getActiveSessionsFromDB 从数据库获取活跃会话
func (m *MonitorService) getActiveSessionsFromDB(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	var sessions []models.SessionRecord
	var total int64

	// 构建查询条件 - 修复正确的活跃会话查询条件
	query := m.db.Model(&models.SessionRecord{}).Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?)", "active", false)

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
	if req.IP != "" {
		query = query.Where("ip = ?", req.IP)
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
	if err := query.Offset(offset).Limit(pageSize).Order("start_time DESC").Find(&sessions).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式并添加监控相关信息
	var responses []*models.ActiveSessionResponse
	for _, session := range sessions {
		response := session.ToActiveResponse()
		
		// 获取监控统计信息
		response.MonitorCount = m.getSessionMonitorCount(session.SessionID)
		response.UnreadWarnings = m.getUnreadWarningsCount(session.SessionID, session.UserID)
		response.IsMonitored = m.isSessionBeingMonitored(session.SessionID)
		
		responses = append(responses, response)
	}

	return responses, total, nil
}

// getSessionMonitorCount 获取会话监控次数
func (m *MonitorService) getSessionMonitorCount(sessionID string) int {
	var count int64
	m.db.Model(&models.SessionMonitorLog{}).Where("session_id = ? AND action_type = ?", sessionID, "view").Count(&count)
	return int(count)
}

// getUnreadWarningsCount 获取未读警告数量
func (m *MonitorService) getUnreadWarningsCount(sessionID string, userID uint) int {
	var count int64
	m.db.Model(&models.SessionWarning{}).Where("session_id = ? AND receiver_user_id = ? AND is_read = ?", sessionID, userID, false).Count(&count)
	return int(count)
}

// isSessionBeingMonitored 检查会话是否正在被监控
func (m *MonitorService) isSessionBeingMonitored(sessionID string) bool {
	// 检查最近5分钟是否有监控操作
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute)
	var count int64
	m.db.Model(&models.SessionMonitorLog{}).
		Where("session_id = ? AND action_type = ? AND created_at > ?", sessionID, "view", fiveMinutesAgo).
		Count(&count)
	return count > 0
}

// ======================== 会话终止管理 ========================

// TerminateSession 终止会话
func (m *MonitorService) TerminateSession(sessionID string, adminUserID uint, req *models.TerminateSessionRequest) error {
	// 查找会话记录
	var session models.SessionRecord
	if err := m.db.Where("session_id = ? AND status = ?", sessionID, "active").First(&session).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("会话不存在或已结束")
		}
		return fmt.Errorf("查询会话失败: %v", err)
	}

	// 检查权限（管理员或会话所有者）
	var adminUser models.User
	if err := m.db.Preload("Roles.Permissions").Where("id = ?", adminUserID).First(&adminUser).Error; err != nil {
		return fmt.Errorf("管理员用户不存在")
	}

	if !adminUser.HasPermission("audit:terminate") && adminUser.ID != session.UserID {
		return fmt.Errorf("没有终止会话的权限")
	}

	// 开始事务
	tx := m.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新会话状态
	now := time.Now()
	updates := map[string]interface{}{
		"status":             "terminated",
		"end_time":           now,
		"is_terminated":      true,
		"termination_reason": req.Reason,
		"terminated_by":      adminUserID,
		"terminated_at":      now,
		"updated_at":         now,
	}

	if err := tx.Model(&models.SessionRecord{}).Where("session_id = ?", sessionID).Updates(updates).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新会话状态失败: %v", err)
	}

	// 记录监控日志
	actionData := map[string]interface{}{
		"force":             req.Force,
		"termination_time":  now,
		"session_duration":  time.Since(session.StartTime).Seconds(),
	}
	actionDataJSON, _ := json.Marshal(actionData)

	monitorLog := &models.SessionMonitorLog{
		SessionID:     sessionID,
		MonitorUserID: adminUserID,
		ActionType:    "terminate",
		ActionData:    string(actionDataJSON),
		Reason:        req.Reason,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := tx.Create(monitorLog).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("记录监控日志失败: %v", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	// 发送WebSocket通知
	if GlobalWebSocketService != nil {
		// 通知被终止的用户
		terminateMsg := WSMessage{
			Type:      ForceTerminate,
			Data: map[string]interface{}{
				"session_id": sessionID,
				"reason":     req.Reason,
				"admin_user": adminUser.Username,
				"force":      req.Force,
			},
			Timestamp: now,
			SessionID: sessionID,
		}
		GlobalWebSocketService.SendMessageToUser(session.UserID, terminateMsg)

		// 广播会话状态更新
		session.Status = "terminated"
		session.EndTime = &now
		GlobalWebSocketService.BroadcastSessionUpdate(&session, SessionEnd)
	}

	logrus.WithFields(logrus.Fields{
		"session_id":  sessionID,
		"admin_user":  adminUser.Username,
		"reason":      req.Reason,
		"force":       req.Force,
	}).Info("会话已被终止")

	return nil
}

// ======================== 会话警告管理 ========================

// SendSessionWarning 发送会话警告
func (m *MonitorService) SendSessionWarning(sessionID string, senderUserID uint, req *models.SessionWarningRequest) error {
	// 查找会话记录
	var session models.SessionRecord
	if err := m.db.Where("session_id = ? AND status = ?", sessionID, "active").First(&session).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("会话不存在或已结束")
		}
		return fmt.Errorf("查询会话失败: %v", err)
	}

	// 检查发送者权限
	var senderUser models.User
	if err := m.db.Preload("Roles.Permissions").Where("id = ?", senderUserID).First(&senderUser).Error; err != nil {
		return fmt.Errorf("发送者用户不存在")
	}

	if !senderUser.HasPermission("audit:warning") {
		return fmt.Errorf("没有发送警告的权限")
	}

	// 创建警告记录
	warning := &models.SessionWarning{
		SessionID:      sessionID,
		SenderUserID:   senderUserID,
		ReceiverUserID: session.UserID,
		Message:        req.Message,
		Level:          req.Level,
		IsRead:         false,
		CreatedAt:      time.Now(),
	}

	if err := m.db.Create(warning).Error; err != nil {
		return fmt.Errorf("创建警告记录失败: %v", err)
	}

	// 记录监控日志
	actionData := map[string]interface{}{
		"warning_id":    warning.ID,
		"warning_level": req.Level,
		"message":       req.Message,
	}
	actionDataJSON, _ := json.Marshal(actionData)

	monitorLog := &models.SessionMonitorLog{
		SessionID:     sessionID,
		MonitorUserID: senderUserID,
		ActionType:    "warning",
		ActionData:    string(actionDataJSON),
		Reason:        fmt.Sprintf("发送%s级别警告", req.Level),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := m.db.Create(monitorLog).Error; err != nil {
		logrus.WithError(err).Error("记录监控日志失败")
	}

	// 发送WebSocket通知
	if GlobalWebSocketService != nil {
		warningMsg := WSMessage{
			Type: SessionWarning,
			Data: map[string]interface{}{
				"warning_id":   warning.ID,
				"session_id":   sessionID,
				"sender_user":  senderUser.Username,
				"message":      req.Message,
				"level":        req.Level,
				"created_at":   warning.CreatedAt,
			},
			Timestamp: time.Now(),
			SessionID: sessionID,
		}
		GlobalWebSocketService.SendMessageToUser(session.UserID, warningMsg)
	}

	logrus.WithFields(logrus.Fields{
		"session_id":    sessionID,
		"sender_user":   senderUser.Username,
		"receiver_user": session.Username,
		"level":         req.Level,
		"message":       req.Message,
	}).Info("会话警告已发送")

	return nil
}

// MarkWarningAsRead 标记警告为已读
func (m *MonitorService) MarkWarningAsRead(warningID uint, userID uint) error {
	var warning models.SessionWarning
	if err := m.db.Where("id = ? AND receiver_user_id = ?", warningID, userID).First(&warning).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("警告不存在或无权访问")
		}
		return fmt.Errorf("查询警告失败: %v", err)
	}

	if !warning.IsRead {
		warning.MarkAsRead()
		if err := m.db.Save(&warning).Error; err != nil {
			return fmt.Errorf("更新警告状态失败: %v", err)
		}
	}

	return nil
}

// ======================== 统计数据 ========================

// GetMonitorStatistics 获取监控统计数据
func (m *MonitorService) GetMonitorStatistics() (*models.MonitorStatistics, error) {
	stats := &models.MonitorStatistics{}

	// 活跃会话数 - 优先使用 Redis
	if m.redisSession != nil {
		count, err := m.redisSession.GetSessionCount()
		if err == nil {
			stats.ActiveSessions = count
		} else {
			// 备选方案：从数据库获取
			m.db.Model(&models.SessionRecord{}).Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?)", "active", false).Count(&stats.ActiveSessions)
		}
	} else {
		m.db.Model(&models.SessionRecord{}).Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?)", "active", false).Count(&stats.ActiveSessions)
	}

	// 已连接的监控客户端数
	if GlobalWebSocketService != nil {
		stats.ConnectedMonitors = int64(GlobalWebSocketService.GetConnectedClients())
	}

	// 总连接数（今日）
	today := time.Now().Truncate(24 * time.Hour)
	m.db.Model(&models.WebSocketConnection{}).Where("connect_time >= ?", today).Count(&stats.TotalConnections)

	// 已终止会话数（今日）
	m.db.Model(&models.SessionRecord{}).Where("terminated_at >= ?", today).Count(&stats.TerminatedSessions)

	// 已发送警告数（今日）
	m.db.Model(&models.SessionWarning{}).Where("created_at >= ?", today).Count(&stats.SentWarnings)

	// 未读警告数
	m.db.Model(&models.SessionWarning{}).Where("is_read = ?", false).Count(&stats.UnreadWarnings)

	return stats, nil
}

// ======================== 监控操作记录 ========================

// RecordMonitorView 记录监控查看操作
func (m *MonitorService) RecordMonitorView(sessionID string, monitorUserID uint) error {
	monitorLog := &models.SessionMonitorLog{
		SessionID:     sessionID,
		MonitorUserID: monitorUserID,
		ActionType:    "view",
		ActionData:    "{}",
		Reason:        "查看会话监控",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	return m.db.Create(monitorLog).Error
}

// GetSessionMonitorLogs 获取会话监控日志
func (m *MonitorService) GetSessionMonitorLogs(sessionID string, page, pageSize int) ([]*models.SessionMonitorLogResponse, int64, error) {
	var logs []models.SessionMonitorLog
	var total int64

	query := m.db.Model(&models.SessionMonitorLog{}).Preload("MonitorUser").Where("session_id = ?", sessionID)

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	// 转换为响应格式
	var responses []*models.SessionMonitorLogResponse
	for _, log := range logs {
		responses = append(responses, log.ToResponse())
	}

	return responses, total, nil
}

// ======================== 定时任务 ========================

// StartMonitoringTasks 启动监控相关定时任务
func (m *MonitorService) StartMonitoringTasks() {
	if !config.GlobalConfig.Monitor.EnableRealtime {
		return
	}

	// 启动会话状态更新任务
	go m.sessionUpdateTask()

	// 启动非活跃会话检测任务
	go m.inactiveSessionDetectionTask()

	logrus.Info("监控定时任务已启动")
}

// sessionUpdateTask 会话状态更新任务
func (m *MonitorService) sessionUpdateTask() {
	ticker := time.NewTicker(time.Duration(config.GlobalConfig.Monitor.UpdateInterval) * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.updateSessionStatus()
	}
}

// inactiveSessionDetectionTask 非活跃会话检测任务
func (m *MonitorService) inactiveSessionDetectionTask() {
	ticker := time.NewTicker(time.Minute * 5) // 每5分钟检测一次
	defer ticker.Stop()

	for range ticker.C {
		m.detectInactiveSessions()
	}
}

// updateSessionStatus 更新会话状态
func (m *MonitorService) updateSessionStatus() {
	// 获取所有活跃会话 - 修复查询条件
	var sessions []models.SessionRecord
	if err := m.db.Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?)", "active", false).Find(&sessions).Error; err != nil {
		logrus.WithError(err).Error("获取活跃会话失败")
		return
	}

	// 同步清理Redis中的过期会话
	if m.redisSession != nil {
		// 获取数据库中的活跃会话ID列表
		var dbSessionIDs []string
		for _, session := range sessions {
			dbSessionIDs = append(dbSessionIDs, session.SessionID)
		}

		// 获取Redis中的所有会话
		redisSessions, err := m.redisSession.GetActiveSessions()
		if err == nil {
			// 清理Redis中数据库不存在的会话
			dbSessionMap := make(map[string]bool)
			for _, sessionID := range dbSessionIDs {
				dbSessionMap[sessionID] = true
			}

			for _, redisSession := range redisSessions {
				if !dbSessionMap[redisSession.SessionID] {
					logrus.WithField("session_id", redisSession.SessionID).Info("清理Redis中的过期会话")
					if err := m.redisSession.CloseSession(redisSession.SessionID, "expired"); err != nil {
						logrus.WithError(err).Error("清理Redis过期会话失败")
					}
				}
			}
		}
	}

	// 广播监控更新
	if GlobalWebSocketService != nil {
		var activeSessions []*models.ActiveSessionResponse
		for _, session := range sessions {
			activeSessions = append(activeSessions, session.ToActiveResponse())
		}

		updateMsg := WSMessage{
			Type: MonitoringUpdate,
			Data: map[string]interface{}{
				"active_sessions": activeSessions,
				"total_count":     len(activeSessions),
				"update_time":     time.Now(),
			},
			Timestamp: time.Now(),
		}

		data, _ := json.Marshal(updateMsg)
		GlobalWebSocketService.manager.broadcast <- data
	}
}

// detectInactiveSessions 检测非活跃会话
func (m *MonitorService) detectInactiveSessions() {
	maxInactiveTime := time.Duration(config.GlobalConfig.Monitor.MaxInactiveTime) * time.Second
	cutoffTime := time.Now().Add(-maxInactiveTime)

	var inactiveSessions []models.SessionRecord
	if err := m.db.Where("status = ? AND updated_at < ? AND (is_terminated IS NULL OR is_terminated = ?)", 
		"active", cutoffTime, false).Find(&inactiveSessions).Error; err != nil {
		logrus.WithError(err).Error("查询非活跃会话失败")
		return
	}

	for _, session := range inactiveSessions {
		logrus.WithFields(logrus.Fields{
			"session_id":      session.SessionID,
			"username":        session.Username,
			"last_activity":   session.UpdatedAt,
			"inactive_time":   time.Since(session.UpdatedAt),
		}).Warn("检测到非活跃会话")

		// 发送警告通知
		if GlobalWebSocketService != nil {
			alertMsg := WSMessage{
				Type: SystemAlert,
				Data: map[string]interface{}{
					"type":            "inactive_session",
					"session_id":      session.SessionID,
					"username":        session.Username,
					"asset_name":      session.AssetName,
					"inactive_time":   time.Since(session.UpdatedAt).Minutes(),
					"last_activity":   session.UpdatedAt,
				},
				Timestamp: time.Now(),
				SessionID: session.SessionID,
			}

			data, _ := json.Marshal(alertMsg)
			GlobalWebSocketService.manager.broadcast <- data
		}
	}
}

// contains 检查字符串是否包含子字符串（忽略大小写）
func contains(str, substr string) bool {
	return len(str) >= len(substr) && 
		(str == substr || 
		 len(substr) == 0 || 
		 (len(str) > 0 && len(substr) > 0 && 
		  (str[0:len(substr)] == substr || 
		   (len(str) > len(substr) && str[len(str)-len(substr):] == substr) ||
		   (len(str) > len(substr) && findSubstring(str, substr)))))
}

// findSubstring 查找子字符串
func findSubstring(str, substr string) bool {
	for i := 0; i <= len(str)-len(substr); i++ {
		if str[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}