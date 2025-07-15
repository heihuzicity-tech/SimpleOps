package interfaces

import (
	"context"
	"time"
)

// Asset 资产基本信息接口
type Asset interface {
	GetID() uint
	GetName() string
	GetHost() string
	GetPort() int
	GetType() string
	GetGroupID() uint
	GetStatus() string
	GetTags() map[string]string
}

// Credential 凭证信息接口
type Credential interface {
	GetID() uint
	GetType() string
	GetUsername() string
	GetPassword() string
	GetPrivateKey() string
	GetAssetID() uint
}

// SessionInfo 会话信息接口
type SessionInfo interface {
	GetSessionID() string
	GetAssetID() uint
	GetUserID() uint
	GetStatus() string
	GetStartTime() time.Time
	GetLastActivity() time.Time
	GetClientIP() string
}

// ConnectionResult 连接测试结果
type ConnectionResult struct {
	Success      bool          `json:"success"`
	Message      string        `json:"message"`
	ResponseTime time.Duration `json:"response_time"`
	Error        error         `json:"error,omitempty"`
}

// AssetQuery 资产查询参数
type AssetQuery struct {
	GroupID    *uint             `json:"group_id,omitempty"`
	Type       string            `json:"type,omitempty"`
	Status     string            `json:"status,omitempty"`
	Tags       map[string]string `json:"tags,omitempty"`
	SearchKey  string            `json:"search_key,omitempty"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	SortBy     string            `json:"sort_by"`
	SortOrder  string            `json:"sort_order"`
}

// SessionQuery 会话查询参数
type SessionQuery struct {
	UserID    *uint     `json:"user_id,omitempty"`
	AssetID   *uint     `json:"asset_id,omitempty"`
	Status    string    `json:"status,omitempty"`
	StartTime *time.Time `json:"start_time,omitempty"`
	EndTime   *time.Time `json:"end_time,omitempty"`
	Page      int       `json:"page"`
	PageSize  int       `json:"page_size"`
}

// AssetProvider 资产提供者接口 - 提供资产相关的数据访问
type AssetProvider interface {
	// 基础CRUD操作
	GetAssetByID(ctx context.Context, id uint) (Asset, error)
	GetAssetsByGroup(ctx context.Context, groupID uint) ([]Asset, error)
	GetAssetsByQuery(ctx context.Context, query *AssetQuery) ([]Asset, int64, error)
	CreateAsset(ctx context.Context, asset Asset) (Asset, error)
	UpdateAsset(ctx context.Context, asset Asset) error
	DeleteAsset(ctx context.Context, id uint) error
	
	// 凭证管理
	GetAssetCredentials(ctx context.Context, assetID uint) ([]Credential, error)
	GetCredentialByID(ctx context.Context, id uint) (Credential, error)
	GetDefaultCredential(ctx context.Context, assetID uint) (Credential, error)
	
	// 资产分组
	GetAssetGroups(ctx context.Context) ([]interface{}, error)
	GetAssetsByType(ctx context.Context, assetType string) ([]Asset, error)
	
	// 资产状态管理
	UpdateAssetStatus(ctx context.Context, assetID uint, status string) error
	BatchUpdateAssetStatus(ctx context.Context, assetIDs []uint, status string) error
}

// SessionManager 会话管理器接口 - 管理SSH会话生命周期
type SessionManager interface {
	// 会话生命周期管理
	CreateSession(ctx context.Context, session SessionInfo) (string, error)
	GetSession(ctx context.Context, sessionID string) (SessionInfo, error)
	GetActiveSessions(ctx context.Context, userID uint) ([]SessionInfo, error)
	GetSessionsByQuery(ctx context.Context, query *SessionQuery) ([]SessionInfo, int64, error)
	UpdateSessionActivity(ctx context.Context, sessionID string) error
	CloseSession(ctx context.Context, sessionID string) error
	
	// 批量操作
	CloseUserSessions(ctx context.Context, userID uint) error
	CloseAssetSessions(ctx context.Context, assetID uint) error
	GetSessionCount(ctx context.Context, userID *uint) (int64, error)
	
	// 会话状态管理
	MarkSessionActive(ctx context.Context, sessionID string) error
	MarkSessionInactive(ctx context.Context, sessionID string) error
	GetInactiveSessions(ctx context.Context, timeout time.Duration) ([]SessionInfo, error)
	
	// 会话清理
	CleanupExpiredSessions(ctx context.Context) error
	ForceCloseSession(ctx context.Context, sessionID string, reason string) error
}

// ConnectionTester 连接测试器接口 - 测试各种类型的连接
type ConnectionTester interface {
	// 基础连接测试
	TestConnection(ctx context.Context, asset Asset, credential Credential) (*ConnectionResult, error)
	TestTCPConnection(ctx context.Context, host string, port int) (*ConnectionResult, error)
	
	// 特定协议测试
	TestSSHConnection(ctx context.Context, asset Asset, credential Credential) (*ConnectionResult, error)
	TestDatabaseConnection(ctx context.Context, asset Asset, credential Credential) (*ConnectionResult, error)
	TestRDPConnection(ctx context.Context, asset Asset, credential Credential) (*ConnectionResult, error)
	
	// 批量测试
	BatchTestConnections(ctx context.Context, assets []Asset) (map[uint]*ConnectionResult, error)
	TestAssetConnectivity(ctx context.Context, assetID uint) (*ConnectionResult, error)
	
	// 连接健康检查
	HealthCheck(ctx context.Context, asset Asset) (*ConnectionResult, error)
	GetConnectionStats(ctx context.Context, assetID uint, duration time.Duration) (interface{}, error)
}

// AuditLogger 审计日志接口 - 记录操作审计信息
type AuditLogger interface {
	// 会话审计
	LogSessionStart(ctx context.Context, session SessionInfo) error
	LogSessionEnd(ctx context.Context, sessionID string, reason string) error
	LogSessionCommand(ctx context.Context, sessionID string, command string) error
	
	// 操作审计
	LogAssetOperation(ctx context.Context, userID uint, assetID uint, operation string, details interface{}) error
	LogConnectionTest(ctx context.Context, userID uint, assetID uint, result *ConnectionResult) error
	LogCredentialAccess(ctx context.Context, userID uint, credentialID uint, operation string) error
	
	// 安全审计
	LogSecurityEvent(ctx context.Context, userID uint, eventType string, details interface{}) error
	LogFailedAuthentication(ctx context.Context, userID uint, assetID uint, reason string) error
}

// PermissionChecker 权限检查器接口 - 检查用户权限
type PermissionChecker interface {
	// 资产权限
	CanAccessAsset(ctx context.Context, userID uint, assetID uint) (bool, error)
	CanModifyAsset(ctx context.Context, userID uint, assetID uint) (bool, error)
	CanDeleteAsset(ctx context.Context, userID uint, assetID uint) (bool, error)
	
	// 会话权限
	CanCreateSession(ctx context.Context, userID uint, assetID uint) (bool, error)
	CanTerminateSession(ctx context.Context, userID uint, sessionID string) (bool, error)
	CanViewSession(ctx context.Context, userID uint, sessionID string) (bool, error)
	
	// 凭证权限
	CanAccessCredential(ctx context.Context, userID uint, credentialID uint) (bool, error)
	CanModifyCredential(ctx context.Context, userID uint, credentialID uint) (bool, error)
	
	// 系统权限
	IsSystemAdmin(ctx context.Context, userID uint) (bool, error)
	GetUserPermissions(ctx context.Context, userID uint) ([]string, error)
}

// NotificationSender 通知发送器接口 - 发送各种通知
type NotificationSender interface {
	// 会话通知
	NotifySessionStart(ctx context.Context, session SessionInfo) error
	NotifySessionEnd(ctx context.Context, session SessionInfo) error
	NotifySessionTimeout(ctx context.Context, session SessionInfo) error
	
	// 安全通知
	NotifySecurityEvent(ctx context.Context, eventType string, details interface{}) error
	NotifyFailedLogin(ctx context.Context, userID uint, attempts int) error
	
	// 系统通知
	NotifySystemMaintenance(ctx context.Context, message string, affectedUsers []uint) error
	NotifyAssetUnavailable(ctx context.Context, assetID uint, reason string) error
}

// ServiceRegistry 服务注册表接口 - 管理所有服务实例
type ServiceRegistry interface {
	// 服务注册
	RegisterAssetProvider(provider AssetProvider)
	RegisterSessionManager(manager SessionManager)
	RegisterConnectionTester(tester ConnectionTester)
	RegisterAuditLogger(logger AuditLogger)
	RegisterPermissionChecker(checker PermissionChecker)
	RegisterNotificationSender(sender NotificationSender)
	
	// 服务获取
	GetAssetProvider() AssetProvider
	GetSessionManager() SessionManager
	GetConnectionTester() ConnectionTester
	GetAuditLogger() AuditLogger
	GetPermissionChecker() PermissionChecker
	GetNotificationSender() NotificationSender
	
	// 服务健康检查
	HealthCheck(ctx context.Context) (map[string]bool, error)
	GetServiceStatus(ctx context.Context) (map[string]interface{}, error)
}

// BackgroundTaskManager 后台任务管理器接口 - 管理后台任务
type BackgroundTaskManager interface {
	// 定时任务
	StartSessionCleanupTask(ctx context.Context, interval time.Duration) error
	StartConnectionHealthCheck(ctx context.Context, interval time.Duration) error
	StartAuditLogCleanup(ctx context.Context, interval time.Duration) error
	
	// 任务控制
	StopTask(ctx context.Context, taskName string) error
	GetTaskStatus(ctx context.Context, taskName string) (interface{}, error)
	
	// 一次性任务
	ScheduleTask(ctx context.Context, taskName string, delay time.Duration, fn func() error) error
}

// 常量定义
const (
	// 资产状态
	AssetStatusOnline    = "online"
	AssetStatusOffline   = "offline"
	AssetStatusTesting   = "testing"
	AssetStatusMaintenance = "maintenance"
	
	// 会话状态
	SessionStatusActive    = "active"
	SessionStatusInactive  = "inactive"
	SessionStatusClosed    = "closed"
	SessionStatusTimeout   = "timeout"
	
	// 连接类型
	ConnTypeSSH      = "ssh"
	ConnTypeRDP      = "rdp"
	ConnTypeMySQL    = "mysql"
	ConnTypePostgres = "postgres"
	ConnTypeTelnet   = "telnet"
	ConnTypeVNC      = "vnc"
	
	// 凭证类型
	CredTypePassword = "password"
	CredTypeKey      = "key"
	CredTypeCert     = "cert"
	
	// 审计事件类型
	AuditEventSessionStart = "session_start"
	AuditEventSessionEnd   = "session_end"
	AuditEventConnectionTest = "connection_test"
	AuditEventAssetAccess  = "asset_access"
	AuditEventSecurityViolation = "security_violation"
)