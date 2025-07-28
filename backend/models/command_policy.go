package models

import (
	"time"
	"gorm.io/gorm"
)

// Command 命令定义
type Command struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:100;not null;uniqueIndex;comment:命令名称或正则表达式"`
	Type        string         `json:"type" gorm:"size:20;default:exact;comment:匹配类型: exact-精确匹配, regex-正则表达式"`
	Description string         `json:"description" gorm:"size:500;comment:命令描述"`
	Groups      []CommandGroup `json:"groups,omitempty" gorm:"many2many:command_group_commands;"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// CommandGroup 命令组
type CommandGroup struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:100;not null;uniqueIndex;comment:命令组名称"`
	Description string         `json:"description" gorm:"size:500;comment:命令组描述"`
	IsPreset    bool           `json:"is_preset" gorm:"default:false;comment:是否为系统预设组"`
	Commands    []Command      `json:"commands,omitempty" gorm:"many2many:command_group_commands;"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// CommandPolicy 命令策略
type CommandPolicy struct {
	ID          uint            `json:"id" gorm:"primaryKey"`
	Name        string          `json:"name" gorm:"size:100;not null;comment:策略名称"`
	Description string          `json:"description" gorm:"size:500;comment:策略描述"`
	Enabled     bool            `json:"enabled" gorm:"default:true;index;comment:是否启用"`
	Priority    int             `json:"priority" gorm:"default:50;index;comment:优先级（预留字段）"`
	Users       []User          `json:"users,omitempty" gorm:"many2many:policy_users;foreignKey:ID;joinForeignKey:policy_id;References:ID;joinReferences:user_id;"`
	Commands    []PolicyCommand `json:"commands,omitempty" gorm:"foreignKey:PolicyID"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}

// PolicyCommand 策略与命令/命令组关联
type PolicyCommand struct {
	ID             uint          `json:"id" gorm:"primaryKey"`
	PolicyID       uint          `json:"policy_id" gorm:"not null;index"`
	CommandID      *uint         `json:"command_id" gorm:"index"`
	CommandGroupID *uint         `json:"command_group_id" gorm:"index"`
	Policy         CommandPolicy `json:"-" gorm:"foreignKey:PolicyID"`
	Command        *Command      `json:"command,omitempty" gorm:"foreignKey:CommandID"`
	CommandGroup   *CommandGroup `json:"command_group,omitempty" gorm:"foreignKey:CommandGroupID"`
	CreatedAt      time.Time     `json:"created_at"`
}

// CommandInterceptLog 命令拦截日志
type CommandInterceptLog struct {
	ID            uint          `json:"id" gorm:"primaryKey"`
	SessionID     string        `json:"session_id" gorm:"size:100;not null;index;comment:SSH会话ID"`
	UserID        uint          `json:"user_id" gorm:"not null;index"`
	Username      string        `json:"username" gorm:"size:50;not null;comment:用户名"`
	AssetID       uint          `json:"asset_id" gorm:"not null;index"`
	Command       string        `json:"command" gorm:"type:text;not null;comment:被拦截的命令"`
	PolicyID      uint          `json:"policy_id" gorm:"not null;index;comment:触发的策略ID"`
	PolicyName    string        `json:"policy_name" gorm:"size:100;not null;comment:策略名称"`
	PolicyType    string        `json:"policy_type" gorm:"size:20;not null;comment:策略类型: command或command_group"`
	InterceptTime time.Time     `json:"intercept_time" gorm:"not null;index;comment:拦截时间"`
	AlertLevel    string        `json:"alert_level,omitempty" gorm:"size:20;comment:告警级别（预留字段）"`
	AlertSent     bool          `json:"alert_sent" gorm:"default:false;comment:是否已发送告警（预留字段）"`
	User          User          `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Asset         Asset         `json:"asset,omitempty" gorm:"foreignKey:AssetID"`
	Policy        CommandPolicy `json:"policy,omitempty" gorm:"foreignKey:PolicyID"`
	CreatedAt     time.Time     `json:"created_at"`
}

// TableName 指定表名
func (Command) TableName() string {
	return "commands"
}

func (CommandGroup) TableName() string {
	return "command_groups"
}

func (CommandPolicy) TableName() string {
	return "command_policies"
}

func (PolicyCommand) TableName() string {
	return "policy_commands"
}

func (CommandInterceptLog) TableName() string {
	return "command_intercept_logs"
}

// 请求和响应结构体

// CommandListRequest 命令列表请求
type CommandListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Name     string `form:"name" binding:"omitempty,max=100"`
	Type     string `form:"type" binding:"omitempty,oneof=exact regex"`
}

// CommandCreateRequest 创建命令请求
type CommandCreateRequest struct {
	Name        string `json:"name" binding:"required,max=100"`
	Type        string `json:"type" binding:"omitempty,oneof=exact regex"`
	Description string `json:"description" binding:"omitempty,max=500"`
}

// CommandUpdateRequest 更新命令请求
type CommandUpdateRequest struct {
	Name        string `json:"name" binding:"omitempty,max=100"`
	Type        string `json:"type" binding:"omitempty,oneof=exact regex"`
	Description string `json:"description" binding:"omitempty,max=500"`
}

// CommandGroupListRequest 命令组列表请求
type CommandGroupListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Name     string `form:"name" binding:"omitempty,max=100"`
	IsPreset *bool  `form:"is_preset" binding:"omitempty"`
}

// CommandGroupCreateRequest 创建命令组请求
type CommandGroupCreateRequest struct {
	Name        string   `json:"name" binding:"required,max=100"`
	Description string   `json:"description" binding:"omitempty,max=500"`
	CommandIDs  []uint   `json:"command_ids" binding:"omitempty"`
}

// CommandGroupUpdateRequest 更新命令组请求
type CommandGroupUpdateRequest struct {
	Name        string   `json:"name" binding:"omitempty,max=100"`
	Description string   `json:"description" binding:"omitempty,max=500"`
	CommandIDs  []uint   `json:"command_ids" binding:"omitempty"`
}

// PolicyListRequest 策略列表请求
type PolicyListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Name     string `form:"name" binding:"omitempty,max=100"`
	Enabled  *bool  `form:"enabled" binding:"omitempty"`
}

// PolicyCreateRequest 创建策略请求
type PolicyCreateRequest struct {
	Name        string `json:"name" binding:"required,max=100"`
	Description string `json:"description" binding:"omitempty,max=500"`
	Enabled     bool   `json:"enabled"`
}

// PolicyUpdateRequest 更新策略请求
type PolicyUpdateRequest struct {
	Name        string `json:"name" binding:"omitempty,max=100"`
	Description string `json:"description" binding:"omitempty,max=500"`
	Enabled     *bool  `json:"enabled" binding:"omitempty"`
}

// PolicyBindUsersRequest 绑定用户到策略请求
type PolicyBindUsersRequest struct {
	UserIDs []uint `json:"user_ids" binding:"required,min=1"`
}

// PolicyBindCommandsRequest 绑定命令/命令组到策略请求
type PolicyBindCommandsRequest struct {
	CommandIDs      []uint `json:"command_ids" binding:"omitempty"`
	CommandGroupIDs []uint `json:"command_group_ids" binding:"omitempty"`
}

// InterceptLogListRequest 拦截日志列表请求
type InterceptLogListRequest struct {
	Page       int    `form:"page" binding:"omitempty,min=1"`
	PageSize   int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	SessionID  string `form:"session_id" binding:"omitempty,max=100"`
	UserID     uint   `form:"user_id" binding:"omitempty"`
	AssetID    uint   `form:"asset_id" binding:"omitempty"`
	PolicyID   uint   `form:"policy_id" binding:"omitempty"`
	StartTime  string `form:"start_time" binding:"omitempty"`
	EndTime    string `form:"end_time" binding:"omitempty"`
}

// 响应结构体

// CommandResponse 命令响应
type CommandResponse struct {
	ID          uint                   `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Groups      []CommandGroupResponse `json:"groups,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// CommandGroupResponse 命令组响应
type CommandGroupResponse struct {
	ID          uint              `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	IsPreset    bool              `json:"is_preset"`
	Commands    []CommandResponse `json:"commands,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// PolicyResponse 策略响应
type PolicyResponse struct {
	ID          uint                    `json:"id"`
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	Enabled     bool                    `json:"enabled"`
	Priority    int                     `json:"priority"`
	UserCount   int                     `json:"user_count"`
	CommandCount int                    `json:"command_count"`
	Users       []UserBasicInfo         `json:"users,omitempty"`
	Commands    []PolicyCommandResponse `json:"commands,omitempty"`
	CreatedAt   time.Time               `json:"created_at"`
	UpdatedAt   time.Time               `json:"updated_at"`
}

// PolicyCommandResponse 策略命令响应
type PolicyCommandResponse struct {
	ID           uint                  `json:"id"`
	Type         string                `json:"type"` // "command" 或 "command_group"
	Command      *CommandResponse      `json:"command,omitempty"`
	CommandGroup *CommandGroupResponse `json:"command_group,omitempty"`
}

// UserBasicInfo 用户基本信息
type UserBasicInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
}

// InterceptLogResponse 拦截日志响应
type InterceptLogResponse struct {
	ID            uint      `json:"id"`
	SessionID     string    `json:"session_id"`
	UserID        uint      `json:"user_id"`
	Username      string    `json:"username"`
	AssetID       uint      `json:"asset_id"`
	AssetName     string    `json:"asset_name,omitempty"`
	AssetAddr     string    `json:"asset_addr,omitempty"`
	Command       string    `json:"command"`
	PolicyID      uint      `json:"policy_id"`
	PolicyName    string    `json:"policy_name"`
	PolicyType    string    `json:"policy_type"`
	InterceptTime time.Time `json:"intercept_time"`
	AlertLevel    string    `json:"alert_level,omitempty"`
	AlertSent     bool      `json:"alert_sent"`
}

// 分页响应
type PageResponse struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Data     interface{} `json:"data"`
}