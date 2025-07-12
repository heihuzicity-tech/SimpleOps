package models

import (
	"encoding/json"
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
	Permissions JSON           `json:"permissions" gorm:"type:json"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联关系
	UserRoles []UserRole `json:"user_roles" gorm:"foreignKey:RoleID"`
	Users     []User     `json:"users" gorm:"many2many:user_roles"`
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

// JSON 自定义JSON类型
type JSON []string

// Scan 实现Scanner接口
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return nil
	}
}

// Value 实现Valuer接口
func (j JSON) Value() (interface{}, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return json.Marshal(j)
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

// HasPermission 检查用户是否拥有指定权限
func (u *User) HasPermission(permission string) bool {
	for _, role := range u.Roles {
		// 检查是否有全部权限
		for _, perm := range role.Permissions {
			if perm == "all" || perm == permission {
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
