package models

// BaseResponse 基础响应结构
type BaseResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// DataResponse 带数据的响应结构
type DataResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data"`
}

// PaginatedResponse 分页响应结构
type PaginatedResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message,omitempty"`
	Data    PaginatedDataWrap `json:"data"`
}

// PaginatedDataWrap 分页数据包装
type PaginatedDataWrap struct {
	Items      interface{} `json:"items"`       // 数据列表
	Page       int        `json:"page"`        // 当前页码
	PageSize   int        `json:"page_size"`   // 每页大小
	Total      int64      `json:"total"`       // 总记录数
	TotalPages int        `json:"total_pages"` // 总页数
}

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Success bool   `json:"success"` // 始终为 false
	Error   string `json:"error"`   // 错误信息
	Details string `json:"details,omitempty"` // 详细错误信息（可选）
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