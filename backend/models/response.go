package models

// BaseResponse 基础响应结构
// @Description 基础响应结构，用于无数据返回的成功操作
type BaseResponse struct {
	Success bool   `json:"success" example:"true" description:"操作成功标识"`
	Message string `json:"message,omitempty" example:"操作成功" description:"操作结果描述"`
}

// DataResponse 带数据的响应结构
// @Description 单项数据响应结构，用于返回单个资源数据
type DataResponse struct {
	Success bool        `json:"success" example:"true" description:"操作成功标识"`
	Message string      `json:"message,omitempty" example:"获取成功" description:"操作结果描述"`
	Data    interface{} `json:"data" description:"返回的数据内容"`
}

// PaginatedResponse 分页响应结构
// @Description 分页数据响应结构，用于返回分页列表数据
type PaginatedResponse struct {
	Success bool              `json:"success" example:"true" description:"操作成功标识"`
	Message string            `json:"message,omitempty" example:"获取成功" description:"操作结果描述"`
	Data    PaginatedDataWrap `json:"data" description:"分页数据内容"`
}

// PaginatedDataWrap 分页数据包装
// @Description 分页数据包装结构
type PaginatedDataWrap struct {
	Items      interface{} `json:"items" description:"数据列表，统一使用items字段"`
	Page       int        `json:"page" example:"1" description:"当前页码，从1开始"`
	PageSize   int        `json:"page_size" example:"10" description:"每页记录数"`
	Total      int64      `json:"total" example:"100" description:"总记录数"`
	TotalPages int        `json:"total_pages" example:"10" description:"总页数，自动计算"`
}

// ErrorResponse 错误响应结构
// @Description 错误响应结构，用于所有错误情况
type ErrorResponse struct {
	Success bool   `json:"success" example:"false" description:"操作成功标识，错误时始终为false"`
	Error   string `json:"error" example:"资源不存在" description:"错误信息"`
	Details string `json:"details,omitempty" example:"ID为123的用户不存在" description:"详细错误信息（可选）"`
}

// 常用的响应消息
const (
	MsgCreateSuccess = "创建成功"
	MsgUpdateSuccess = "更新成功"
	MsgDeleteSuccess = "删除成功"
	MsgOperationSuccess = "操作成功"
	
	MsgBadRequest = "请求参数错误"
	MsgUnauthorized = "未授权访问"
	MsgForbidden = "权限不足"
	MsgNotFound = "资源不存在"
	MsgConflict = "资源冲突"
	MsgInternalError = "服务器内部错误"
)