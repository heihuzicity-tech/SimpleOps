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
	sshService   *SSHService
}

// NewMonitorService 创建监控服务实例
func NewMonitorService(db *gorm.DB) *MonitorService {
	return &MonitorService{
		db:           db,
		redisSession: NewRedisSessionService(),
		sshService:   NewSSHService(db),
	}
}

// ======================== 活跃会话管理 ========================

// GetActiveSessions 获取活跃会话列表
func (m *MonitorService) GetActiveSessions(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	// 🔧 优化：优先使用数据库作为权威数据源，Redis作为缓存补充
	// 这确保了会话状态的准确性，特别是在会话刚刚关闭的场景下
	
	// 第一步：从数据库获取权威的活跃会话列表
	dbSessions, dbTotal, err := m.getActiveSessionsFromDB(req)
	if err != nil {
		logrus.WithError(err).Error("Failed to get sessions from database")
		// 如果数据库失败，尝试从Redis获取（降级策略）
		if m.redisSession != nil {
			return m.getActiveSessionsFromRedisOnly(req)
		}
		return nil, 0, err
	}
	
	// 第二步：如果Redis可用，用Redis数据补充实时信息（如最后活动时间）
	if m.redisSession != nil {
		enhancedSessions := m.enhanceSessionsWithRedisData(dbSessions)
		return enhancedSessions, dbTotal, nil
	}
	
	return dbSessions, dbTotal, nil
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

	// 从数据库获取真正活跃的会话 session_id
	var dbSessionIDs []string
	if err := m.buildActiveSessionsQuery().
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

// getActiveSessionsFromRedisOnly 仅从Redis获取活跃会话（降级策略）
func (m *MonitorService) getActiveSessionsFromRedisOnly(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	redisSessions, total, err := m.getActiveSessionsFromRedis(req)
	if err != nil {
		return nil, 0, err
	}
	
	logrus.WithField("sessions_count", len(redisSessions)).Warn("使用Redis降级策略获取会话")
	return redisSessions, total, nil
}

// enhanceSessionsWithRedisData 用Redis数据增强数据库会话信息
func (m *MonitorService) enhanceSessionsWithRedisData(dbSessions []*models.ActiveSessionResponse) []*models.ActiveSessionResponse {
	if len(dbSessions) == 0 {
		return dbSessions
	}
	
	// 从Redis批量获取会话信息
	redisSessionMap := make(map[string]*RedisSessionData)
	redisSessions, err := m.redisSession.GetActiveSessions()
	if err != nil {
		logrus.WithError(err).Warn("无法从Redis获取会话数据，使用数据库数据")
		return dbSessions
	}
	
	// 构建Redis会话映射
	for _, redisSession := range redisSessions {
		redisSessionMap[redisSession.SessionID] = redisSession
	}
	
	// 增强数据库会话信息
	for _, dbSession := range dbSessions {
		if redisData, exists := redisSessionMap[dbSession.SessionID]; exists {
			// 使用Redis中的实时数据更新最后活动时间
			dbSession.LastActivity = redisData.LastActive.Format("2006-01-02 15:04:05")
			dbSession.InactiveTime = int64(time.Since(redisData.LastActive).Seconds())
			
			// 保持数据库为权威状态源，只更新实时活动信息
			logrus.WithField("session_id", dbSession.SessionID).Debug("使用Redis数据增强会话信息")
		}
	}
	
	logrus.WithFields(logrus.Fields{
		"db_sessions":    len(dbSessions),
		"redis_sessions": len(redisSessions),
		"enhanced":       len(dbSessions),
	}).Info("完成会话数据增强")
	
	return dbSessions
}

// buildActiveSessionsQuery 构建统一的活跃会话查询条件
func (m *MonitorService) buildActiveSessionsQuery() *gorm.DB {
	cutoffTime := time.Now().Add(-2 * time.Minute)
	return m.db.Model(&models.SessionRecord{}).Where(
		"status = ? AND (is_terminated IS NULL OR is_terminated = ?) AND end_time IS NULL AND start_time >= ?",
		"active", false, cutoffTime,
	)
}

// getActiveSessionsFromDB 从数据库获取活跃会话
func (m *MonitorService) getActiveSessionsFromDB(req *models.ActiveSessionListRequest) ([]*models.ActiveSessionResponse, int64, error) {
	var sessions []models.SessionRecord
	var total int64

	// 使用统一的活跃会话查询条件
	query := m.buildActiveSessionsQuery()

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

// GetDB 获取数据库连接（用于临时修复API）
func (m *MonitorService) GetDB() *gorm.DB {
	return m.db
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

	// 发送精确的WebSocket通知
	if GlobalWebSocketService != nil {
		// 1. 通知被终止的用户 - 精确投递
		terminateMsg := WSMessage{
			Type:      ForceTerminate,
			Data: map[string]interface{}{
				"session_id": sessionID,
				"reason":     req.Reason,
				"admin_user": adminUser.Username,
				"force":      req.Force,
				"user_id":    session.UserID,
			},
			Timestamp: now,
			SessionID: sessionID,
		}
		
		// 🔧 修复：同时发送给指定用户和进行有限广播确保消息送达
		logrus.WithFields(logrus.Fields{
			"session_id": sessionID,
			"user_id":    session.UserID,
			"msg_type":   terminateMsg.Type,
		}).Info("发送强制终止消息给用户")
		
		GlobalWebSocketService.SendMessageToUser(session.UserID, terminateMsg)
		
		// 临时措施：为确保终端收到消息，也发送给所有管理客户端（但前端会验证session_id）
		data, _ := json.Marshal(terminateMsg)
		GlobalWebSocketService.manager.broadcast <- data
		
		logrus.WithField("session_id", sessionID).Info("已广播强制终止消息")

		// 2. 向有监控权限的管理员发送状态更新 - 避免全局广播
		sessionUpdateMsg := WSMessage{
			Type: SessionEnd,
			Data: map[string]interface{}{
				"session_id": sessionID,
				"status":     "terminated",
				"end_time":   now,
				"reason":     req.Reason,
				"user_id":    session.UserID,
				"username":   session.Username,
			},
			Timestamp: now,
			SessionID: sessionID,
		}
		
		// 只向管理员发送监控更新，不进行全局广播
		m.broadcastToAdmins(sessionUpdateMsg)
		
		logrus.WithFields(logrus.Fields{
			"session_id": sessionID,
			"user_id":    session.UserID,
		}).Info("已发送精确的会话终止通知")
	}

	// 实际关闭 SSH 连接
	if m.sshService != nil {
		if err := m.sshService.CloseSessionWithReason(sessionID, req.Reason); err != nil {
			// 记录详细错误信息
			logrus.WithError(err).WithFields(logrus.Fields{
				"session_id": sessionID,
				"admin_user": adminUser.Username,
				"reason":     req.Reason,
			}).Error("SSH连接关闭失败，但会话已标记为终止")
			
			// 通知管理员连接关闭异常
			if GlobalWebSocketService != nil {
				alertMsg := WSMessage{
					Type: SystemAlert,
					Data: map[string]interface{}{
						"level":      "warning",
						"message":    fmt.Sprintf("会话 %s SSH连接关闭异常，但已标记为终止", sessionID),
						"session_id": sessionID,
						"details":    err.Error(),
					},
					Timestamp: time.Now(),
				}
				GlobalWebSocketService.SendMessageToUser(adminUserID, alertMsg)
			}
		} else {
			logrus.WithFields(logrus.Fields{
				"session_id": sessionID,
				"admin_user": adminUser.Username,
			}).Info("SSH连接已成功强制关闭")
		}
	} else {
		// SSH服务不可用的情况
		logrus.WithField("session_id", sessionID).Warn("SSH服务不可用，无法关闭连接，但会话已标记为终止")
	}

	logrus.WithFields(logrus.Fields{
		"session_id":  sessionID,
		"admin_user":  adminUser.Username,
		"reason":      req.Reason,
		"force":       req.Force,
	}).Info("会话已被终止")

	return nil
}

// broadcastToAdmins 向有监控权限的管理员精确广播消息
func (m *MonitorService) broadcastToAdmins(message WSMessage) {
	if GlobalWebSocketService == nil {
		return
	}

	// 获取所有有监控权限的在线用户
	var adminUsers []models.User
	if err := m.db.Preload("Roles.Permissions").Find(&adminUsers).Error; err != nil {
		logrus.WithError(err).Error("获取管理员用户失败")
		return
	}

	adminCount := 0
	for _, user := range adminUsers {
		// 检查用户是否有监控权限
		if user.HasPermission("audit:view") || user.HasPermission("audit:terminate") {
			// 向有权限的管理员发送消息
			GlobalWebSocketService.SendMessageToUser(user.ID, message)
			adminCount++
		}
	}

	logrus.WithFields(logrus.Fields{
		"message_type": message.Type,
		"admin_count":  adminCount,
		"session_id":   message.SessionID,
	}).Info("已向管理员发送精确广播")
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
	// 首先清理所有陈旧的"active"状态记录
	now := time.Now()
	cutoffTime := now.Add(-30 * time.Minute) // 🔧 修复：从2分钟改为30分钟，避免误清理活跃会话
	
	// 🔧 修复：调整清理策略，避免过度激进
	// 清理超过5分钟无活动且没有正确end_time的会话（从30秒改为5分钟）
	immediateCleanupTime := now.Add(-5 * time.Minute)
	immediateResult := m.db.Model(&models.SessionRecord{}).
		Where("status = ? AND updated_at < ? AND end_time IS NULL", "active", immediateCleanupTime).
		Updates(map[string]interface{}{
			"status":     "closed",
			"end_time":   now,
			"updated_at": now,
		})
	
	if immediateResult.RowsAffected > 0 {
		logrus.WithField("cleaned_count", immediateResult.RowsAffected).Info("清理了5分钟内无活动的会话记录")
	}
	
	// 清理超过30分钟的"active"会话
	result := m.db.Model(&models.SessionRecord{}).
		Where("status = ? AND start_time < ?", "active", cutoffTime).
		Updates(map[string]interface{}{
			"status":     "closed",
			"end_time":   now,
			"updated_at": now,
		})
	
	if result.RowsAffected > 0 {
		logrus.WithField("cleaned_count", result.RowsAffected).Info("清理了陈旧的active会话记录")
	}
	
	// 获取真正活跃的会话 - 添加时间限制
	var sessions []models.SessionRecord
	if err := m.db.Where("status = ? AND (is_terminated IS NULL OR is_terminated = ?) AND start_time >= ? AND end_time IS NULL", "active", false, cutoffTime).Find(&sessions).Error; err != nil {
		logrus.WithError(err).Error("获取活跃会话失败")
		return
	}

	// 🔧 优化：增强Redis与数据库的同步清理机制
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

			cleanupCount := 0
			for _, redisSession := range redisSessions {
				if !dbSessionMap[redisSession.SessionID] {
					cleanupCount++
					logrus.WithField("session_id", redisSession.SessionID).Info("清理Redis中的过期会话")
					if err := m.redisSession.CloseSession(redisSession.SessionID, "db_sync_expired"); err != nil {
						logrus.WithError(err).Error("清理Redis过期会话失败")
					}
				}
			}
			
			// 双向检查：确保数据库中的活跃会话在Redis中也存在
			redisSessionMap := make(map[string]bool)
			for _, redisSession := range redisSessions {
				redisSessionMap[redisSession.SessionID] = true
			}
			
			missingInRedisCount := 0
			for _, session := range sessions {
				if !redisSessionMap[session.SessionID] {
					missingInRedisCount++
					logrus.WithField("session_id", session.SessionID).Debug("数据库会话在Redis中不存在，这是正常的（会话可能刚创建）")
				}
			}
			
			if cleanupCount > 0 || missingInRedisCount > 0 {
				logrus.WithFields(logrus.Fields{
					"redis_cleaned":        cleanupCount,
					"missing_in_redis":     missingInRedisCount,
					"db_active_sessions":   len(sessions),
					"redis_sessions":       len(redisSessions),
				}).Info("完成Redis-数据库同步清理")
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