package utils

import (
	"context"
	"sync"
	"time"
	"log"
)

// SessionResources 管理单个会话的所有资源
type SessionResources struct {
	mu             sync.Mutex
	sessionID      string
	ctx            context.Context
	cancel         context.CancelFunc
	resources      []Resource
	closed         bool
	closeOnce      sync.Once
	createdAt      time.Time
	lastActivityAt time.Time
	timers         []*time.Timer
}

// Resource 表示需要清理的资源
type Resource interface {
	Close() error
	Name() string
}

// ResourceFunc 函数类型的资源
type ResourceFunc struct {
	name      string
	closeFunc func() error
}

func (r *ResourceFunc) Close() error {
	return r.closeFunc()
}

func (r *ResourceFunc) Name() string {
	return r.name
}

// NewResourceFunc 创建函数类型的资源
func NewResourceFunc(name string, closeFunc func() error) Resource {
	return &ResourceFunc{
		name:      name,
		closeFunc: closeFunc,
	}
}

// SessionResourceManager 管理所有会话的资源
type SessionResourceManager struct {
	mu            sync.RWMutex
	sessions      map[string]*SessionResources
	cleanupTicker *time.Ticker
	cleanupStop   chan struct{}
	maxIdleTime   time.Duration
}

// NewSessionResourceManager 创建会话资源管理器
func NewSessionResourceManager() *SessionResourceManager {
	m := &SessionResourceManager{
		sessions:    make(map[string]*SessionResources),
		cleanupStop: make(chan struct{}),
		maxIdleTime: 30 * time.Minute, // 默认30分钟空闲超时
	}
	// 启动定期清理
	m.StartCleanup()
	return m
}

// CreateSession 为新会话创建资源管理器
func (m *SessionResourceManager) CreateSession(sessionID string) (*SessionResources, context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 如果会话已存在，先清理旧的
	if old, exists := m.sessions[sessionID]; exists {
		old.Close()
		delete(m.sessions, sessionID)
	}

	ctx, cancel := context.WithCancel(context.Background())
	session := &SessionResources{
		sessionID:      sessionID,
		ctx:            ctx,
		cancel:         cancel,
		resources:      make([]Resource, 0),
		timers:         make([]*time.Timer, 0),
		createdAt:      time.Now(),
		lastActivityAt: time.Now(),
	}

	m.sessions[sessionID] = session
	
	// 启动资源监控goroutine
	go session.monitor()
	
	return session, ctx
}

// GetSession 获取会话资源管理器
func (m *SessionResourceManager) GetSession(sessionID string) (*SessionResources, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	session, exists := m.sessions[sessionID]
	return session, exists
}

// RemoveSession 移除并清理会话
func (m *SessionResourceManager) RemoveSession(sessionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if session, exists := m.sessions[sessionID]; exists {
		session.Close()
		delete(m.sessions, sessionID)
	}
}

// CloseAll 关闭所有会话
func (m *SessionResourceManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	for sessionID, session := range m.sessions {
		session.Close()
		delete(m.sessions, sessionID)
	}
}

// AddResource 添加需要管理的资源
func (s *SessionResources) AddResource(resource Resource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.closed {
		// 如果会话已关闭，立即关闭新资源
		if err := resource.Close(); err != nil {
			log.Printf("Failed to close resource %s for closed session %s: %v", 
				resource.Name(), s.sessionID, err)
		}
		return
	}
	
	s.resources = append(s.resources, resource)
}

// AddCloseFunc 添加清理函数
func (s *SessionResources) AddCloseFunc(name string, closeFunc func() error) {
	s.AddResource(NewResourceFunc(name, closeFunc))
}

// Context 返回会话的context
func (s *SessionResources) Context() context.Context {
	return s.ctx
}

// Close 关闭会话的所有资源
func (s *SessionResources) Close() {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		
		s.closed = true
		
		// 取消context
		if s.cancel != nil {
			s.cancel()
		}
		
		// 停止所有定时器
		for _, timer := range s.timers {
			timer.Stop()
		}
		s.timers = nil
		
		// 倒序关闭资源（后添加的先关闭）
		for i := len(s.resources) - 1; i >= 0; i-- {
			resource := s.resources[i]
			if err := resource.Close(); err != nil {
				log.Printf("Failed to close resource %s for session %s: %v",
					resource.Name(), s.sessionID, err)
			}
		}
		
		// 清空资源列表
		s.resources = nil
		
		log.Printf("Session resources cleaned up for session %s", s.sessionID)
	})
}

// monitor 监控会话context，当context被取消时自动清理资源
func (s *SessionResources) monitor() {
	<-s.ctx.Done()
	s.Close()
}

// WaitForClose 等待会话关闭，带超时
func (s *SessionResources) WaitForClose(timeout time.Duration) bool {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	
	select {
	case <-s.ctx.Done():
		return true
	case <-timer.C:
		return false
	}
}

// IsClosed 检查会话是否已关闭
func (s *SessionResources) IsClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

// ResourceCount 获取资源数量
func (s *SessionResources) ResourceCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.resources)
}

// UpdateActivity 更新活动时间
func (s *SessionResources) UpdateActivity() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastActivityAt = time.Now()
}

// AddTimer 添加定时器资源
func (s *SessionResources) AddTimer(timer *time.Timer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.closed {
		timer.Stop()
		return
	}
	
	s.timers = append(s.timers, timer)
}

// GetIdleTime 获取空闲时间
func (s *SessionResources) GetIdleTime() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Since(s.lastActivityAt)
}

// StartCleanup 启动定期清理
func (m *SessionResourceManager) StartCleanup() {
	m.cleanupTicker = time.NewTicker(5 * time.Minute)
	go func() {
		for {
			select {
			case <-m.cleanupTicker.C:
				m.cleanupExpiredSessions()
			case <-m.cleanupStop:
				m.cleanupTicker.Stop()
				return
			}
		}
	}()
}

// StopCleanup 停止定期清理
func (m *SessionResourceManager) StopCleanup() {
	close(m.cleanupStop)
}

// cleanupExpiredSessions 清理过期会话
func (m *SessionResourceManager) cleanupExpiredSessions() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	expiredSessions := make([]string, 0)
	
	for sessionID, session := range m.sessions {
		idleTime := session.GetIdleTime()
		if idleTime > m.maxIdleTime {
			expiredSessions = append(expiredSessions, sessionID)
		}
	}
	
	// 清理过期会话
	for _, sessionID := range expiredSessions {
		if session, exists := m.sessions[sessionID]; exists {
			log.Printf("Cleaning up expired session %s (idle for %v)", sessionID, session.GetIdleTime())
			session.Close()
			delete(m.sessions, sessionID)
		}
	}
	
	if len(expiredSessions) > 0 {
		log.Printf("Cleaned up %d expired sessions", len(expiredSessions))
	}
}

// SetMaxIdleTime 设置最大空闲时间
func (m *SessionResourceManager) SetMaxIdleTime(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.maxIdleTime = duration
}

// GetSessionCount 获取活跃会话数量
func (m *SessionResourceManager) GetSessionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// GetSessionStats 获取会话统计信息
func (m *SessionResourceManager) GetSessionStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	stats := make(map[string]interface{})
	stats["total_sessions"] = len(m.sessions)
	
	var totalResources int
	var oldestSession time.Time
	var newestSession time.Time
	
	for _, session := range m.sessions {
		totalResources += session.ResourceCount()
		
		if oldestSession.IsZero() || session.createdAt.Before(oldestSession) {
			oldestSession = session.createdAt
		}
		
		if newestSession.IsZero() || session.createdAt.After(newestSession) {
			newestSession = session.createdAt
		}
	}
	
	stats["total_resources"] = totalResources
	if !oldestSession.IsZero() {
		stats["oldest_session_age"] = time.Since(oldestSession).String()
	}
	if !newestSession.IsZero() {
		stats["newest_session_age"] = time.Since(newestSession).String()
	}
	
	return stats
}