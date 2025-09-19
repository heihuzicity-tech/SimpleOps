package models

import (
	"strings"
	"time"
	"gorm.io/gorm"
)

// CommandGroup 命令组
type CommandGroup struct {
	ID        uint                `json:"id" gorm:"primaryKey"`
	Name      string              `json:"name" gorm:"size:100;not null;uniqueIndex;comment:命令组名称"`
	Remark    string              `json:"remark" gorm:"size:500;comment:备注"`
	Items     []CommandGroupItem  `json:"items,omitempty" gorm:"foreignKey:CommandGroupID;constraint:OnDelete:CASCADE;"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
	DeletedAt gorm.DeletedAt      `json:"deleted_at,omitempty" gorm:"index"`
}

// CommandGroupItem 命令组项
type CommandGroupItem struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	CommandGroupID  uint      `json:"command_group_id" gorm:"not null;index;comment:所属命令组ID"`
	Type            string    `json:"type" gorm:"size:20;default:command;comment:类型: command-命令, regex-正则表达式"`
	Content         string    `json:"content" gorm:"size:500;not null;index:idx_content,length:100;comment:命令内容或正则表达式"`
	IgnoreCase      bool      `json:"ignore_case" gorm:"default:false;comment:是否忽略大小写"`
	SortOrder       int       `json:"sort_order" gorm:"default:0;comment:排序顺序"`
	CreatedAt       time.Time `json:"created_at"`
	
	// 关联
	CommandGroup    *CommandGroup `json:"-" gorm:"foreignKey:CommandGroupID;constraint:OnDelete:CASCADE;"`
}

// CommandFilter 命令过滤规则
type CommandFilter struct {
	ID              uint              `json:"id" gorm:"primaryKey"`
	Name            string            `json:"name" gorm:"size:100;not null;comment:过滤规则名称"`
	Priority        int               `json:"priority" gorm:"default:50;index:idx_priority_enabled;comment:优先级，1-100，数字越小优先级越高"`
	Enabled         bool              `json:"enabled" gorm:"default:true;index:idx_priority_enabled;comment:是否启用"`
	UserType        string            `json:"user_type" gorm:"size:20;default:all;index;comment:用户类型: all-全部, specific-指定, attribute-属性"`
	AssetType       string            `json:"asset_type" gorm:"size:20;default:all;index;comment:资产类型: all-全部, specific-指定, attribute-属性"`
	AccountType     string            `json:"account_type" gorm:"size:20;default:all;index;comment:账号类型: all-全部, specific-指定"`
	AccountNames    string            `json:"account_names" gorm:"size:500;comment:指定账号名称，逗号分隔"`
	CommandGroupID  uint              `json:"command_group_id" gorm:"not null;index;comment:关联的命令组ID"`
	Action          string            `json:"action" gorm:"size:20;not null;comment:动作: deny-拒绝, allow-接受, alert-告警, prompt_alert-提示并告警"`
	Remark          string            `json:"remark" gorm:"size:500;comment:备注"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	DeletedAt       gorm.DeletedAt    `json:"deleted_at,omitempty" gorm:"index"`
	
	// 关联
	CommandGroup    *CommandGroup     `json:"command_group,omitempty" gorm:"foreignKey:CommandGroupID;constraint:OnDelete:RESTRICT;"`
	Users           []User            `json:"users,omitempty" gorm:"many2many:filter_users;joinForeignKey:filter_id;joinReferences:user_id;"`
	Assets          []Asset           `json:"assets,omitempty" gorm:"many2many:filter_assets;joinForeignKey:filter_id;joinReferences:asset_id;"`
	Attributes      []FilterAttribute `json:"attributes,omitempty" gorm:"foreignKey:FilterID;constraint:OnDelete:CASCADE;"`
}

// FilterAttribute 过滤规则属性
type FilterAttribute struct {
	ID              uint          `json:"id" gorm:"primaryKey"`
	FilterID        uint          `json:"filter_id" gorm:"not null;index;comment:过滤规则ID"`
	TargetType      string        `json:"target_type" gorm:"size:20;not null;index:idx_target_attribute;comment:目标类型: user-用户属性, asset-资产属性"`
	AttributeName   string        `json:"attribute_name" gorm:"size:50;not null;index:idx_target_attribute;comment:属性名称"`
	AttributeValue  string        `json:"attribute_value" gorm:"size:200;not null;comment:属性值"`
	
	// 关联
	Filter          *CommandFilter `json:"-" gorm:"foreignKey:FilterID;constraint:OnDelete:CASCADE;"`
}

// CommandFilterLog 命令过滤日志
type CommandFilterLog struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	SessionID   string    `json:"session_id" gorm:"size:100;not null;index;comment:SSH会话ID"`
	UserID      uint      `json:"user_id" gorm:"not null;index;comment:用户ID"`
	Username    string    `json:"username" gorm:"size:50;not null;comment:用户名"`
	AssetID     uint      `json:"asset_id" gorm:"not null;index;comment:资产ID"`
	AssetName   string    `json:"asset_name" gorm:"size:100;not null;comment:资产名称"`
	Account     string    `json:"account" gorm:"size:50;not null;comment:登录账号"`
	Command     string    `json:"command" gorm:"type:text;not null;comment:执行的命令"`
	FilterID    uint      `json:"filter_id" gorm:"not null;index;comment:触发的过滤规则ID"`
	FilterName  string    `json:"filter_name" gorm:"size:100;not null;comment:过滤规则名称"`
	Action      string    `json:"action" gorm:"size:20;not null;comment:执行的动作"`
	CreatedAt   time.Time `json:"created_at" gorm:"index"`
	
	// 关联（仅用于查询，不设置外键约束避免删除用户/资产时的问题）
	User        *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Asset       *Asset    `json:"asset,omitempty" gorm:"foreignKey:AssetID"`
}

// TableName 指定表名
func (CommandGroup) TableName() string {
	return "command_groups"
}

func (CommandGroupItem) TableName() string {
	return "command_group_items"
}

func (CommandFilter) TableName() string {
	return "command_filters"
}

func (FilterAttribute) TableName() string {
	return "filter_attributes"
}

func (CommandFilterLog) TableName() string {
	return "command_filter_logs"
}

// 常量定义
const (
	// 过滤目标类型
	FilterTargetAll       = "all"       // 全部
	FilterTargetSpecific  = "specific"  // 指定
	FilterTargetAttribute = "attribute" // 属性
	
	// 命令类型
	CommandTypeExact = "command" // 精确匹配
	CommandTypeRegex = "regex"   // 正则表达式
	
	// 过滤动作
	FilterActionDeny        = "deny"         // 拒绝
	FilterActionAllow       = "allow"        // 允许
	FilterActionAlert       = "alert"        // 告警
	FilterActionPromptAlert = "prompt_alert" // 提示并告警
	
	// 属性目标类型
	AttributeTargetUser  = "user"  // 用户属性
	AttributeTargetAsset = "asset" // 资产属性
)

// 辅助方法

// IsRegex 判断命令项是否为正则表达式
func (item *CommandGroupItem) IsRegex() bool {
	return item.Type == CommandTypeRegex
}

// IsEnabled 判断过滤规则是否启用
func (filter *CommandFilter) IsEnabled() bool {
	return filter.Enabled
}

// HasSpecificUsers 判断是否指定了特定用户
func (filter *CommandFilter) HasSpecificUsers() bool {
	return filter.UserType == FilterTargetSpecific
}

// HasSpecificAssets 判断是否指定了特定资产
func (filter *CommandFilter) HasSpecificAssets() bool {
	return filter.AssetType == FilterTargetSpecific
}

// HasSpecificAccounts 判断是否指定了特定账号
func (filter *CommandFilter) HasSpecificAccounts() bool {
	return filter.AccountType == FilterTargetSpecific && filter.AccountNames != ""
}

// GetAccountList 获取账号列表
func (filter *CommandFilter) GetAccountList() []string {
	if filter.AccountNames == "" {
		return []string{}
	}
	// 这里简单处理，实际使用时可能需要更复杂的解析逻辑
	accounts := []string{}
	for _, account := range splitAndTrim(filter.AccountNames, ",") {
		if account != "" {
			accounts = append(accounts, account)
		}
	}
	return accounts
}

// splitAndTrim 分割字符串并去除空格
func splitAndTrim(s string, sep string) []string {
	parts := []string{}
	for _, part := range strings.Split(s, sep) {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}