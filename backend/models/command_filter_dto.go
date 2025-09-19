package models

import "time"

// ========================================
// 通用分页响应结构体
// ========================================

// PageResponse 分页响应
type PageResponse struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Data     interface{} `json:"data"`
}

// ========================================
// 命令组相关请求响应结构体
// ========================================

// CommandGroupListRequest 命令组列表请求
type CommandGroupListRequest struct {
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Name     string `form:"name" binding:"omitempty,max=100"`
}

// CommandGroupCreateRequest 创建命令组请求
type CommandGroupCreateRequest struct {
	Name   string                    `json:"name" binding:"required,max=100"`
	Remark string                    `json:"remark" binding:"omitempty,max=500"`
	Items  []CommandGroupItemRequest `json:"items" binding:"required,min=1,dive"`
}

// CommandGroupUpdateRequest 更新命令组请求
type CommandGroupUpdateRequest struct {
	Name   string                    `json:"name" binding:"omitempty,max=100"`
	Remark string                    `json:"remark" binding:"omitempty,max=500"`
	Items  []CommandGroupItemRequest `json:"items" binding:"omitempty,dive"`
}

// CommandGroupItemRequest 命令组项请求
type CommandGroupItemRequest struct {
	Type       string `json:"type" binding:"required,oneof=command regex"`
	Content    string `json:"content" binding:"required,max=500"`
	IgnoreCase bool   `json:"ignore_case"`
	SortOrder  int    `json:"sort_order"`
}

// CommandGroupResponse 命令组响应
type CommandGroupResponse struct {
	ID         uint                        `json:"id"`
	Name       string                      `json:"name"`
	Remark     string                      `json:"remark"`
	ItemCount  int                         `json:"item_count"`
	Items      []CommandGroupItemResponse  `json:"items,omitempty"`
	CreatedAt  time.Time                   `json:"created_at"`
	UpdatedAt  time.Time                   `json:"updated_at"`
}

// CommandGroupItemResponse 命令组项响应
type CommandGroupItemResponse struct {
	ID         uint   `json:"id"`
	Type       string `json:"type"`
	Content    string `json:"content"`
	IgnoreCase bool   `json:"ignore_case"`
	SortOrder  int    `json:"sort_order"`
}

// ========================================
// 命令过滤相关请求响应结构体
// ========================================

// CommandFilterListRequest 命令过滤列表请求
type CommandFilterListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Name      string `form:"name" binding:"omitempty,max=100"`
	Enabled   *bool  `form:"enabled" binding:"omitempty"`
	Action    string `form:"action" binding:"omitempty"`
}

// CommandFilterCreateRequest 创建命令过滤请求
type CommandFilterCreateRequest struct {
	Name           string                    `json:"name" binding:"required,max=100"`
	Priority       int                       `json:"priority" binding:"omitempty,min=1,max=100"`
	Enabled        bool                      `json:"enabled"`
	UserType       string                    `json:"user_type" binding:"required,oneof=all specific attribute"`
	UserIDs        []uint                    `json:"user_ids" binding:"omitempty"`
	UserAttributes []FilterAttributeRequest  `json:"user_attributes" binding:"omitempty,dive"`
	AssetType      string                    `json:"asset_type" binding:"required,oneof=all specific attribute"`
	AssetIDs       []uint                    `json:"asset_ids" binding:"omitempty"`
	AssetAttributes []FilterAttributeRequest `json:"asset_attributes" binding:"omitempty,dive"`
	AccountType    string                    `json:"account_type" binding:"required,oneof=all specific"`
	AccountNames   string                    `json:"account_names" binding:"omitempty,max=500"`
	CommandGroupID uint                      `json:"command_group_id" binding:"required"`
	Action         string                    `json:"action" binding:"required,oneof=deny allow alert prompt_alert"`
	Remark         string                    `json:"remark" binding:"omitempty,max=500"`
	Attributes     []FilterAttributeRequest  `json:"attributes" binding:"omitempty,dive"`
}

// CommandFilterUpdateRequest 更新命令过滤请求
type CommandFilterUpdateRequest struct {
	Name           string                     `json:"name" binding:"omitempty,max=100"`
	Priority       int                        `json:"priority" binding:"omitempty,min=1,max=100"`
	Enabled        *bool                      `json:"enabled" binding:"omitempty"`
	UserType       string                     `json:"user_type" binding:"omitempty,oneof=all specific attribute"`
	UserIDs        *[]uint                    `json:"user_ids" binding:"omitempty"`
	UserAttributes []FilterAttributeRequest   `json:"user_attributes" binding:"omitempty,dive"`
	AssetType      string                     `json:"asset_type" binding:"omitempty,oneof=all specific attribute"`
	AssetIDs       *[]uint                    `json:"asset_ids" binding:"omitempty"`
	AssetAttributes []FilterAttributeRequest  `json:"asset_attributes" binding:"omitempty,dive"`
	AccountType    string                     `json:"account_type" binding:"omitempty,oneof=all specific"`
	AccountNames   *string                    `json:"account_names" binding:"omitempty,max=500"`
	CommandGroupID uint                       `json:"command_group_id" binding:"omitempty"`
	Action         string                     `json:"action" binding:"omitempty,oneof=deny allow alert prompt_alert"`
	Remark         *string                    `json:"remark" binding:"omitempty,max=500"`
	Attributes     *[]FilterAttributeRequest  `json:"attributes" binding:"omitempty,dive"`
}

// FilterAttributeRequest 过滤属性请求
type FilterAttributeRequest struct {
	TargetType     string `json:"target_type" binding:"required,oneof=user asset"`
	AttributeName  string `json:"attribute_name" binding:"required,max=50"`
	AttributeValue string `json:"attribute_value" binding:"required,max=200"`
}

// CommandFilterResponse 命令过滤响应
type CommandFilterResponse struct {
	ID              uint                         `json:"id"`
	Name            string                       `json:"name"`
	Priority        int                          `json:"priority"`
	Enabled         bool                         `json:"enabled"`
	UserType        string                       `json:"user_type"`
	UserCount       int                          `json:"user_count"`
	Users           []UserBasicResponse          `json:"users,omitempty"`
	UserIDs         []uint                       `json:"user_ids,omitempty"`
	UserAttributes  []FilterAttributeResponse    `json:"user_attributes,omitempty"`
	AssetType       string                       `json:"asset_type"`
	AssetCount      int                          `json:"asset_count"`
	Assets          []AssetBasicResponse         `json:"assets,omitempty"`
	AssetIDs        []uint                       `json:"asset_ids,omitempty"`
	AssetAttributes []FilterAttributeResponse    `json:"asset_attributes,omitempty"`
	AccountType     string                       `json:"account_type"`
	AccountNames    string                       `json:"account_names,omitempty"`
	AccountList     []string                     `json:"account_list,omitempty"`
	CommandGroupID  uint                         `json:"command_group_id"`
	CommandGroupName string                      `json:"command_group_name,omitempty"`
	CommandGroup    *CommandGroupBasicResponse   `json:"command_group,omitempty"`
	Action          string                       `json:"action"`
	Remark          string                       `json:"remark"`
	Attributes      []FilterAttributeResponse    `json:"attributes,omitempty"`
	CreatedAt       time.Time                    `json:"created_at"`
	UpdatedAt       time.Time                    `json:"updated_at"`
}

// CommandFilterSimpleResponse 命令过滤简单响应（用于列表）
type CommandFilterSimpleResponse struct {
	ID             uint                       `json:"id"`
	Name           string                     `json:"name"`
	Priority       int                        `json:"priority"`
	Enabled        bool                       `json:"enabled"`
	UserType       string                     `json:"user_type"`
	UserCount      int                        `json:"user_count"`
	AssetType      string                     `json:"asset_type"`
	AssetCount     int                        `json:"asset_count"`
	AccountType    string                     `json:"account_type"`
	CommandGroup   *CommandGroupBasicResponse `json:"command_group"`
	Action         string                     `json:"action"`
	CreatedAt      time.Time                  `json:"created_at"`
}

// FilterAttributeResponse 过滤属性响应
type FilterAttributeResponse struct {
	ID             uint   `json:"id"`
	TargetType     string `json:"target_type"`
	AttributeName  string `json:"attribute_name"`
	AttributeValue string `json:"attribute_value"`
}

// CommandGroupBasicResponse 命令组基本响应
type CommandGroupBasicResponse struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	ItemCount int    `json:"item_count"`
}

// UserBasicResponse 用户基本响应
type UserBasicResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Realname string `json:"realname,omitempty"`
}

// AssetBasicResponse 资产基本响应
type AssetBasicResponse struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	Type     string `json:"type,omitempty"`
}

// ========================================
// 命令过滤日志相关请求响应结构体
// ========================================

// CommandFilterLogListRequest 命令过滤日志列表请求
type CommandFilterLogListRequest struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	SessionID string `form:"session_id" binding:"omitempty,max=100"`
	UserID    uint   `form:"user_id" binding:"omitempty"`
	AssetID   uint   `form:"asset_id" binding:"omitempty"`
	FilterID  uint   `form:"filter_id" binding:"omitempty"`
	Action    string `form:"action" binding:"omitempty,oneof=deny allow alert prompt_alert"`
	StartTime string `form:"start_time" binding:"omitempty"`
	EndTime   string `form:"end_time" binding:"omitempty"`
}

// CommandFilterLogResponse 命令过滤日志响应
type CommandFilterLogResponse struct {
	ID         uint      `json:"id"`
	SessionID  string    `json:"session_id"`
	UserID     uint      `json:"user_id"`
	Username   string    `json:"username"`
	AssetID    uint      `json:"asset_id"`
	AssetName  string    `json:"asset_name"`
	AssetIP    string    `json:"asset_ip,omitempty"`
	Account    string    `json:"account"`
	Command    string    `json:"command"`
	FilterID   uint      `json:"filter_id"`
	FilterName string    `json:"filter_name"`
	Action     string    `json:"action"`
	CreatedAt  time.Time `json:"created_at"`
}

// ========================================
// 命令匹配相关请求响应结构体
// ========================================

// CommandMatchRequest 命令匹配请求（用于测试）
type CommandMatchRequest struct {
	Command  string `json:"command" binding:"required"`
	UserID   uint   `json:"user_id" binding:"required"`
	AssetID  uint   `json:"asset_id" binding:"required"`
	Account  string `json:"account" binding:"required,max=50"`
}

// CommandMatchResponse 命令匹配响应
type CommandMatchResponse struct {
	Matched    bool                      `json:"matched"`
	Action     string                    `json:"action,omitempty"`
	FilterID   uint                      `json:"filter_id,omitempty"`
	FilterName string                    `json:"filter_name,omitempty"`
	Priority   int                       `json:"priority,omitempty"`
	Reason     string                    `json:"reason,omitempty"`
}

// ========================================
// 统计相关响应结构体
// ========================================

// CommandFilterLogStatsRequest 命令过滤日志统计请求
type CommandFilterLogStatsRequest struct {
	StartTime *time.Time `form:"start_time" binding:"omitempty"`
	EndTime   *time.Time `form:"end_time" binding:"omitempty"`
}

// CommandFilterLogStatsResponse 命令过滤日志统计响应
type CommandFilterLogStatsResponse struct {
	TotalCount   int64            `json:"total_count"`
	ActionCounts map[string]int64 `json:"action_counts"`
	TopUsers     []TopUser        `json:"top_users"`
	TopFilters   []TopFilter      `json:"top_filters"`
}

// TopUser 最活跃用户
type TopUser struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Count    int64  `json:"count"`
}

// TopFilter 最常触发的过滤器
type TopFilter struct {
	FilterID   uint   `json:"filter_id"`
	FilterName string `json:"filter_name"`
	Count      int64  `json:"count"`
}

// CommandFilterStatsResponse 命令过滤统计响应
type CommandFilterStatsResponse struct {
	TotalFilters    int                     `json:"total_filters"`
	EnabledFilters  int                     `json:"enabled_filters"`
	TotalGroups     int                     `json:"total_groups"`
	TotalCommands   int                     `json:"total_commands"`
	TotalLogs       int                     `json:"total_logs"`
	ActionStats     []ActionStatItem        `json:"action_stats"`
	RecentLogs      []CommandFilterLogResponse `json:"recent_logs"`
}

// ActionStatItem 动作统计项
type ActionStatItem struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
}

// ========================================
// 批量操作请求结构体
// ========================================

// BatchDeleteRequest 批量删除请求
type BatchDeleteRequest struct {
	IDs []uint `json:"ids" binding:"required,min=1"`
}

// BatchEnableRequest 批量启用/禁用请求
type BatchEnableRequest struct {
	IDs     []uint `json:"ids" binding:"required,min=1"`
	Enabled bool   `json:"enabled"`
}

// ========================================
// 导入导出请求响应结构体
// ========================================

// CommandFilterExportRequest 命令过滤导出请求
type CommandFilterExportRequest struct {
	FilterIDs []uint `json:"filter_ids" binding:"omitempty"`
	GroupIDs  []uint `json:"group_ids" binding:"omitempty"`
}

// CommandFilterImportRequest 命令过滤导入请求
type CommandFilterImportRequest struct {
	Groups  []CommandGroupExportData  `json:"groups" binding:"omitempty"`
	Filters []CommandFilterExportData `json:"filters" binding:"omitempty"`
}

// CommandGroupExportData 命令组导出数据
type CommandGroupExportData struct {
	Name   string                    `json:"name"`
	Remark string                    `json:"remark"`
	Items  []CommandGroupItemRequest `json:"items"`
}

// CommandFilterExportData 命令过滤导出数据
type CommandFilterExportData struct {
	Name            string                   `json:"name"`
	Priority        int                      `json:"priority"`
	Enabled         bool                     `json:"enabled"`
	UserType        string                   `json:"user_type"`
	UserIDs         []uint                   `json:"user_ids,omitempty"`
	AssetType       string                   `json:"asset_type"`
	AssetIDs        []uint                   `json:"asset_ids,omitempty"`
	AccountType     string                   `json:"account_type"`
	AccountNames    string                   `json:"account_names"`
	CommandGroupName string                  `json:"command_group_name"`
	Action          string                   `json:"action"`
	Remark          string                   `json:"remark"`
	Attributes      []FilterAttributeRequest `json:"attributes,omitempty"`
}