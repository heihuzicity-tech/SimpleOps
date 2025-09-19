package models

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// TimeoutPolicy 超时策略类型
type TimeoutPolicy string

const (
	// TimeoutPolicyUnlimited 无限制
	TimeoutPolicyUnlimited TimeoutPolicy = "unlimited"
	// TimeoutPolicyFixed 固定时间
	TimeoutPolicyFixed TimeoutPolicy = "fixed"
	// TimeoutPolicyIdleKick 空闲踢出
	TimeoutPolicyIdleKick TimeoutPolicy = "idle_kick"
)

// SessionTimeout 会话超时配置模型
type SessionTimeout struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	SessionID      string         `json:"session_id" gorm:"uniqueIndex;not null;size:100;comment:关联的会话ID"`
	TimeoutMinutes int            `json:"timeout_minutes" gorm:"not null;comment:超时时间(分钟)，0表示无限制"`
	Policy         TimeoutPolicy  `json:"policy" gorm:"size:20;not null;default:'fixed';comment:超时策略"`
	IdleMinutes    int            `json:"idle_minutes" gorm:"comment:空闲时间(分钟)，适用于idle_kick策略"`
	LastActivity   time.Time      `json:"last_activity" gorm:"comment:最后活动时间"`
	WarningsSent   int            `json:"warnings_sent" gorm:"default:0;comment:已发送警告次数"`
	LastWarningAt  *time.Time     `json:"last_warning_at" gorm:"comment:最后警告时间"`
	IsActive       bool           `json:"is_active" gorm:"default:true;comment:是否启用"`
	ExtensionCount int            `json:"extension_count" gorm:"default:0;comment:延期次数"`
	MaxExtensions  int            `json:"max_extensions" gorm:"default:3;comment:最大延期次数"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	SessionRecord *SessionRecord `json:"session_record,omitempty" gorm:"foreignKey:SessionID;references:SessionID"`
}

// 🔄 简化：已移除TimeoutWarning相关功能
// 根据用户反馈，告警功能是伪需求，用户长时间无操作时不在电脑前看不见告警
// 因此简化为直接超时断开，不需要警告机制

// SessionTimeoutConfig Redis中存储的超时配置 (已简化，移除警告功能)
type SessionTimeoutConfig struct {
	SessionID      string        `json:"session_id" redis:"session_id"`
	TimeoutMinutes int           `json:"timeout_minutes" redis:"timeout_minutes"`
	Policy         TimeoutPolicy `json:"policy" redis:"policy"`
	IdleMinutes    int           `json:"idle_minutes" redis:"idle_minutes"`
	LastActivity   time.Time     `json:"last_activity" redis:"last_activity"`
	StartTime      time.Time     `json:"start_time" redis:"start_time"`
	ExtensionCount int           `json:"extension_count" redis:"extension_count"`
	MaxExtensions  int           `json:"max_extensions" redis:"max_extensions"`
	IsActive       bool          `json:"is_active" redis:"is_active"`
}

// TableName 指定表名
func (SessionTimeout) TableName() string {
	return "session_timeouts"
}

// MarshalBinary 实现Redis序列化
func (s *SessionTimeoutConfig) MarshalBinary() ([]byte, error) {
	return json.Marshal(s)
}

// UnmarshalBinary 实现Redis反序列化
func (s *SessionTimeoutConfig) UnmarshalBinary(data []byte) error {
	return json.Unmarshal(data, s)
}

// RedisKey 生成Redis键名
func (s *SessionTimeoutConfig) RedisKey() string {
	return fmt.Sprintf("session_timeout:%s", s.SessionID)
}

// IsUnlimited 判断是否为无限制模式
func (s *SessionTimeout) IsUnlimited() bool {
	return s.TimeoutMinutes == 0 || s.Policy == TimeoutPolicyUnlimited
}

// IsExpired 检查会话是否已过期
func (s *SessionTimeout) IsExpired() bool {
	if s.IsUnlimited() || !s.IsActive {
		return false
	}

	now := time.Now()
	switch s.Policy {
	case TimeoutPolicyFixed:
		// 固定超时：从创建时间开始计算
		return now.Sub(s.CreatedAt).Minutes() >= float64(s.TimeoutMinutes)
	case TimeoutPolicyIdleKick:
		// 空闲超时：从最后活动时间开始计算
		return now.Sub(s.LastActivity).Minutes() >= float64(s.IdleMinutes)
	default:
		return false
	}
}

// GetRemainingMinutes 获取剩余分钟数
func (s *SessionTimeout) GetRemainingMinutes() int {
	if s.IsUnlimited() || !s.IsActive {
		return -1 // -1 表示无限制
	}

	now := time.Now()
	switch s.Policy {
	case TimeoutPolicyFixed:
		elapsed := now.Sub(s.CreatedAt).Minutes()
		remaining := float64(s.TimeoutMinutes) - elapsed
		if remaining < 0 {
			return 0
		}
		return int(remaining)
	case TimeoutPolicyIdleKick:
		elapsed := now.Sub(s.LastActivity).Minutes()
		remaining := float64(s.IdleMinutes) - elapsed
		if remaining < 0 {
			return 0
		}
		return int(remaining)
	default:
		return -1
	}
}

// 🔄 已移除 NeedsWarning 方法，因为不再需要警告功能

// CanExtend 检查是否可以延期
func (s *SessionTimeout) CanExtend() bool {
	return s.IsActive && s.ExtensionCount < s.MaxExtensions
}

// ExtendTimeout 延长会话时间
func (s *SessionTimeout) ExtendTimeout(minutes int) error {
	if !s.CanExtend() {
		return fmt.Errorf("会话已达到最大延期次数: %d", s.MaxExtensions)
	}

	s.TimeoutMinutes += minutes
	s.ExtensionCount++
	s.UpdatedAt = time.Now()

	return nil
}

// UpdateActivity 更新活动时间
func (s *SessionTimeout) UpdateActivity() {
	s.LastActivity = time.Now()
	s.UpdatedAt = time.Now()
}

// ToConfig 转换为Redis配置格式 (已简化)
func (s *SessionTimeout) ToConfig() *SessionTimeoutConfig {
	config := &SessionTimeoutConfig{
		SessionID:      s.SessionID,
		TimeoutMinutes: s.TimeoutMinutes,
		Policy:         s.Policy,
		IdleMinutes:    s.IdleMinutes,
		LastActivity:   s.LastActivity,
		StartTime:      s.CreatedAt,
		ExtensionCount: s.ExtensionCount,
		MaxExtensions:  s.MaxExtensions,
		IsActive:       s.IsActive,
	}

	return config
}

// FromConfig 从Redis配置创建模型 (已简化)
func (s *SessionTimeout) FromConfig(config *SessionTimeoutConfig) {
	s.SessionID = config.SessionID
	s.TimeoutMinutes = config.TimeoutMinutes
	s.Policy = config.Policy
	s.IdleMinutes = config.IdleMinutes
	s.LastActivity = config.LastActivity
	s.ExtensionCount = config.ExtensionCount
	s.MaxExtensions = config.MaxExtensions
	s.IsActive = config.IsActive
}

// SessionTimeoutCreateRequest 创建超时配置请求
type SessionTimeoutCreateRequest struct {
	SessionID      string        `json:"session_id" binding:"required"`
	TimeoutMinutes int           `json:"timeout_minutes" binding:"min=0,max=1440"` // 0-24小时
	Policy         TimeoutPolicy `json:"policy" binding:"required,oneof=unlimited fixed idle_kick"`
	IdleMinutes    int           `json:"idle_minutes" binding:"min=1,max=120"`      // 空闲时间1-120分钟
	MaxExtensions  int           `json:"max_extensions" binding:"min=0,max=10"`     // 最大延期次数
}

// SessionTimeoutUpdateRequest 更新超时配置请求
type SessionTimeoutUpdateRequest struct {
	TimeoutMinutes *int          `json:"timeout_minutes" binding:"omitempty,min=0,max=1440"`
	Policy         *TimeoutPolicy `json:"policy" binding:"omitempty,oneof=unlimited fixed idle_kick"`
	IdleMinutes    *int          `json:"idle_minutes" binding:"omitempty,min=1,max=120"`
	IsActive       *bool         `json:"is_active"`
	MaxExtensions  *int          `json:"max_extensions" binding:"omitempty,min=0,max=10"`
}

// SessionTimeoutExtendRequest 延期请求
type SessionTimeoutExtendRequest struct {
	ExtendMinutes int `json:"extend_minutes" binding:"required,min=5,max=120"` // 延期5-120分钟
}

// SessionTimeoutResponse 超时配置响应 (已简化)
type SessionTimeoutResponse struct {
	ID               uint          `json:"id"`
	SessionID        string        `json:"session_id"`
	TimeoutMinutes   int           `json:"timeout_minutes"`
	Policy           TimeoutPolicy `json:"policy"`
	IdleMinutes      int           `json:"idle_minutes"`
	RemainingMinutes int           `json:"remaining_minutes"`
	LastActivity     time.Time     `json:"last_activity"`
	IsActive         bool          `json:"is_active"`
	ExtensionCount   int           `json:"extension_count"`
	MaxExtensions    int           `json:"max_extensions"`
	CanExtend        bool          `json:"can_extend"`
	IsExpired        bool          `json:"is_expired"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

// ToResponse 转换为响应格式 (已简化)
func (s *SessionTimeout) ToResponse() *SessionTimeoutResponse {
	return &SessionTimeoutResponse{
		ID:               s.ID,
		SessionID:        s.SessionID,
		TimeoutMinutes:   s.TimeoutMinutes,
		Policy:           s.Policy,
		IdleMinutes:      s.IdleMinutes,
		RemainingMinutes: s.GetRemainingMinutes(),
		LastActivity:     s.LastActivity,
		IsActive:         s.IsActive,
		ExtensionCount:   s.ExtensionCount,
		MaxExtensions:    s.MaxExtensions,
		CanExtend:        s.CanExtend(),
		IsExpired:        s.IsExpired(),
		CreatedAt:        s.CreatedAt,
		UpdatedAt:        s.UpdatedAt,
	}
}