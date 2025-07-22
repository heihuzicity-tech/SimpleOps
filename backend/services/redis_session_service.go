package services

import (
	"bastion/config"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

// RedisSessionService Redis会话管理服务
type RedisSessionService struct {
	client *redis.Client
	ctx    context.Context
}

// RedisSessionData Redis中存储的会话数据
type RedisSessionData struct {
	SessionID    string    `json:"session_id"`
	UserID       uint      `json:"user_id"`
	Username     string    `json:"username"`
	AssetID      uint      `json:"asset_id"`
	AssetName    string    `json:"asset_name"`
	AssetAddress string    `json:"asset_address"`
	CredentialID uint      `json:"credential_id"`
	Protocol     string    `json:"protocol"`
	Status       string    `json:"status"`
	StartTime    time.Time `json:"start_time"`
	LastActive   time.Time `json:"last_active"`
	TTL          int       `json:"ttl"` // 秒
}

// NewRedisSessionService 创建Redis会话服务
func NewRedisSessionService() *RedisSessionService {
	rdb := redis.NewClient(&redis.Options{
		Addr:         config.GlobalConfig.Redis.GetRedisAddr(),
		Password:     config.GlobalConfig.Redis.Password,
		DB:           config.GlobalConfig.Redis.DB,
		PoolSize:     config.GlobalConfig.Redis.PoolSize,
		MinIdleConns: config.GlobalConfig.Redis.MinIdleConns,
	})

	ctx := context.Background()

	// 测试连接
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		logrus.WithError(err).Error("Failed to connect to Redis")
		return nil
	}

	logrus.Info("Redis session service initialized successfully")
	return &RedisSessionService{
		client: rdb,
		ctx:    ctx,
	}
}

// CreateSession 创建会话
func (r *RedisSessionService) CreateSession(sessionData *RedisSessionData) error {
	key := r.getSessionKey(sessionData.SessionID)
	
	// 设置TTL
	if sessionData.TTL == 0 {
		sessionData.TTL = config.GlobalConfig.Session.Timeout
	}
	
	sessionData.StartTime = time.Now()
	sessionData.LastActive = time.Now()
	sessionData.Status = "active"

	data, err := json.Marshal(sessionData)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}

	// 存储到Redis并设置过期时间
	err = r.client.Set(r.ctx, key, data, time.Duration(sessionData.TTL)*time.Second).Err()
	if err != nil {
		return fmt.Errorf("failed to store session in Redis: %w", err)
	}

	// 同时添加到活跃会话集合中
	activeKey := "bastion:active_sessions"
	err = r.client.SAdd(r.ctx, activeKey, sessionData.SessionID).Err()
	if err != nil {
		logrus.WithError(err).Error("Failed to add session to active set")
	}

	logrus.WithFields(logrus.Fields{
		"session_id": sessionData.SessionID,
		"user_id":    sessionData.UserID,
		"asset_name": sessionData.AssetName,
		"ttl":        sessionData.TTL,
	}).Info("Session created in Redis")

	return nil
}

// GetSession 获取会话
func (r *RedisSessionService) GetSession(sessionID string) (*RedisSessionData, error) {
	key := r.getSessionKey(sessionID)
	
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session from Redis: %w", err)
	}

	var sessionData RedisSessionData
	err = json.Unmarshal([]byte(data), &sessionData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal session data: %w", err)
	}

	return &sessionData, nil
}

// UpdateSessionActivity 更新会话活动时间
func (r *RedisSessionService) UpdateSessionActivity(sessionID string) error {
	key := r.getSessionKey(sessionID)
	
	// 获取当前会话数据
	sessionData, err := r.GetSession(sessionID)
	if err != nil {
		return err
	}

	// 更新最后活动时间
	sessionData.LastActive = time.Now()

	// 重新存储
	data, err := json.Marshal(sessionData)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}

	// 保持原有的TTL
	ttl := r.client.TTL(r.ctx, key).Val()
	err = r.client.Set(r.ctx, key, data, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to update session in Redis: %w", err)
	}

	return nil
}

// GetActiveSessions 获取所有活跃会话
func (r *RedisSessionService) GetActiveSessions() ([]*RedisSessionData, error) {
	activeKey := "bastion:active_sessions"
	
	// 获取所有活跃会话ID
	sessionIDs, err := r.client.SMembers(r.ctx, activeKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get active session IDs: %w", err)
	}

	var sessions []*RedisSessionData
	for _, sessionID := range sessionIDs {
		sessionData, err := r.GetSession(sessionID)
		if err != nil {
			// 如果会话不存在，从活跃集合中移除
			r.client.SRem(r.ctx, activeKey, sessionID)
			continue
		}
		sessions = append(sessions, sessionData)
	}

	return sessions, nil
}

// GetActiveSessionsByUser 获取用户的活跃会话
func (r *RedisSessionService) GetActiveSessionsByUser(userID uint) ([]*RedisSessionData, error) {
	allSessions, err := r.GetActiveSessions()
	if err != nil {
		return nil, err
	}

	var userSessions []*RedisSessionData
	for _, session := range allSessions {
		if session.UserID == userID {
			userSessions = append(userSessions, session)
		}
	}

	return userSessions, nil
}

// CloseSession 关闭会话
func (r *RedisSessionService) CloseSession(sessionID string, reason string) error {
	return r.CloseSessionWithVerification(sessionID, reason, true)
}

// CloseSessionWithVerification 带验证的会话关闭
func (r *RedisSessionService) CloseSessionWithVerification(sessionID string, reason string, verify bool) error {
	logrus.WithFields(logrus.Fields{
		"session_id": sessionID,
		"reason":     reason,
		"verify":     verify,
	}).Info("开始关闭Redis会话")
	
	// Step 1: 获取会话信息用于清理
	sessionData, err := r.getSessionForCleanup(sessionID)
	if err != nil && verify {
		return fmt.Errorf("failed to get session info for cleanup: %w", err)
	}
	
	// Step 2: 使用Redis事务确保原子性
	txf := func(tx *redis.Tx) error {
		// 在事务中监视会话键
		sessionKey := r.getSessionKey(sessionID)
		
		// 开始管道操作
		pipe := tx.TxPipeline()
		
		// 删除主会话数据
		pipe.Del(r.ctx, sessionKey)
		
		// 从活跃会话集合中删除
		activeSetKey := "bastion:active_sessions"
		pipe.SRem(r.ctx, activeSetKey, sessionID)
		
		// 删除用户-会话索引（如果有的话）
		if sessionData != nil {
			userSessionKey := fmt.Sprintf("session:user:%d:%s", sessionData.UserID, sessionID)
			pipe.Del(r.ctx, userSessionKey)
		}
		
		// 执行管道
		_, err := pipe.Exec(r.ctx)
		return err
	}
	
	// 执行事务，最多重试3次
	for i := 0; i < 3; i++ {
		sessionKey := r.getSessionKey(sessionID)
		err := r.client.Watch(r.ctx, txf, sessionKey)
		
		if err == nil {
			logrus.WithFields(logrus.Fields{
				"session_id": sessionID,
				"attempt":    i + 1,
				"reason":     reason,
			}).Info("成功关闭Redis会话")
			
			// 记录会话关闭日志
			if sessionData != nil {
				logrus.WithFields(logrus.Fields{
					"session_id": sessionID,
					"user_id":    sessionData.UserID,
					"asset_name": sessionData.AssetName,
					"reason":     reason,
					"duration":   time.Since(sessionData.StartTime).Seconds(),
				}).Info("Session closed in Redis with details")
			}
			
			// 验证清理结果
			if verify {
				return r.verifySessionCleanup(sessionID)
			}
			return nil
		}
		
		if err == redis.TxFailedErr {
			logrus.WithField("session_id", sessionID).Warnf("Redis事务冲突，重试关闭会话 (尝试: %d)", i+1)
			continue
		}
		
		logrus.WithError(err).WithField("session_id", sessionID).Errorf("关闭Redis会话失败 (尝试: %d)", i+1)
		
		// 非事务错误，使用强制清理
		if i == 2 {
			logrus.WithField("session_id", sessionID).Warn("所有事务尝试失败，使用强制清理")
			return r.forceCleanupSession(sessionID, sessionData)
		}
	}
	
	return fmt.Errorf("failed to close session after 3 attempts: %s", sessionID)
}

// getSessionForCleanup 获取会话信息用于清理
func (r *RedisSessionService) getSessionForCleanup(sessionID string) (*RedisSessionData, error) {
	sessionData, err := r.GetSession(sessionID)
	if err != nil {
		logrus.WithError(err).WithField("session_id", sessionID).Warn("会话在Redis中不存在，可能已被清理")
		return nil, nil
	}
	
	logrus.WithField("session_id", sessionID).Debug("获取到待清理会话信息")
	return sessionData, nil
}

// verifySessionCleanup 验证会话清理结果
func (r *RedisSessionService) verifySessionCleanup(sessionID string) error {
	// 检查主会话键是否已删除
	sessionKey := r.getSessionKey(sessionID)
	exists, err := r.client.Exists(r.ctx, sessionKey).Result()
	if err != nil {
		return fmt.Errorf("failed to verify session cleanup: %w", err)
	}
	
	if exists > 0 {
		return fmt.Errorf("session still exists in Redis after cleanup: %s", sessionID)
	}
	
	// 检查活跃会话集合
	activeSetKey := "bastion:active_sessions"
	isMember, err := r.client.SIsMember(r.ctx, activeSetKey, sessionID).Result()
	if err != nil {
		logrus.WithError(err).WithField("session_id", sessionID).Warn("无法验证活跃会话集合清理状态")
	} else if isMember {
		logrus.WithField("session_id", sessionID).Warn("会话仍在活跃会话集合中")
	}
	
	logrus.WithField("session_id", sessionID).Info("验证通过: 会话已从Redis中完全清理")
	return nil
}

// forceCleanupSession 强制清理会话（忽略错误）
func (r *RedisSessionService) forceCleanupSession(sessionID string, sessionData *RedisSessionData) error {
	logrus.WithField("session_id", sessionID).Warn("执行强制Redis会话清理")
	
	var errors []string
	
	// 强制删除主会话键
	sessionKey := r.getSessionKey(sessionID)
	if err := r.client.Del(r.ctx, sessionKey).Err(); err != nil {
		errors = append(errors, fmt.Sprintf("删除主会话键失败: %v", err))
	}
	
	// 强制从活跃会话集合中删除
	activeSetKey := "bastion:active_sessions"
	if err := r.client.SRem(r.ctx, activeSetKey, sessionID).Err(); err != nil {
		errors = append(errors, fmt.Sprintf("从活跃集合删除失败: %v", err))
	}
	
	// 强制删除用户索引
	if sessionData != nil {
		userSessionKey := fmt.Sprintf("session:user:%d:%s", sessionData.UserID, sessionID)
		if err := r.client.Del(r.ctx, userSessionKey).Err(); err != nil {
			errors = append(errors, fmt.Sprintf("删除用户索引失败: %v", err))
		}
	}
	
	if len(errors) > 0 {
		logrus.WithField("session_id", sessionID).Warnf("强制清理完成，但有部分错误: %v", errors)
		return fmt.Errorf("partial cleanup errors: %v", errors)
	}
	
	logrus.WithField("session_id", sessionID).Info("强制清理成功")
	return nil
}

// BatchCleanupSessions 批量清理会话
func (r *RedisSessionService) BatchCleanupSessions(sessionIDs []string) map[string]error {
	results := make(map[string]error)
	
	logrus.WithField("count", len(sessionIDs)).Info("开始批量清理Redis会话")
	
	for _, sessionID := range sessionIDs {
		// 使用非验证模式进行批量清理，提高性能
		err := r.CloseSessionWithVerification(sessionID, "batch_cleanup", false)
		results[sessionID] = err
		
		if err != nil {
			logrus.WithError(err).WithField("session_id", sessionID).Error("批量清理失败")
		}
	}
	
	successCount := 0
	for _, err := range results {
		if err == nil {
			successCount++
		}
	}
	
	logrus.WithFields(logrus.Fields{
		"success": successCount,
		"total":   len(sessionIDs),
	}).Info("批量清理完成")
	
	return results
}

// CleanupExpiredSessions 清理过期会话
func (r *RedisSessionService) CleanupExpiredSessions() (int, error) {
	activeKey := "bastion:active_sessions"
	
	// 获取所有活跃会话ID
	sessionIDs, err := r.client.SMembers(r.ctx, activeKey).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get active session IDs: %w", err)
	}

	cleaned := 0
	for _, sessionID := range sessionIDs {
		key := r.getSessionKey(sessionID)
		
		// 检查会话是否还存在
		exists, err := r.client.Exists(r.ctx, key).Result()
		if err != nil {
			continue
		}
		
		if exists == 0 {
			// 会话已过期，从活跃集合中移除
			r.client.SRem(r.ctx, activeKey, sessionID)
			cleaned++
			
			logrus.WithField("session_id", sessionID).Debug("Removed expired session from active set")
		}
	}

	if cleaned > 0 {
		logrus.WithField("cleaned_count", cleaned).Info("Cleaned up expired sessions from Redis")
	}

	return cleaned, nil
}

// ForceCleanupAllSessions 强制清理所有会话
func (r *RedisSessionService) ForceCleanupAllSessions() (int, error) {
	activeKey := "bastion:active_sessions"
	
	// 获取所有活跃会话ID
	sessionIDs, err := r.client.SMembers(r.ctx, activeKey).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get active session IDs: %w", err)
	}

	cleaned := 0
	for _, sessionID := range sessionIDs {
		key := r.getSessionKey(sessionID)
		
		// 删除会话数据
		r.client.Del(r.ctx, key)
		cleaned++
	}

	// 清空活跃会话集合
	r.client.Del(r.ctx, activeKey)

	logrus.WithField("cleaned_count", cleaned).Info("Force cleaned up all sessions from Redis")
	
	return cleaned, nil
}

// GetSessionCount 获取活跃会话数量
func (r *RedisSessionService) GetSessionCount() (int64, error) {
	activeKey := "bastion:active_sessions"
	count, err := r.client.SCard(r.ctx, activeKey).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get session count: %w", err)
	}
	return count, nil
}

// ExtendSessionTTL 延长会话TTL
func (r *RedisSessionService) ExtendSessionTTL(sessionID string, seconds int) error {
	key := r.getSessionKey(sessionID)
	
	err := r.client.Expire(r.ctx, key, time.Duration(seconds)*time.Second).Err()
	if err != nil {
		return fmt.Errorf("failed to extend session TTL: %w", err)
	}

	return nil
}

// getSessionKey 获取会话在Redis中的键
func (r *RedisSessionService) getSessionKey(sessionID string) string {
	return fmt.Sprintf("bastion:session:%s", sessionID)
}

// Close 关闭Redis连接
func (r *RedisSessionService) Close() error {
	if r.client != nil {
		return r.client.Close()
	}
	return nil
}

// StartSessionCleanupTask 启动会话清理任务
// 注意：此功能已禁用，统一由 UnifiedSessionService 处理
func (r *RedisSessionService) StartSessionCleanupTask() {
	logrus.Info("Redis session cleanup 已禁用，统一由 UnifiedSessionService 处理")
	// 不再启动独立的清理任务，避免竞态条件
}