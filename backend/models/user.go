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
