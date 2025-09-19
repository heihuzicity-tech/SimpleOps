package services

import (
	"bastion/config"
	"bastion/models"
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// SessionTimeoutService 会话超时管理服务
type SessionTimeoutService struct {
	db             *gorm.DB
	redisClient    *redis.Client
	ctx            context.Context
	timers         map[string]*time.Timer // 会话超时定时器
	timersMu       sync.RWMutex
	warningTimers  map[string]*time.Timer // 警告定时器
	warningMu      sync.RWMutex
	cleanupTicker  *time.Ticker          // 清理定时器
	stopChan       chan struct{}         // 停止信号
	onTimeout      func(sessionID string) // 超时回调 (已简化，移除警告回调)
	isRunning      bool
	mu             sync.RWMutex
}

// SessionTimeoutStats 超时统计信息
type SessionTimeoutStats struct {
	ActiveSessions    int64 `json:"active_sessions"`
	ExpiredSessions   int64 `json:"expired_sessions"`
	WarningsSent      int64 `json:"warnings_sent"`
	ActiveTimers      int   `json:"active_timers"`
	TotalExtensions   int64 `json:"total_extensions"`
	LastCleanupTime   time.Time `json:"last_cleanup_time"`
}

// NewSessionTimeoutService 创建会话超时服务
func NewSessionTimeoutService(db *gorm.DB) *SessionTimeoutService {
	rdb := redis.NewClient(&redis.Options{
		Addr:         config.GlobalConfig.Redis.GetRedisAddr(),
		Password:     config.GlobalConfig.Redis.Password,
		DB:           config.GlobalConfig.Redis.DB,
		PoolSize:     config.GlobalConfig.Redis.PoolSize,
		MinIdleConns: config.GlobalConfig.Redis.MinIdleConns,
	})

	service := &SessionTimeoutService{
		db:            db,
		redisClient:   rdb,
		ctx:           context.Background(),
		timers:        make(map[string]*time.Timer),
		warningTimers: make(map[string]*time.Timer),
		stopChan:      make(chan struct{}),
	}

	// 测试Redis连接
	_, err := rdb.Ping(service.ctx).Result()
	if err != nil {
		logrus.Errorf("Redis connection failed: %v", err)
	} else {
		logrus.Info("SessionTimeoutService: Redis connected successfully")
	}

	return service
}

// Start 启动超时管理服务
func (s *SessionTimeoutService) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("service is already running")
	}

	s.isRunning = true
	
	// 启动清理定时器，每30秒检查一次
	s.cleanupTicker = time.NewTicker(30 * time.Second)
	
	go s.cleanupRoutine()
	
	logrus.Info("SessionTimeoutService: Service started successfully")
	return nil
}

// Stop 停止超时管理服务
func (s *SessionTimeoutService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return nil
	}

	s.isRunning = false
	
	// 停止清理定时器
	if s.cleanupTicker != nil {
		s.cleanupTicker.Stop()
	}

	// 发送停止信号
	close(s.stopChan)

	// 清理所有定时器
	s.clearAllTimers()

	logrus.Info("SessionTimeoutService: Service stopped")
	return nil
}

// SetTimeoutCallback 设置超时回调函数
func (s *SessionTimeoutService) SetTimeoutCallback(callback func(sessionID string)) {
	s.onTimeout = callback
}

// 🔄 已移除 SetWarningCallback 方法，因为告警功能已简化

// CreateTimeout 创建会话超时配置
func (s *SessionTimeoutService) CreateTimeout(req *models.SessionTimeoutCreateRequest) (*models.SessionTimeout, error) {
	// 检查会话是否已存在超时配置
	existing := &models.SessionTimeout{}
	err := s.db.Where("session_id = ? AND deleted_at IS NULL", req.SessionID).First(existing).Error
	if err == nil {
		return nil, fmt.Errorf("session %s already has timeout configuration", req.SessionID)
	}
	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("database query failed: %w", err)
	}

	// 创建超时配置
	timeout := &models.SessionTimeout{
		SessionID:      req.SessionID,
		TimeoutMinutes: req.TimeoutMinutes,
		Policy:         req.Policy,
		IdleMinutes:    req.IdleMinutes,
		LastActivity:   time.Now(),
		IsActive:       true,
		MaxExtensions:  req.MaxExtensions,
	}

	// 保存到数据库
	if err := s.db.Create(timeout).Error; err != nil {
		return nil, fmt.Errorf("failed to create timeout: %w", err)
	}

	// 保存到Redis缓存
	config := timeout.ToConfig()
	if err := s.saveToRedis(config); err != nil {
		logrus.Warnf("Failed to save timeout config to Redis: %v", err)
	}

	// 启动超时定时器
	s.startTimeoutTimer(timeout)

	logrus.Infof("Created timeout configuration for session %s", req.SessionID)
	return timeout, nil
}

// UpdateTimeout 更新超时配置
func (s *SessionTimeoutService) UpdateTimeout(sessionID string, req *models.SessionTimeoutUpdateRequest) (*models.SessionTimeout, error) {
	// 查找现有配置
	timeout := &models.SessionTimeout{}
	err := s.db.Where("session_id = ? AND deleted_at IS NULL", sessionID).First(timeout).Error
	if err != nil {
		return nil, fmt.Errorf("timeout configuration not found: %w", err)
	}

	// 更新字段
	updates := make(map[string]interface{})
	if req.TimeoutMinutes != nil {
		updates["timeout_minutes"] = *req.TimeoutMinutes
	}
	if req.Policy != nil {
		updates["policy"] = *req.Policy
	}
	if req.IdleMinutes != nil {
		updates["idle_minutes"] = *req.IdleMinutes
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.MaxExtensions != nil {
		updates["max_extensions"] = *req.MaxExtensions
	}
	updates["updated_at"] = time.Now()

	// 执行更新
	if err := s.db.Model(timeout).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update timeout: %w", err)
	}

	// 重新加载更新后的数据
	if err := s.db.Where("session_id = ?", sessionID).First(timeout).Error; err != nil {
		return nil, fmt.Errorf("failed to reload timeout: %w", err)
	}

	// 更新Redis缓存
	config := timeout.ToConfig()
	if err := s.saveToRedis(config); err != nil {
		logrus.Warnf("Failed to update timeout config in Redis: %v", err)
	}

	// 重新启动定时器
	s.restartTimeoutTimer(timeout)

	logrus.Infof("Updated timeout configuration for session %s", sessionID)
	return timeout, nil
}

// GetTimeout 获取超时配置
func (s *SessionTimeoutService) GetTimeout(sessionID string) (*models.SessionTimeout, error) {
	// 先从Redis缓存获取
	config, err := s.getFromRedis(sessionID)
	if err == nil && config != nil {
		timeout := &models.SessionTimeout{}
		timeout.FromConfig(config)
		return timeout, nil
	}

	// Redis获取失败，从数据库获取
	timeout := &models.SessionTimeout{}
	err = s.db.Where("session_id = ? AND deleted_at IS NULL", sessionID).First(timeout).Error
	if err != nil {
		return nil, fmt.Errorf("timeout configuration not found: %w", err)
	}

	// 更新Redis缓存
	config = timeout.ToConfig()
	if err := s.saveToRedis(config); err != nil {
		logrus.Warnf("Failed to cache timeout config to Redis: %v", err)
	}

	return timeout, nil
}

// ExtendTimeout 延长会话超时时间
func (s *SessionTimeoutService) ExtendTimeout(sessionID string, req *models.SessionTimeoutExtendRequest) (*models.SessionTimeout, error) {
	timeout, err := s.GetTimeout(sessionID)
	if err != nil {
		return nil, err
	}

	if !timeout.CanExtend() {
		return nil, fmt.Errorf("session has reached maximum extensions: %d", timeout.MaxExtensions)
	}

	// 执行延期
	if err := timeout.ExtendTimeout(req.ExtendMinutes); err != nil {
		return nil, err
	}

	// 更新数据库
	updates := map[string]interface{}{
		"timeout_minutes":  timeout.TimeoutMinutes,
		"extension_count":  timeout.ExtensionCount,
		"updated_at":       timeout.UpdatedAt,
	}
	
	if err := s.db.Model(timeout).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update timeout extension: %w", err)
	}

	// 更新Redis缓存
	config := timeout.ToConfig()
	if err := s.saveToRedis(config); err != nil {
		logrus.Warnf("Failed to update timeout config in Redis: %v", err)
	}

	// 重新启动定时器
	s.restartTimeoutTimer(timeout)

	logrus.Infof("Extended timeout for session %s by %d minutes", sessionID, req.ExtendMinutes)
	return timeout, nil
}

// UpdateActivity 更新会话活动时间
func (s *SessionTimeoutService) UpdateActivity(sessionID string) error {
	timeout, err := s.GetTimeout(sessionID)
	if err != nil {
		// 如果没有超时配置，直接返回成功
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	// 更新活动时间
	timeout.UpdateActivity()

	// 更新数据库
	if err := s.db.Model(timeout).Update("last_activity", timeout.LastActivity).Error; err != nil {
		logrus.Warnf("Failed to update activity time in database: %v", err)
	}

	// 更新Redis缓存
	config := timeout.ToConfig()
	if err := s.saveToRedis(config); err != nil {
		logrus.Warnf("Failed to update activity time in Redis: %v", err)
	}

	// 对于空闲超时策略，需要重新启动定时器
	if timeout.Policy == models.TimeoutPolicyIdleKick {
		s.restartTimeoutTimer(timeout)
	}

	return nil
}

// DeleteTimeout 删除超时配置
func (s *SessionTimeoutService) DeleteTimeout(sessionID string) error {
	// 软删除数据库记录
	if err := s.db.Where("session_id = ?", sessionID).Delete(&models.SessionTimeout{}).Error; err != nil {
		return fmt.Errorf("failed to delete timeout: %w", err)
	}

	// 删除Redis缓存
	if err := s.deleteFromRedis(sessionID); err != nil {
		logrus.Warnf("Failed to delete timeout config from Redis: %v", err)
	}

	// 停止相关定时器
	s.stopTimers(sessionID)

	logrus.Infof("Deleted timeout configuration for session %s", sessionID)
	return nil
}

// GetStats 获取超时服务统计信息
func (s *SessionTimeoutService) GetStats() (*SessionTimeoutStats, error) {
	var stats SessionTimeoutStats

	// 统计活跃会话数
	err := s.db.Model(&models.SessionTimeout{}).Where("is_active = ? AND deleted_at IS NULL", true).Count(&stats.ActiveSessions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count active sessions: %w", err)
	}

	// 统计过期会话数（今天）
	today := time.Now().Truncate(24 * time.Hour)
	err = s.db.Model(&models.SessionTimeout{}).
		Where("updated_at >= ? AND (timeout_minutes > 0 OR policy != ?)", today, models.TimeoutPolicyUnlimited).
		Count(&stats.ExpiredSessions).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count expired sessions: %w", err)
	}

	// 统计警告发送数
	var warningsResult struct {
		Total int64 `json:"total"`
	}
	err = s.db.Model(&models.SessionTimeout{}).
		Where("warnings_sent > 0 AND DATE(updated_at) = ?", today.Format("2006-01-02")).
		Select("COALESCE(SUM(warnings_sent), 0) as total").
		Scan(&warningsResult).Error
	if err != nil {
		logrus.Warnf("Failed to count warnings sent: %v", err)
	} else {
		stats.WarningsSent = warningsResult.Total
	}

	// 统计延期总数
	var extensionsResult struct {
		Total int64 `json:"total"`
	}
	err = s.db.Model(&models.SessionTimeout{}).
		Where("extension_count > 0").
		Select("COALESCE(SUM(extension_count), 0) as total").
		Scan(&extensionsResult).Error
	if err != nil {
		logrus.Warnf("Failed to count total extensions: %v", err)
	} else {
		stats.TotalExtensions = extensionsResult.Total
	}

	// 统计活跃定时器数量
	s.timersMu.RLock()
	stats.ActiveTimers = len(s.timers)
	s.timersMu.RUnlock()

	stats.LastCleanupTime = time.Now()

	return &stats, nil
}

// 内部方法 - Redis操作
func (s *SessionTimeoutService) saveToRedis(config *models.SessionTimeoutConfig) error {
	key := config.RedisKey()
	data, err := config.MarshalBinary()
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// 设置过期时间为超时时间的2倍，确保不会过早过期
	expiration := time.Duration(config.TimeoutMinutes*2) * time.Minute
	if expiration == 0 {
		expiration = 24 * time.Hour // 无限制会话默认24小时过期
	}

	return s.redisClient.Set(s.ctx, key, data, expiration).Err()
}

func (s *SessionTimeoutService) getFromRedis(sessionID string) (*models.SessionTimeoutConfig, error) {
	key := fmt.Sprintf("session_timeout:%s", sessionID)
	data, err := s.redisClient.Get(s.ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}

	config := &models.SessionTimeoutConfig{}
	if err := config.UnmarshalBinary(data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return config, nil
}

func (s *SessionTimeoutService) deleteFromRedis(sessionID string) error {
	key := fmt.Sprintf("session_timeout:%s", sessionID)
	return s.redisClient.Del(s.ctx, key).Err()
}

// 内部方法 - 定时器管理
func (s *SessionTimeoutService) startTimeoutTimer(timeout *models.SessionTimeout) {
	if timeout.IsUnlimited() || !timeout.IsActive {
		return
	}

	s.stopTimers(timeout.SessionID) // 先停止现有定时器

	remaining := timeout.GetRemainingMinutes()
	if remaining <= 0 {
		// 已经超时，立即处理
		s.handleTimeout(timeout.SessionID)
		return
	}

	// 启动超时定时器
	s.timersMu.Lock()
	s.timers[timeout.SessionID] = time.AfterFunc(
		time.Duration(remaining)*time.Minute,
		func() { s.handleTimeout(timeout.SessionID) },
	)
	s.timersMu.Unlock()

	// 🔄 已移除警告定时器功能

	logrus.Debugf("Started timeout timer for session %s, remaining: %d minutes", timeout.SessionID, remaining)
}

// 🔄 已移除 startWarningTimers 方法，因为告警功能已简化

func (s *SessionTimeoutService) restartTimeoutTimer(timeout *models.SessionTimeout) {
	s.startTimeoutTimer(timeout)
}

func (s *SessionTimeoutService) stopTimers(sessionID string) {
	// 停止超时定时器
	s.timersMu.Lock()
	if timer, exists := s.timers[sessionID]; exists {
		timer.Stop()
		delete(s.timers, sessionID)
	}
	s.timersMu.Unlock()

	// 停止警告定时器
	s.warningMu.Lock()
	for key, timer := range s.warningTimers {
		if len(key) > len(sessionID) && key[:len(sessionID)] == sessionID {
			timer.Stop()
			delete(s.warningTimers, key)
		}
	}
	s.warningMu.Unlock()
}

func (s *SessionTimeoutService) clearAllTimers() {
	s.timersMu.Lock()
	for sessionID, timer := range s.timers {
		timer.Stop()
		delete(s.timers, sessionID)
	}
	s.timersMu.Unlock()

	s.warningMu.Lock()
	for key, timer := range s.warningTimers {
		timer.Stop()
		delete(s.warningTimers, key)
	}
	s.warningMu.Unlock()
}

// 内部方法 - 事件处理
func (s *SessionTimeoutService) handleTimeout(sessionID string) {
	logrus.Infof("Session %s has timed out", sessionID)

	// 更新数据库状态
	updates := map[string]interface{}{
		"is_active":    false,
		"updated_at":   time.Now(),
	}
	s.db.Model(&models.SessionTimeout{}).Where("session_id = ?", sessionID).Updates(updates)

	// 删除Redis缓存
	s.deleteFromRedis(sessionID)

	// 停止定时器
	s.stopTimers(sessionID)

	// 调用超时回调
	if s.onTimeout != nil {
		s.onTimeout(sessionID)
	}
}

// 🔄 已移除 handleWarning 方法，因为告警功能已简化

// 内部方法 - 清理routine
func (s *SessionTimeoutService) cleanupRoutine() {
	for {
		select {
		case <-s.cleanupTicker.C:
			s.cleanupExpiredSessions()
		case <-s.stopChan:
			return
		}
	}
}

func (s *SessionTimeoutService) cleanupExpiredSessions() {
	// 查找所有过期的会话
	var timeouts []models.SessionTimeout
	err := s.db.Where("is_active = ? AND deleted_at IS NULL", true).Find(&timeouts).Error
	if err != nil {
		logrus.Errorf("Failed to query timeout configurations: %v", err)
		return
	}

	expiredCount := 0
	for _, timeout := range timeouts {
		if timeout.IsExpired() {
			s.handleTimeout(timeout.SessionID)
			expiredCount++
		}
	}

	if expiredCount > 0 {
		logrus.Infof("Cleaned up %d expired sessions", expiredCount)
	}
}