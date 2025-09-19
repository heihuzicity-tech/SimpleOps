package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"bastion/interfaces"
	"bastion/models"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// SessionRecord 会话记录结构
type SessionRecord struct {
	SessionID     string    `json:"session_id" redis:"session_id"`
	AssetID       uint      `json:"asset_id" redis:"asset_id"`
	UserID        uint      `json:"user_id" redis:"user_id"`
	Status        string    `json:"status" redis:"status"`
	StartTime     time.Time `json:"start_time" redis:"start_time"`
	LastActivity  time.Time `json:"last_activity" redis:"last_activity"`
	EndTime       *time.Time `json:"end_time,omitempty" redis:"end_time"`
	ClientIP      string    `json:"client_ip" redis:"client_ip"`
	AssetName     string    `json:"asset_name" redis:"asset_name"`
	AssetHost     string    `json:"asset_host" redis:"asset_host"`
	Username      string    `json:"username" redis:"username"`
	TerminalType  string    `json:"terminal_type" redis:"terminal_type"`
	WindowSize    string    `json:"window_size" redis:"window_size"`
	BytesIn       int64     `json:"bytes_in" redis:"bytes_in"`
	BytesOut      int64     `json:"bytes_out" redis:"bytes_out"`
	CommandCount  int       `json:"command_count" redis:"command_count"`
	CloseReason   string    `json:"close_reason,omitempty" redis:"close_reason"`
}

// GetSessionID 实现SessionInfo接口
func (sr *SessionRecord) GetSessionID() string { return sr.SessionID }
func (sr *SessionRecord) GetAssetID() uint { return sr.AssetID }
func (sr *SessionRecord) GetUserID() uint { return sr.UserID }
func (sr *SessionRecord) GetStatus() string { return sr.Status }
func (sr *SessionRecord) GetStartTime() time.Time { return sr.StartTime }
func (sr *SessionRecord) GetLastActivity() time.Time { return sr.LastActivity }
func (sr *SessionRecord) GetClientIP() string { return sr.ClientIP }

// UnifiedSessionService 统一会话服务 - 使用Redis作为主存储，MySQL作为持久化存储
type UnifiedSessionService struct {
	redisClient   *redis.Client
	db            *gorm.DB
	auditLogger   interfaces.AuditLogger
	notifier      interfaces.NotificationSender
	
	// 配置参数
	sessionTimeout    time.Duration // 会话超时时间
	cleanupInterval   time.Duration // 清理间隔
	maxSessions       int           // 单用户最大会话数
	enablePersistence bool          // 是否启用持久化存储
}

// NewUnifiedSessionService 创建新的统一会话服务
func NewUnifiedSessionService(redisClient *redis.Client, db *gorm.DB) *UnifiedSessionService {
	service := &UnifiedSessionService{
		redisClient:       redisClient,
		db:                db,
		sessionTimeout:    30 * time.Minute, // 默认30分钟超时
		cleanupInterval:   3 * time.Minute,  // 默认3分钟清理一次（提高响应性）
		maxSessions:       10,               // 默认单用户最大10个会话
		enablePersistence: true,
	}

	// 启动后台清理任务
	go service.startCleanupTask()

	return service
}

// SetDependencies 设置服务依赖
func (uss *UnifiedSessionService) SetDependencies(
	auditLogger interfaces.AuditLogger,
	notifier interfaces.NotificationSender,
) {
	uss.auditLogger = auditLogger
	uss.notifier = notifier
}

// SetConfig 设置配置参数
func (uss *UnifiedSessionService) SetConfig(timeout, cleanup time.Duration, maxSessions int, enablePersistence bool) {
	uss.sessionTimeout = timeout
	uss.cleanupInterval = cleanup
	uss.maxSessions = maxSessions
	uss.enablePersistence = enablePersistence
}

// CreateSession 创建新会话
func (uss *UnifiedSessionService) CreateSession(ctx context.Context, session interfaces.SessionInfo) (string, error) {
	sessionRecord := &SessionRecord{
		SessionID:    session.GetSessionID(),
		AssetID:      session.GetAssetID(),
		UserID:       session.GetUserID(),
		Status:       interfaces.SessionStatusActive,
		StartTime:    time.Now(),
		LastActivity: time.Now(),
		ClientIP:     session.GetClientIP(),
	}

	// 生成会话ID（如果没有提供）
	if sessionRecord.SessionID == "" {
		sessionRecord.SessionID = uss.generateSessionID(sessionRecord.UserID, sessionRecord.AssetID)
	}

	// 检查用户会话数量限制
	if err := uss.checkSessionLimit(ctx, sessionRecord.UserID); err != nil {
		return "", err
	}

	// 保存到Redis
	if err := uss.saveSessionToRedis(ctx, sessionRecord); err != nil {
		return "", fmt.Errorf("保存会话到Redis失败: %v", err)
	}

	// 保存到数据库（如果启用持久化）
	if uss.enablePersistence {
		if err := uss.saveSessionToDB(ctx, sessionRecord); err != nil {
			log.Printf("保存会话到数据库失败: %v", err)
			// 数据库保存失败不影响会话创建，只记录日志
		}
	}

	// 记录审计日志
	if uss.auditLogger != nil {
		uss.auditLogger.LogSessionStart(ctx, sessionRecord)
	}

	// 发送通知
	if uss.notifier != nil {
		uss.notifier.NotifySessionStart(ctx, sessionRecord)
	}

	log.Printf("会话创建成功: SessionID=%s, UserID=%d, AssetID=%d", 
		sessionRecord.SessionID, sessionRecord.UserID, sessionRecord.AssetID)

	return sessionRecord.SessionID, nil
}

// GetSession 获取会话信息
func (uss *UnifiedSessionService) GetSession(ctx context.Context, sessionID string) (interfaces.SessionInfo, error) {
	// 首先从Redis获取
	session, err := uss.getSessionFromRedis(ctx, sessionID)
	if err == nil {
		return session, nil
	}

	// 如果Redis中没有，从数据库获取
	if uss.enablePersistence {
		dbSession, err := uss.getSessionFromDB(ctx, sessionID)
		if err == nil {
			// 将数据库中的会话重新加载到Redis（如果仍然活跃）
			if dbSession.GetStatus() == interfaces.SessionStatusActive {
				uss.saveSessionToRedis(ctx, dbSession)
			}
			return dbSession, nil
		}
	}

	return nil, fmt.Errorf("会话不存在: %s", sessionID)
}

// GetActiveSessions 获取用户的活跃会话
func (uss *UnifiedSessionService) GetActiveSessions(ctx context.Context, userID uint) ([]interfaces.SessionInfo, error) {
	// 从Redis获取用户的活跃会话
	pattern := fmt.Sprintf("session:user:%d:*", userID)
	keys, err := uss.redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("查询用户会话失败: %v", err)
	}

	var sessions []interfaces.SessionInfo
	for _, key := range keys {
		sessionID := key[len(fmt.Sprintf("session:user:%d:", userID)):]
		session, err := uss.getSessionFromRedis(ctx, sessionID)
		if err != nil {
			continue // 忽略获取失败的会话
		}
		if session.GetStatus() == interfaces.SessionStatusActive {
			sessions = append(sessions, session)
		}
	}

	return sessions, nil
}

// GetSessionsByQuery 根据查询条件获取会话
func (uss *UnifiedSessionService) GetSessionsByQuery(ctx context.Context, query *interfaces.SessionQuery) ([]interfaces.SessionInfo, int64, error) {
	var sessions []interfaces.SessionInfo
	var total int64

	if uss.enablePersistence {
		// 从数据库查询
		dbSessions, count, err := uss.querySessionsFromDB(ctx, query)
		if err != nil {
			return nil, 0, err
		}
		
		for _, dbSession := range dbSessions {
			sessions = append(sessions, dbSession)
		}
		total = count
	} else {
		// 从Redis查询（简化版本）
		redisSessions, err := uss.querySessionsFromRedis(ctx, query)
		if err != nil {
			return nil, 0, err
		}
		sessions = redisSessions
		total = int64(len(sessions))
	}

	return sessions, total, nil
}

// UpdateSessionActivity 更新会话活动时间
func (uss *UnifiedSessionService) UpdateSessionActivity(ctx context.Context, sessionID string) error {
	// 更新Redis中的会话活动时间
	key := uss.getSessionKey(sessionID)
	now := time.Now()
	
	err := uss.redisClient.HSet(ctx, key, "last_activity", now.Unix()).Err()
	if err != nil {
		return fmt.Errorf("更新会话活动时间失败: %v", err)
	}

	// 延长会话过期时间
	uss.redisClient.Expire(ctx, key, uss.sessionTimeout)

	return nil
}

// CloseSession 关闭会话
func (uss *UnifiedSessionService) CloseSession(ctx context.Context, sessionID string) error {
	// 获取会话信息
	session, err := uss.GetSession(ctx, sessionID)
	if err != nil {
		return err
	}

	sessionRecord := session.(*SessionRecord)
	sessionRecord.Status = interfaces.SessionStatusClosed
	now := time.Now()
	sessionRecord.EndTime = &now

	// 更新Redis
	if err := uss.saveSessionToRedis(ctx, sessionRecord); err != nil {
		log.Printf("更新Redis会话状态失败: %v", err)
	}

	// 更新数据库
	if uss.enablePersistence {
		if err := uss.updateSessionInDB(ctx, sessionRecord); err != nil {
			log.Printf("更新数据库会话状态失败: %v", err)
		}
	}

	// 从Redis活跃会话列表中移除
	uss.removeSessionFromRedis(ctx, sessionID)

	// 记录审计日志
	if uss.auditLogger != nil {
		uss.auditLogger.LogSessionEnd(ctx, sessionID, "正常关闭")
	}

	// 发送通知
	if uss.notifier != nil {
		uss.notifier.NotifySessionEnd(ctx, sessionRecord)
	}

	log.Printf("会话关闭成功: SessionID=%s", sessionID)
	return nil
}

// CloseUserSessions 关闭用户所有会话
func (uss *UnifiedSessionService) CloseUserSessions(ctx context.Context, userID uint) error {
	sessions, err := uss.GetActiveSessions(ctx, userID)
	if err != nil {
		return err
	}

	var errors []string
	for _, session := range sessions {
		if err := uss.CloseSession(ctx, session.GetSessionID()); err != nil {
			errors = append(errors, err.Error())
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("关闭部分会话失败: %v", errors)
	}

	return nil
}

// CloseAssetSessions 关闭资产所有会话
func (uss *UnifiedSessionService) CloseAssetSessions(ctx context.Context, assetID uint) error {
	// 查询资产的所有活跃会话
	query := &interfaces.SessionQuery{
		AssetID: &assetID,
		Status:  interfaces.SessionStatusActive,
	}

	sessions, _, err := uss.GetSessionsByQuery(ctx, query)
	if err != nil {
		return err
	}

	var errors []string
	for _, session := range sessions {
		if err := uss.CloseSession(ctx, session.GetSessionID()); err != nil {
			errors = append(errors, err.Error())
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("关闭部分会话失败: %v", errors)
	}

	return nil
}

// GetSessionCount 获取会话数量
func (uss *UnifiedSessionService) GetSessionCount(ctx context.Context, userID *uint) (int64, error) {
	if userID != nil {
		sessions, err := uss.GetActiveSessions(ctx, *userID)
		return int64(len(sessions)), err
	}

	// 获取所有活跃会话数量
	pattern := "session:active:*"
	keys, err := uss.redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, err
	}

	return int64(len(keys)), nil
}

// MarkSessionActive 标记会话为活跃
func (uss *UnifiedSessionService) MarkSessionActive(ctx context.Context, sessionID string) error {
	key := uss.getSessionKey(sessionID)
	err := uss.redisClient.HSet(ctx, key, "status", interfaces.SessionStatusActive).Err()
	if err != nil {
		return err
	}

	// 添加到活跃会话集合
	uss.redisClient.SAdd(ctx, "session:active", sessionID)
	return nil
}

// MarkSessionInactive 标记会话为非活跃
func (uss *UnifiedSessionService) MarkSessionInactive(ctx context.Context, sessionID string) error {
	key := uss.getSessionKey(sessionID)
	err := uss.redisClient.HSet(ctx, key, "status", interfaces.SessionStatusInactive).Err()
	if err != nil {
		return err
	}

	// 从活跃会话集合中移除
	uss.redisClient.SRem(ctx, "session:active", sessionID)
	return nil
}

// GetInactiveSessions 获取非活跃会话
func (uss *UnifiedSessionService) GetInactiveSessions(ctx context.Context, timeout time.Duration) ([]interfaces.SessionInfo, error) {
	cutoffTime := time.Now().Add(-timeout)
	var inactiveSessions []interfaces.SessionInfo

	// 查询所有活跃会话
	activeSessionIDs, err := uss.redisClient.SMembers(ctx, "session:active").Result()
	if err != nil {
		return nil, err
	}

	for _, sessionID := range activeSessionIDs {
		session, err := uss.getSessionFromRedis(ctx, sessionID)
		if err != nil {
			continue
		}

		if session.GetLastActivity().Before(cutoffTime) {
			inactiveSessions = append(inactiveSessions, session)
		}
	}

	return inactiveSessions, nil
}

// CleanupExpiredSessions 清理过期会话
func (uss *UnifiedSessionService) CleanupExpiredSessions(ctx context.Context) error {
	inactiveSessions, err := uss.GetInactiveSessions(ctx, uss.sessionTimeout)
	if err != nil {
		return err
	}

	for _, session := range inactiveSessions {
		sessionRecord := session.(*SessionRecord)
		sessionRecord.Status = interfaces.SessionStatusTimeout
		sessionRecord.CloseReason = "会话超时"
		now := time.Now()
		sessionRecord.EndTime = &now

		// 更新会话状态
		uss.saveSessionToRedis(ctx, sessionRecord)
		if uss.enablePersistence {
			uss.updateSessionInDB(ctx, sessionRecord)
		}

		// 从活跃会话中移除
		uss.removeSessionFromRedis(ctx, session.GetSessionID())

		// 发送超时通知
		if uss.notifier != nil {
			uss.notifier.NotifySessionTimeout(ctx, session)
		}

		log.Printf("会话超时清理: SessionID=%s", session.GetSessionID())
	}

	log.Printf("清理了 %d 个过期会话", len(inactiveSessions))
	return nil
}

// ForceCloseSession 强制关闭会话
func (uss *UnifiedSessionService) ForceCloseSession(ctx context.Context, sessionID string, reason string) error {
	session, err := uss.GetSession(ctx, sessionID)
	if err != nil {
		return err
	}

	sessionRecord := session.(*SessionRecord)
	sessionRecord.Status = interfaces.SessionStatusClosed
	sessionRecord.CloseReason = reason
	now := time.Now()
	sessionRecord.EndTime = &now

	// 更新状态
	uss.saveSessionToRedis(ctx, sessionRecord)
	if uss.enablePersistence {
		uss.updateSessionInDB(ctx, sessionRecord)
	}

	// 移除活跃会话
	uss.removeSessionFromRedis(ctx, sessionID)

	// 记录审计日志
	if uss.auditLogger != nil {
		uss.auditLogger.LogSessionEnd(ctx, sessionID, reason)
	}

	log.Printf("强制关闭会话: SessionID=%s, 原因=%s", sessionID, reason)
	return nil
}

// 内部辅助方法

// generateSessionID 生成会话ID
func (uss *UnifiedSessionService) generateSessionID(userID, assetID uint) string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("session_%d_%d_%d", userID, assetID, timestamp)
}

// getSessionKey 获取Redis会话键
func (uss *UnifiedSessionService) getSessionKey(sessionID string) string {
	return fmt.Sprintf("session:data:%s", sessionID)
}

// getUserSessionKey 获取用户会话键
func (uss *UnifiedSessionService) getUserSessionKey(userID uint, sessionID string) string {
	return fmt.Sprintf("session:user:%d:%s", userID, sessionID)
}

// checkSessionLimit 检查用户会话数量限制
func (uss *UnifiedSessionService) checkSessionLimit(ctx context.Context, userID uint) error {
	activeSessions, err := uss.GetActiveSessions(ctx, userID)
	if err != nil {
		return err
	}

	if len(activeSessions) >= uss.maxSessions {
		return fmt.Errorf("用户会话数量超过限制 %d", uss.maxSessions)
	}

	return nil
}

// saveSessionToRedis 保存会话到Redis
func (uss *UnifiedSessionService) saveSessionToRedis(ctx context.Context, session *SessionRecord) error {
	sessionData, err := json.Marshal(session)
	if err != nil {
		return err
	}

	// 保存会话数据
	key := uss.getSessionKey(session.SessionID)
	err = uss.redisClient.Set(ctx, key, sessionData, uss.sessionTimeout).Err()
	if err != nil {
		return err
	}

	// 添加用户会话索引
	userKey := uss.getUserSessionKey(session.UserID, session.SessionID)
	uss.redisClient.Set(ctx, userKey, session.SessionID, uss.sessionTimeout)

	// 添加到活跃会话集合
	if session.Status == interfaces.SessionStatusActive {
		uss.redisClient.SAdd(ctx, "session:active", session.SessionID)
	}

	return nil
}

// getSessionFromRedis 从Redis获取会话
func (uss *UnifiedSessionService) getSessionFromRedis(ctx context.Context, sessionID string) (*SessionRecord, error) {
	key := uss.getSessionKey(sessionID)
	data, err := uss.redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var session SessionRecord
	err = json.Unmarshal([]byte(data), &session)
	if err != nil {
		return nil, err
	}

	return &session, nil
}

// removeSessionFromRedis 从Redis移除会话
func (uss *UnifiedSessionService) removeSessionFromRedis(ctx context.Context, sessionID string) {
	// 获取会话信息以获取userID
	session, err := uss.getSessionFromRedis(ctx, sessionID)
	if err == nil {
		// 删除用户会话索引
		userKey := uss.getUserSessionKey(session.UserID, sessionID)
		uss.redisClient.Del(ctx, userKey)
	}

	// 删除会话数据
	key := uss.getSessionKey(sessionID)
	uss.redisClient.Del(ctx, key)

	// 从活跃会话集合中移除
	uss.redisClient.SRem(ctx, "session:active", sessionID)
}

// 数据库操作方法（如果启用持久化）
func (uss *UnifiedSessionService) saveSessionToDB(ctx context.Context, session *SessionRecord) error {
	if uss.db == nil {
		return nil
	}

	dbSession := &models.SessionRecord{
		SessionID:     session.SessionID,
		AssetID:       session.AssetID,
		UserID:        session.UserID,
		Username:      session.Username,
		AssetName:     session.AssetName,
		AssetAddress:  session.AssetHost,
		CredentialID:  1, // 临时设置，实际需要传入
		Protocol:      "ssh", // 临时设置，实际需要传入
		IP:            session.ClientIP,
		Status:        session.Status,
		StartTime:     session.StartTime,
	}

	return uss.db.Create(dbSession).Error
}

func (uss *UnifiedSessionService) updateSessionInDB(ctx context.Context, session *SessionRecord) error {
	if uss.db == nil {
		return nil
	}

	updates := map[string]interface{}{
		"status": session.Status,
	}

	if session.EndTime != nil {
		updates["end_time"] = *session.EndTime
		// 计算持续时间
		duration := session.EndTime.Sub(session.StartTime).Seconds()
		updates["duration"] = int64(duration)
	}

	return uss.db.Model(&models.SessionRecord{}).
		Where("session_id = ?", session.SessionID).
		Updates(updates).Error
}

func (uss *UnifiedSessionService) getSessionFromDB(ctx context.Context, sessionID string) (*SessionRecord, error) {
	if uss.db == nil {
		return nil, fmt.Errorf("数据库未配置")
	}

	var dbSession models.SessionRecord
	err := uss.db.Where("session_id = ?", sessionID).First(&dbSession).Error
	if err != nil {
		return nil, err
	}

	session := &SessionRecord{
		SessionID:    dbSession.SessionID,
		AssetID:      dbSession.AssetID,
		UserID:       dbSession.UserID,
		Status:       dbSession.Status,
		StartTime:    dbSession.StartTime,
		LastActivity: dbSession.StartTime, // 使用StartTime作为LastActivity
		ClientIP:     dbSession.IP,
		AssetName:    dbSession.AssetName,
		AssetHost:    dbSession.AssetAddress,
		Username:     dbSession.Username,
	}

	if dbSession.EndTime != nil {
		session.EndTime = dbSession.EndTime
	}

	return session, nil
}

func (uss *UnifiedSessionService) querySessionsFromDB(ctx context.Context, query *interfaces.SessionQuery) ([]*SessionRecord, int64, error) {
	if uss.db == nil {
		return nil, 0, fmt.Errorf("数据库未配置")
	}

	db := uss.db.Model(&models.SessionRecord{})

	// 添加查询条件
	if query.UserID != nil {
		db = db.Where("user_id = ?", *query.UserID)
	}
	if query.AssetID != nil {
		db = db.Where("asset_id = ?", *query.AssetID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.StartTime != nil {
		db = db.Where("start_time >= ?", *query.StartTime)
	}
	if query.EndTime != nil {
		db = db.Where("start_time <= ?", *query.EndTime)
	}

	// 获取总数
	var total int64
	db.Count(&total)

	// 分页查询
	if query.Page > 0 && query.PageSize > 0 {
		offset := (query.Page - 1) * query.PageSize
		db = db.Offset(offset).Limit(query.PageSize)
	}

	var dbSessions []models.SessionRecord
	err := db.Find(&dbSessions).Error
	if err != nil {
		return nil, 0, err
	}

	// 转换为SessionRecord
	var sessions []*SessionRecord
	for _, dbSession := range dbSessions {
		session := &SessionRecord{
			SessionID:    dbSession.SessionID,
			AssetID:      dbSession.AssetID,
			UserID:       dbSession.UserID,
			Status:       dbSession.Status,
			StartTime:    dbSession.StartTime,
			LastActivity: dbSession.StartTime, // 使用StartTime作为LastActivity
			ClientIP:     dbSession.IP,
			AssetName:    dbSession.AssetName,
			AssetHost:    dbSession.AssetAddress,
			Username:     dbSession.Username,
		}
		if dbSession.EndTime != nil {
			session.EndTime = dbSession.EndTime
		}
		sessions = append(sessions, session)
	}

	return sessions, total, nil
}

func (uss *UnifiedSessionService) querySessionsFromRedis(ctx context.Context, query *interfaces.SessionQuery) ([]interfaces.SessionInfo, error) {
	// 简化的Redis查询实现
	var sessions []interfaces.SessionInfo

	if query.UserID != nil {
		// 查询特定用户的会话
		userSessions, err := uss.GetActiveSessions(ctx, *query.UserID)
		if err != nil {
			return nil, err
		}
		sessions = userSessions
	} else {
		// 查询所有活跃会话
		activeSessionIDs, err := uss.redisClient.SMembers(ctx, "session:active").Result()
		if err != nil {
			return nil, err
		}

		for _, sessionID := range activeSessionIDs {
			session, err := uss.getSessionFromRedis(ctx, sessionID)
			if err != nil {
				continue
			}
			sessions = append(sessions, session)
		}
	}

	// 应用其他过滤条件
	var filteredSessions []interfaces.SessionInfo
	for _, session := range sessions {
		if query.AssetID != nil && session.GetAssetID() != *query.AssetID {
			continue
		}
		if query.Status != "" && session.GetStatus() != query.Status {
			continue
		}
		filteredSessions = append(filteredSessions, session)
	}

	return filteredSessions, nil
}

// startCleanupTask 启动后台清理任务
func (uss *UnifiedSessionService) startCleanupTask() {
	ticker := time.NewTicker(uss.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx := context.Background()
			if err := uss.CleanupExpiredSessions(ctx); err != nil {
				log.Printf("清理过期会话失败: %v", err)
			}
		}
	}
}