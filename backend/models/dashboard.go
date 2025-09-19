package models

import "time"

// DashboardStats 仪表盘统计数据
type DashboardStats struct {
	Hosts struct {
		Total  int `json:"total"`
		Online int `json:"online"`
		Groups int `json:"groups"`
	} `json:"hosts"`
	Sessions struct {
		Active int `json:"active"`
		Total  int `json:"total"`
	} `json:"sessions"`
	Users struct {
		Total       int `json:"total"`
		Online      int `json:"online"`
		TodayLogins int `json:"today_logins"`
	} `json:"users"`
	Credentials struct {
		Passwords int `json:"passwords"`
		SSHKeys   int `json:"ssh_keys"`
	} `json:"credentials"`
}

// RecentLogin 最近登录记录
type RecentLogin struct {
	ID             uint      `json:"id"`
	Username       string    `json:"username"`
	AssetName      string    `json:"asset_name"`
	AssetAddress   string    `json:"asset_address"`
	CredentialName string    `json:"credential_name"`
	LoginTime      time.Time `json:"login_time"`
	Duration       int       `json:"duration"` // 执行时长（秒）
	Status         string    `json:"status"`   // online/offline
	SessionID      string    `json:"session_id"`
}

// HostDistribution 主机分组分布
type HostDistribution struct {
	GroupName string `json:"group_name"`
	Count     int    `json:"count"`
	Percent   float64 `json:"percent"`
}

// ActivityTrend 活跃趋势数据
type ActivityTrend struct {
	Date     string `json:"date"`
	Sessions int    `json:"sessions"`
	Logins   int    `json:"logins"`
	Commands int    `json:"commands"`
}

// AuditSummary 审计统计摘要
type AuditSummary struct {
	LoginLogs      int `json:"login_logs"`
	OperationLogs  int `json:"operation_logs"`
	CommandRecords int `json:"command_records"`
	DangerCommands int `json:"danger_commands"`
}

// QuickAccessHost 快速访问主机
type QuickAccessHost struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Address      string `json:"address"`
	CredentialID uint   `json:"credential_id"`
	Username     string `json:"username"`
	OS           string `json:"os"`
	LastAccess   *time.Time `json:"last_access,omitempty"`
	AccessCount  int    `json:"access_count"`
}

// DashboardResponse 仪表盘完整响应
type DashboardResponse struct {
	Stats            *DashboardStats     `json:"stats"`
	RecentLogins     []RecentLogin       `json:"recent_logins"`
	HostDistribution []HostDistribution  `json:"host_distribution"`
	ActivityTrends   []ActivityTrend     `json:"activity_trends"`
	AuditSummary     *AuditSummary       `json:"audit_summary"`
	QuickAccess      []QuickAccessHost   `json:"quick_access"`
	LastUpdated      time.Time           `json:"last_updated"`
}

// DashboardQueryParams 仪表盘查询参数
type DashboardQueryParams struct {
	TimeRange string `form:"time_range" binding:"omitempty,oneof=today week month"` // 时间范围
	UserID    uint   `form:"user_id"`                                                // 特定用户（管理员查看）
}