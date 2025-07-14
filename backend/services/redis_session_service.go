package services

import (
	"bastion/config"
	"context"
	"encoding/json"
	"fmt"
	"log"
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
	key := r.getSessionKey(sessionID)
	activeKey := "bastion:active_sessions"

	// 获取会话数据以记录日志
	sessionData, err := r.GetSession(sessionID)
	if err != nil {
		logrus.WithError(err).Warn("Session not found when closing")
	}

	// 删除会话
	err = r.client.Del(r.ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete session from Redis: %w", err)
	}

	// 从活跃集合中移除
	r.client.SRem(r.ctx, activeKey, sessionID)

	if sessionData != nil {
		logrus.WithFields(logrus.Fields{
			"session_id": sessionID,
			"user_id":    sessionData.UserID,
			"asset_name": sessionData.AssetName,
			"reason":     reason,
			"duration":   time.Since(sessionData.StartTime).Seconds(),
		}).Info("Session closed in Redis")
	}

	return nil
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
func (r *RedisSessionService) StartSessionCleanupTask() {
	go func() {
		ticker := time.NewTicker(2 * time.Minute) // 每2分钟清理一次
		defer ticker.Stop()

		log.Printf("Redis session cleanup task started (interval: 2 minutes)")

		for range ticker.C {
			cleaned, err := r.CleanupExpiredSessions()
			if err != nil {
				logrus.WithError(err).Error("Failed to cleanup expired sessions")
			} else if cleaned > 0 {
				logrus.WithField("cleaned", cleaned).Info("Cleanup task completed")
			}
		}
	}()
}