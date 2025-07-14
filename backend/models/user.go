package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Username  string         `json:"username" gorm:"uniqueIndex;not null;size:50"`
	Password  string         `json:"-" gorm:"not null;size:255"`
	Email     string         `json:"email" gorm:"size:100"`
	Phone     string         `json:"phone" gorm:"size:20"`
	Status    int            `json:"status" gorm:"default:1"` // 1-启用, 0-禁用
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	UserRoles []UserRole `json:"user_roles" gorm:"foreignKey:UserID"`
	Roles     []Role     `json:"roles" gorm:"many2many:user_roles"`
}

// Role 角色模型
type Role struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"uniqueIndex;not null;size:50"`
	Description string         `json:"description" gorm:"type:text"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	UserRoles       []UserRole       `json:"user_roles" gorm:"foreignKey:RoleID"`
	Users           []User           `json:"users" gorm:"many2many:user_roles"`
	RolePermissions []RolePermission `json:"role_permissions" gorm:"foreignKey:RoleID"`
	Permissions     []Permission     `json:"permissions" gorm:"many2many:role_permissions"`
}

// Permission 权限模型
type Permission struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"uniqueIndex;not null;size:100"`
	Description string         `json:"description" gorm:"type:text"`
	Category    string         `json:"category" gorm:"size:50"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	RolePermissions []RolePermission `json:"role_permissions" gorm:"foreignKey:PermissionID"`
	Roles           []Role           `json:"roles" gorm:"many2many:role_permissions"`
}

// RolePermission 角色权限关联模型
type RolePermission struct {
	RoleID       uint      `json:"role_id" gorm:"primaryKey"`
	PermissionID uint      `json:"permission_id" gorm:"primaryKey"`
	CreatedAt    time.Time `json:"created_at"`

	// 关联关系
	Role       Role       `json:"role" gorm:"foreignKey:RoleID"`
	Permission Permission `json:"permission" gorm:"foreignKey:PermissionID"`
}

// UserRole 用户角色关联模型
type UserRole struct {
	UserID    uint      `json:"user_id" gorm:"primaryKey"`
	RoleID    uint      `json:"role_id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`

	// 关联关系
	User User `json:"user" gorm:"foreignKey:UserID"`
	Role Role `json:"role" gorm:"foreignKey:RoleID"`
}

// UserCreateRequest 用户创建请求
type UserCreateRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=50"`
	Email    string `json:"email" binding:"omitempty,email"`
	Phone    string `json:"phone" binding:"omitempty,min=10,max=20"`
	RoleIDs  []uint `json:"role_ids" binding:"required"`
}

// UserUpdateRequest 用户更新请求
type UserUpdateRequest struct {
	Email   string `json:"email" binding:"omitempty,email"`
	Phone   string `json:"phone" binding:"omitempty,min=10,max=20"`
	Status  *int   `json:"status" binding:"omitempty,oneof=0 1"`
	RoleIDs []uint `json:"role_ids" binding:"omitempty"`
}

// UserLoginRequest 用户登录请求
type UserLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// UserResponse 用户响应
type UserResponse struct {
	ID        uint      `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Status    int       `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Roles     []Role    `json:"roles"`
}

// PasswordChangeRequest 密码修改请求
type PasswordChangeRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=50"`
}

// RoleCreateRequest 角色创建请求
type RoleCreateRequest struct {
	Name        string   `json:"name" binding:"required,min=2,max=50"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions" binding:"required"`
}

// RoleUpdateRequest 角色更新请求
type RoleUpdateRequest struct {
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// RoleResponse 角色响应
type RoleResponse struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	UserCount   int       `json:"user_count"` // 拥有此角色的用户数量
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// RoleListRequest 角色列表请求
type RoleListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Keyword  string `form:"keyword" binding:"omitempty,max=50"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

func (Role) TableName() string {
	return "roles"
}

func (UserRole) TableName() string {
	return "user_roles"
}

func (Permission) TableName() string {
	return "permissions"
}

func (RolePermission) TableName() string {
	return "role_permissions"
}

// ToResponse 转换为响应格式
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		Email:     u.Email,
		Phone:     u.Phone,
		Status:    u.Status,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
		Roles:     u.Roles,
	}
}

// ToResponse 角色转换为响应格式
func (r *Role) ToResponse() *RoleResponse {
	permissions := make([]string, len(r.Permissions))
	for i, perm := range r.Permissions {
		permissions[i] = perm.Name
	}

	return &RoleResponse{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Permissions: permissions,
		UserCount:   len(r.Users), // 这里需要在查询时预加载Users
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// HasPermission 检查角色是否拥有指定权限
func (r *Role) HasPermission(permission string) bool {
	for _, perm := range r.Permissions {
		if perm.Name == "all" || perm.Name == permission {
			return true
		}
	}
	return false
}

// HasPermission 检查用户是否拥有指定权限
func (u *User) HasPermission(permission string) bool {
	for _, role := range u.Roles {
		// 检查是否有全部权限
		for _, perm := range role.Permissions {
			if perm.Name == "all" || perm.Name == permission {
				return true
			}
		}
	}
	return false
}

// HasRole 检查用户是否拥有指定角色
func (u *User) HasRole(roleName string) bool {
	for _, role := range u.Roles {
		if role.Name == roleName {
			return true
		}
	}
	return false
}

// IsActive 检查用户是否激活
func (u *User) IsActive() bool {
	return u.Status == 1
}

// Asset 资产模型
type Asset struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"not null;size:100"`
	Type      string         `json:"type" gorm:"not null;size:20;default:server"`
	OsType    string         `json:"os_type" gorm:"size:20;default:linux"`
	Address   string         `json:"address" gorm:"not null;size:255"`
	Port      int            `json:"port" gorm:"default:22"`
	Protocol  string         `json:"protocol" gorm:"size:10;default:ssh"`
	Tags      string         `json:"tags" gorm:"type:json"`
	Status    int            `json:"status" gorm:"default:1"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系 - 多对多
	Credentials []Credential `json:"credentials" gorm:"many2many:asset_credentials"`
	Groups      []AssetGroup `json:"groups" gorm:"many2many:asset_group_assets"`
}

// Credential 凭证模型
type Credential struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	Name       string         `json:"name" gorm:"not null;size:100"`
	Type       string         `json:"type" gorm:"not null;size:20;default:password"`
	Username   string         `json:"username" gorm:"size:100"`
	Password   string         `json:"password" gorm:"size:255"`
	PrivateKey string         `json:"private_key" gorm:"type:text"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系 - 多对多
	Assets []Asset `json:"assets" gorm:"many2many:asset_credentials"`
}

// AssetCredential 资产凭证关联表
type AssetCredential struct {
	AssetID      uint      `json:"asset_id" gorm:"primaryKey"`
	CredentialID uint      `json:"credential_id" gorm:"primaryKey"`
	CreatedAt    time.Time `json:"created_at"`

	// 关联关系
	Asset      Asset      `json:"asset" gorm:"foreignKey:AssetID"`
	Credential Credential `json:"credential" gorm:"foreignKey:CredentialID"`
}

// AssetGroup 资产分组模型
type AssetGroup struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"uniqueIndex;not null;size:50"`
	Description string         `json:"description" gorm:"type:text"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	Assets []Asset `json:"assets" gorm:"many2many:asset_group_assets"`
}

// AssetCreateRequest 资产创建请求
type AssetCreateRequest struct {
	Name          string `json:"name" binding:"required,min=1,max=100"`
	Type          string `json:"type" binding:"required,oneof=server database"`
	OsType        string `json:"os_type" binding:"omitempty,oneof=linux windows"`
	Address       string `json:"address" binding:"required,min=1,max=255"`
	Port          int    `json:"port" binding:"required,min=1,max=65535"`
	Protocol      string `json:"protocol" binding:"required,oneof=ssh rdp vnc mysql postgresql"`
	Tags          string `json:"tags"`
	CredentialIDs []uint `json:"credential_ids" binding:"omitempty"` // 可选的凭证ID列表
	GroupIDs      []uint `json:"group_ids" binding:"omitempty"`      // 可选的分组ID列表
}

// AssetUpdateRequest 资产更新请求
type AssetUpdateRequest struct {
	Name          string `json:"name" binding:"omitempty,min=1,max=100"`
	Type          string `json:"type" binding:"omitempty,oneof=server database"`
	OsType        string `json:"os_type" binding:"omitempty,oneof=linux windows"`
	Address       string `json:"address" binding:"omitempty,min=1,max=255"`
	Port          int    `json:"port" binding:"omitempty,min=1,max=65535"`
	Protocol      string `json:"protocol" binding:"omitempty,oneof=ssh rdp vnc mysql postgresql"`
	Tags          string `json:"tags"`
	Status        *int   `json:"status" binding:"omitempty,oneof=0 1"`
	CredentialIDs []uint `json:"credential_ids" binding:"omitempty"` // 可选的凭证ID列表
	GroupIDs      []uint `json:"group_ids" binding:"omitempty"`      // 可选的分组ID列表
}

// AssetResponse 资产响应
type AssetResponse struct {
	ID               uint         `json:"id"`
	Name             string       `json:"name"`
	Type             string       `json:"type"`
	OsType           string       `json:"os_type"`
	Address          string       `json:"address"`
	Port             int          `json:"port"`
	Protocol         string       `json:"protocol"`
	Tags             string       `json:"tags"`
	Status           int          `json:"status"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
	Credentials      []Credential `json:"credentials,omitempty"`
	Groups           []AssetGroup `json:"groups,omitempty"`
	ConnectionStatus string       `json:"connection_status,omitempty"`
}

// AssetListRequest 资产列表请求
type AssetListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Keyword  string `form:"keyword" binding:"omitempty,max=50"`
	Type     string `form:"type" binding:"omitempty,oneof=server database"`
	Status   *int   `form:"status" binding:"omitempty,oneof=0 1"`
}

// CredentialCreateRequest 凭证创建请求
type CredentialCreateRequest struct {
	Name       string `json:"name" binding:"required,min=1,max=100"`
	Type       string `json:"type" binding:"required,oneof=password key"`
	Username   string `json:"username" binding:"required,min=1,max=100"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
	AssetIDs   []uint `json:"asset_ids" binding:"required,min=1"`
}

// CredentialUpdateRequest 凭证更新请求
type CredentialUpdateRequest struct {
	Name       string `json:"name" binding:"omitempty,min=1,max=100"`
	Type       string `json:"type" binding:"omitempty,oneof=password key"`
	Username   string `json:"username" binding:"omitempty,min=1,max=100"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
}

// CredentialResponse 凭证响应
type CredentialResponse struct {
	ID        uint            `json:"id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Username  string          `json:"username"`
	Assets    []AssetResponse `json:"assets,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// CredentialListRequest 凭证列表请求
type CredentialListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Keyword  string `form:"keyword" binding:"omitempty,max=50"`
	Type     string `form:"type" binding:"omitempty,oneof=password key"`
	AssetID  uint   `form:"asset_id" binding:"omitempty"` // 保留用于过滤
}

// ConnectionTestRequest 连接测试请求
type ConnectionTestRequest struct {
	AssetID      uint   `json:"asset_id" binding:"required"`
	CredentialID uint   `json:"credential_id" binding:"required"`
	TestType     string `json:"test_type" binding:"required,oneof=ping ssh rdp database"`
}

// ConnectionTestResponse 连接测试响应
type ConnectionTestResponse struct {
	Success  bool      `json:"success"`
	Message  string    `json:"message"`
	Latency  int       `json:"latency,omitempty"`
	Error    string    `json:"error,omitempty"`
	TestedAt time.Time `json:"tested_at"`
}

// TableName 指定表名
func (Asset) TableName() string {
	return "assets"
}

func (Credential) TableName() string {
	return "credentials"
}

func (AssetCredential) TableName() string {
	return "asset_credentials"
}

func (AssetGroup) TableName() string {
	return "asset_groups"
}

// ToResponse 转换为响应格式
func (a *Asset) ToResponse() *AssetResponse {
	return &AssetResponse{
		ID:          a.ID,
		Name:        a.Name,
		Type:        a.Type,
		OsType:      a.OsType,
		Address:     a.Address,
		Port:        a.Port,
		Protocol:    a.Protocol,
		Tags:        a.Tags,
		Status:      a.Status,
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
		Credentials: a.Credentials,
		Groups:      a.Groups,
	}
}

func (c *Credential) ToResponse() *CredentialResponse {
	resp := &CredentialResponse{
		ID:        c.ID,
		Name:      c.Name,
		Type:      c.Type,
		Username:  c.Username,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}

	// 转换关联的资产
	if len(c.Assets) > 0 {
		resp.Assets = make([]AssetResponse, len(c.Assets))
		for i, asset := range c.Assets {
			resp.Assets[i] = *asset.ToResponse()
		}
	}

	return resp
}

// IsActive 检查资产是否启用
func (a *Asset) IsActive() bool {
	return a.Status == 1
}

// IsPasswordType 检查凭证是否为密码类型
func (c *Credential) IsPasswordType() bool {
	return c.Type == "password"
}

// IsKeyType 检查凭证是否为密钥类型
func (c *Credential) IsKeyType() bool {
	return c.Type == "key"
}

// ======================== 审计相关模型 ========================

// LoginLog 登录日志模型
type LoginLog struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    uint           `json:"user_id" gorm:"not null;index"`
	Username  string         `json:"username" gorm:"not null;size:50"`
	IP        string         `json:"ip" gorm:"not null;size:45"`
	UserAgent string         `json:"user_agent" gorm:"type:text"`
	Method    string         `json:"method" gorm:"size:10;default:web"`
	Status    string         `json:"status" gorm:"size:20;not null"` // success, failed, logout
	Message   string         `json:"message" gorm:"type:text"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	User User `json:"user" gorm:"foreignKey:UserID"`
}

// OperationLog 操作日志模型
type OperationLog struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	UserID       uint           `json:"user_id" gorm:"not null;index"`
	Username     string         `json:"username" gorm:"not null;size:50"`
	IP           string         `json:"ip" gorm:"not null;size:45"`
	Method       string         `json:"method" gorm:"size:10;not null"`
	URL          string         `json:"url" gorm:"size:255;not null"`
	Action       string         `json:"action" gorm:"size:50;not null"`
	Resource     string         `json:"resource" gorm:"size:50"`
	ResourceID   uint           `json:"resource_id" gorm:"index"`
	Status       int            `json:"status" gorm:"not null"`
	Message      string         `json:"message" gorm:"type:text"`
	RequestData  string         `json:"request_data" gorm:"type:text"`
	ResponseData string         `json:"response_data" gorm:"type:text"`
	Duration     int64          `json:"duration"` // 请求耗时，毫秒
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	User User `json:"user" gorm:"foreignKey:UserID"`
}

// SessionRecord 会话记录模型
type SessionRecord struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	SessionID    string         `json:"session_id" gorm:"uniqueIndex;not null;size:100"`
	UserID       uint           `json:"user_id" gorm:"not null;index"`
	Username     string         `json:"username" gorm:"not null;size:50"`
	AssetID      uint           `json:"asset_id" gorm:"not null;index"`
	AssetName    string         `json:"asset_name" gorm:"not null;size:100"`
	AssetAddress string         `json:"asset_address" gorm:"not null;size:255"`
	CredentialID uint           `json:"credential_id" gorm:"not null;index"`
	Protocol     string         `json:"protocol" gorm:"size:10;not null"`
	IP           string         `json:"ip" gorm:"not null;size:45"`
	Status       string         `json:"status" gorm:"size:20;not null"` // active, closed, timeout, terminated
	StartTime    time.Time      `json:"start_time"`
	EndTime      *time.Time     `json:"end_time"`
	Duration     int64          `json:"duration"`                    // 会话持续时间，秒
	RecordPath   string         `json:"record_path" gorm:"size:255"` // 录制文件路径
	IsTerminated *bool          `json:"is_terminated" gorm:"default:false"` // 是否被终止
	TerminationReason string    `json:"termination_reason" gorm:"size:255"` // 终止原因
	TerminatedBy *uint          `json:"terminated_by" gorm:"index"`        // 终止人
	TerminatedAt *time.Time     `json:"terminated_at"`                     // 终止时间
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	User       User       `json:"user" gorm:"foreignKey:UserID"`
	Asset      Asset      `json:"asset" gorm:"foreignKey:AssetID"`
	Credential Credential `json:"credential" gorm:"foreignKey:CredentialID"`
}

// CommandLog 命令日志模型
type CommandLog struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	SessionID string         `json:"session_id" gorm:"not null;index;size:100"`
	UserID    uint           `json:"user_id" gorm:"not null;index"`
	Username  string         `json:"username" gorm:"not null;size:50"`
	AssetID   uint           `json:"asset_id" gorm:"not null;index"`
	Command   string         `json:"command" gorm:"type:text;not null"`
	Output    string         `json:"output" gorm:"type:text"`
	ExitCode  int            `json:"exit_code"`
	Risk      string         `json:"risk" gorm:"size:20;default:low"` // low, medium, high
	StartTime time.Time      `json:"start_time"`
	EndTime   *time.Time     `json:"end_time"`
	Duration  int64          `json:"duration"` // 命令执行时间，毫秒
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	User    User          `json:"user" gorm:"foreignKey:UserID"`
	Asset   Asset         `json:"asset" gorm:"foreignKey:AssetID"`
	Session SessionRecord `json:"session" gorm:"foreignKey:SessionID;references:SessionID"`
}

// ======================== 审计请求响应结构 ========================

// LoginLogListRequest 登录日志列表请求
type LoginLogListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Username  string `form:"username" binding:"omitempty,max=50"`
	Status    string `form:"status" binding:"omitempty,oneof=success failed logout"`
	IP        string `form:"ip" binding:"omitempty,max=45"`
	StartTime string `form:"start_time" binding:"omitempty"`
	EndTime   string `form:"end_time" binding:"omitempty"`
}

// OperationLogListRequest 操作日志列表请求
type OperationLogListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Username  string `form:"username" binding:"omitempty,max=50"`
	Action    string `form:"action" binding:"omitempty,max=50"`
	Resource  string `form:"resource" binding:"omitempty,max=50"`
	Status    *int   `form:"status" binding:"omitempty,min=100,max=599"`
	IP        string `form:"ip" binding:"omitempty,max=45"`
	StartTime string `form:"start_time" binding:"omitempty"`
	EndTime   string `form:"end_time" binding:"omitempty"`
}

// SessionRecordListRequest 会话记录列表请求
type SessionRecordListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Username  string `form:"username" binding:"omitempty,max=50"`
	AssetName string `form:"asset_name" binding:"omitempty,max=100"`
	Protocol  string `form:"protocol" binding:"omitempty,oneof=ssh rdp vnc"`
	Status    string `form:"status" binding:"omitempty,oneof=active closed timeout"`
	IP        string `form:"ip" binding:"omitempty,max=45"`
	StartTime string `form:"start_time" binding:"omitempty"`
	EndTime   string `form:"end_time" binding:"omitempty"`
}

// CommandLogListRequest 命令日志列表请求
type CommandLogListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	SessionID string `form:"session_id" binding:"omitempty,max=100"`
	Username  string `form:"username" binding:"omitempty,max=50"`
	AssetID   uint   `form:"asset_id" binding:"omitempty"`
	Command   string `form:"command" binding:"omitempty,max=255"`
	Risk      string `form:"risk" binding:"omitempty,oneof=low medium high"`
	StartTime string `form:"start_time" binding:"omitempty"`
	EndTime   string `form:"end_time" binding:"omitempty"`
}

// LoginLogResponse 登录日志响应
type LoginLogResponse struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	IP        string    `json:"ip"`
	UserAgent string    `json:"user_agent"`
	Method    string    `json:"method"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// OperationLogResponse 操作日志响应
type OperationLogResponse struct {
	ID         uint      `json:"id"`
	UserID     uint      `json:"user_id"`
	Username   string    `json:"username"`
	IP         string    `json:"ip"`
	Method     string    `json:"method"`
	URL        string    `json:"url"`
	Action     string    `json:"action"`
	Resource   string    `json:"resource"`
	ResourceID uint      `json:"resource_id"`
	Status     int       `json:"status"`
	Message    string    `json:"message"`
	Duration   int64     `json:"duration"`
	CreatedAt  time.Time `json:"created_at"`
}

// SessionRecordResponse 会话记录响应
type SessionRecordResponse struct {
	ID           uint       `json:"id"`
	SessionID    string     `json:"session_id"`
	UserID       uint       `json:"user_id"`
	Username     string     `json:"username"`
	AssetID      uint       `json:"asset_id"`
	AssetName    string     `json:"asset_name"`
	AssetAddress string     `json:"asset_address"`
	CredentialID uint       `json:"credential_id"`
	Protocol     string     `json:"protocol"`
	IP           string     `json:"ip"`
	Status       string     `json:"status"`
	StartTime    time.Time  `json:"start_time"`
	EndTime      *time.Time `json:"end_time"`
	Duration     int64      `json:"duration"`
	RecordPath   string     `json:"record_path"`
	CreatedAt    time.Time  `json:"created_at"`
}

// CommandLogResponse 命令日志响应
type CommandLogResponse struct {
	ID        uint       `json:"id"`
	SessionID string     `json:"session_id"`
	UserID    uint       `json:"user_id"`
	Username  string     `json:"username"`
	AssetID   uint       `json:"asset_id"`
	Command   string     `json:"command"`
	Output    string     `json:"output"`
	ExitCode  int        `json:"exit_code"`
	Risk      string     `json:"risk"`
	StartTime time.Time  `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
	Duration  int64      `json:"duration"`
	CreatedAt time.Time  `json:"created_at"`
}

// AuditStatistics 审计统计响应
type AuditStatistics struct {
	TotalLoginLogs      int64 `json:"total_login_logs"`
	TotalOperationLogs  int64 `json:"total_operation_logs"`
	TotalSessionRecords int64 `json:"total_session_records"`
	TotalCommandLogs    int64 `json:"total_command_logs"`
	FailedLogins        int64 `json:"failed_logins"`
	ActiveSessions      int64 `json:"active_sessions"`
	DangerousCommands   int64 `json:"dangerous_commands"`
	TodayLogins         int64 `json:"today_logins"`
	TodayOperations     int64 `json:"today_operations"`
	TodaySessions       int64 `json:"today_sessions"`
}

// ======================== 表名映射 ========================

func (LoginLog) TableName() string {
	return "login_logs"
}

func (OperationLog) TableName() string {
	return "operation_logs"
}

func (SessionRecord) TableName() string {
	return "session_records"
}

func (CommandLog) TableName() string {
	return "command_logs"
}

// ======================== 模型方法 ========================

func (l *LoginLog) ToResponse() *LoginLogResponse {
	return &LoginLogResponse{
		ID:        l.ID,
		UserID:    l.UserID,
		Username:  l.Username,
		IP:        l.IP,
		UserAgent: l.UserAgent,
		Method:    l.Method,
		Status:    l.Status,
		Message:   l.Message,
		CreatedAt: l.CreatedAt,
	}
}

func (o *OperationLog) ToResponse() *OperationLogResponse {
	return &OperationLogResponse{
		ID:         o.ID,
		UserID:     o.UserID,
		Username:   o.Username,
		IP:         o.IP,
		Method:     o.Method,
		URL:        o.URL,
		Action:     o.Action,
		Resource:   o.Resource,
		ResourceID: o.ResourceID,
		Status:     o.Status,
		Message:    o.Message,
		Duration:   o.Duration,
		CreatedAt:  o.CreatedAt,
	}
}

func (s *SessionRecord) ToResponse() *SessionRecordResponse {
	return &SessionRecordResponse{
		ID:           s.ID,
		SessionID:    s.SessionID,
		UserID:       s.UserID,
		Username:     s.Username,
		AssetID:      s.AssetID,
		AssetName:    s.AssetName,
		AssetAddress: s.AssetAddress,
		CredentialID: s.CredentialID,
		Protocol:     s.Protocol,
		IP:           s.IP,
		Status:       s.Status,
		StartTime:    s.StartTime,
		EndTime:      s.EndTime,
		Duration:     s.Duration,
		RecordPath:   s.RecordPath,
		CreatedAt:    s.CreatedAt,
	}
}

func (c *CommandLog) ToResponse() *CommandLogResponse {
	return &CommandLogResponse{
		ID:        c.ID,
		SessionID: c.SessionID,
		UserID:    c.UserID,
		Username:  c.Username,
		AssetID:   c.AssetID,
		Command:   c.Command,
		Output:    c.Output,
		ExitCode:  c.ExitCode,
		Risk:      c.Risk,
		StartTime: c.StartTime,
		EndTime:   c.EndTime,
		Duration:  c.Duration,
		CreatedAt: c.CreatedAt,
	}
}

func (s *SessionRecord) IsActive() bool {
	return s.Status == "active"
}

func (s *SessionRecord) IsClosed() bool {
	return s.Status == "closed" || s.Status == "timeout"
}

func (s *SessionRecord) CalculateDuration() int64 {
	if s.EndTime != nil {
		return int64(s.EndTime.Sub(s.StartTime).Seconds())
	}
	return int64(time.Since(s.StartTime).Seconds())
}

// ======================== 实时监控相关模型 ========================

// SessionMonitorLog 会话监控日志模型
type SessionMonitorLog struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	SessionID     string    `json:"session_id" gorm:"not null;index;size:100"`
	MonitorUserID uint      `json:"monitor_user_id" gorm:"not null;index"`
	ActionType    string    `json:"action_type" gorm:"not null;size:50"` // terminate, warning, view
	ActionData    string    `json:"action_data" gorm:"type:json"`
	Reason        string    `json:"reason" gorm:"type:text"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// 关联关系
	MonitorUser User `json:"monitor_user" gorm:"foreignKey:MonitorUserID"`
}

// SessionWarning 会话警告消息模型
type SessionWarning struct {
	ID             uint       `json:"id" gorm:"primaryKey"`
	SessionID      string     `json:"session_id" gorm:"not null;index;size:100"`
	SenderUserID   uint       `json:"sender_user_id" gorm:"not null;index"`
	ReceiverUserID uint       `json:"receiver_user_id" gorm:"not null;index"`
	Message        string     `json:"message" gorm:"type:text;not null"`
	Level          string     `json:"level" gorm:"size:20;default:warning"` // info, warning, error
	IsRead         bool       `json:"is_read" gorm:"default:false"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at"`

	// 关联关系
	SenderUser   User `json:"sender_user" gorm:"foreignKey:SenderUserID"`
	ReceiverUser User `json:"receiver_user" gorm:"foreignKey:ReceiverUserID"`
}

// WebSocketConnection WebSocket连接日志模型（可选）
type WebSocketConnection struct {
	ID             uint       `json:"id" gorm:"primaryKey"`
	ClientID       string     `json:"client_id" gorm:"not null;index;size:100"`
	UserID         uint       `json:"user_id" gorm:"not null;index"`
	ConnectTime    time.Time  `json:"connect_time"`
	DisconnectTime *time.Time `json:"disconnect_time"`
	IPAddress      string     `json:"ip_address" gorm:"size:45"`
	UserAgent      string     `json:"user_agent" gorm:"type:text"`
	Duration       int        `json:"duration"` // 连接持续时间（秒）

	// 关联关系
	User User `json:"user" gorm:"foreignKey:UserID"`
}

// ======================== 实时监控请求响应结构 ========================

// ActiveSessionListRequest 活跃会话列表请求
type ActiveSessionListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Username  string `form:"username" binding:"omitempty,max=50"`
	AssetName string `form:"asset_name" binding:"omitempty,max=100"`
	Protocol  string `form:"protocol" binding:"omitempty,oneof=ssh rdp vnc"`
	IP        string `form:"ip" binding:"omitempty,max=45"`
}

// TerminateSessionRequest 终止会话请求
type TerminateSessionRequest struct {
	Reason string `json:"reason" binding:"required,max=255"`
	Force  bool   `json:"force"` // 是否强制终止
}

// SessionWarningRequest 会话警告请求
type SessionWarningRequest struct {
	Message string `json:"message" binding:"required,max=500"`
	Level   string `json:"level" binding:"required,oneof=info warning error"`
}

// ActiveSessionResponse 活跃会话响应
type ActiveSessionResponse struct {
	SessionRecordResponse
	ConnectionTime   int64  `json:"connection_time"`    // 连接时长（秒）
	InactiveTime     int64  `json:"inactive_time"`      // 非活跃时长（秒）
	LastActivity     string `json:"last_activity"`      // 最后活动时间
	IsMonitored      bool   `json:"is_monitored"`       // 是否被监控
	MonitorCount     int    `json:"monitor_count"`      // 监控次数
	CanTerminate     bool   `json:"can_terminate"`      // 是否可以终止
	UnreadWarnings   int    `json:"unread_warnings"`    // 未读警告数
}

// SessionMonitorLogResponse 会话监控日志响应
type SessionMonitorLogResponse struct {
	ID            uint      `json:"id"`
	SessionID     string    `json:"session_id"`
	MonitorUserID uint      `json:"monitor_user_id"`
	MonitorUser   string    `json:"monitor_user"`
	ActionType    string    `json:"action_type"`
	ActionData    string    `json:"action_data"`
	Reason        string    `json:"reason"`
	CreatedAt     time.Time `json:"created_at"`
}

// SessionWarningResponse 会话警告响应
type SessionWarningResponse struct {
	ID             uint       `json:"id"`
	SessionID      string     `json:"session_id"`
	SenderUserID   uint       `json:"sender_user_id"`
	SenderUser     string     `json:"sender_user"`
	ReceiverUserID uint       `json:"receiver_user_id"`
	ReceiverUser   string     `json:"receiver_user"`
	Message        string     `json:"message"`
	Level          string     `json:"level"`
	IsRead         bool       `json:"is_read"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at"`
}

// MonitorStatistics 监控统计数据
type MonitorStatistics struct {
	ActiveSessions     int64 `json:"active_sessions"`
	ConnectedMonitors  int64 `json:"connected_monitors"`
	TotalConnections   int64 `json:"total_connections"`
	TerminatedSessions int64 `json:"terminated_sessions"`
	SentWarnings       int64 `json:"sent_warnings"`
	UnreadWarnings     int64 `json:"unread_warnings"`
}

// ======================== 表名映射 ========================

func (SessionMonitorLog) TableName() string {
	return "session_monitor_logs"
}

func (SessionWarning) TableName() string {
	return "session_warnings"
}

func (WebSocketConnection) TableName() string {
	return "websocket_connections"
}

// ======================== 模型方法 ========================

func (s *SessionMonitorLog) ToResponse() *SessionMonitorLogResponse {
	return &SessionMonitorLogResponse{
		ID:            s.ID,
		SessionID:     s.SessionID,
		MonitorUserID: s.MonitorUserID,
		MonitorUser:   s.MonitorUser.Username,
		ActionType:    s.ActionType,
		ActionData:    s.ActionData,
		Reason:        s.Reason,
		CreatedAt:     s.CreatedAt,
	}
}

func (s *SessionWarning) ToResponse() *SessionWarningResponse {
	return &SessionWarningResponse{
		ID:             s.ID,
		SessionID:      s.SessionID,
		SenderUserID:   s.SenderUserID,
		SenderUser:     s.SenderUser.Username,
		ReceiverUserID: s.ReceiverUserID,
		ReceiverUser:   s.ReceiverUser.Username,
		Message:        s.Message,
		Level:          s.Level,
		IsRead:         s.IsRead,
		CreatedAt:      s.CreatedAt,
		ReadAt:         s.ReadAt,
	}
}

// 扩展SessionRecord模型方法
func (s *SessionRecord) ToActiveResponse() *ActiveSessionResponse {
	base := s.ToResponse()
	
	connectionTime := int64(time.Since(s.StartTime).Seconds())
	inactiveTime := int64(0)
	if s.UpdatedAt.After(s.StartTime) {
		inactiveTime = int64(time.Since(s.UpdatedAt).Seconds())
	}

	return &ActiveSessionResponse{
		SessionRecordResponse: *base,
		ConnectionTime:        connectionTime,
		InactiveTime:          inactiveTime,
		LastActivity:          s.UpdatedAt.Format("2006-01-02 15:04:05"),
		IsMonitored:           false, // 需要从其他地方获取
		MonitorCount:          0,     // 需要从数据库查询
		CanTerminate:          s.Status == "active",
		UnreadWarnings:        0,     // 需要从数据库查询
	}
}

func (s *SessionWarning) MarkAsRead() {
	now := time.Now()
	s.IsRead = true
	s.ReadAt = &now
}

// ======================== 资产分组相关请求响应结构 ========================

// AssetGroupCreateRequest 资产分组创建请求
type AssetGroupCreateRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Description string `json:"description" binding:"omitempty,max=500"`
}

// AssetGroupUpdateRequest 资产分组更新请求
type AssetGroupUpdateRequest struct {
	Name        string `json:"name" binding:"omitempty,min=1,max=50"`
	Description string `json:"description" binding:"omitempty,max=500"`
}

// AssetGroupResponse 资产分组响应
type AssetGroupResponse struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	AssetCount  int       `json:"asset_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AssetGroupListRequest 资产分组列表请求
type AssetGroupListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Keyword  string `form:"keyword" binding:"omitempty,max=50"`
}

// AssetGroupResponse 转换方法
func (ag *AssetGroup) ToResponse() *AssetGroupResponse {
	return &AssetGroupResponse{
		ID:          ag.ID,
		Name:        ag.Name,
		Description: ag.Description,
		AssetCount:  len(ag.Assets),
		CreatedAt:   ag.CreatedAt,
		UpdatedAt:   ag.UpdatedAt,
	}
}
