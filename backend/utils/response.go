package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PaginatedData 分页数据结构
type PaginatedData struct {
	Items      interface{} `json:"items"`       // 数据列表
	Page       int        `json:"page"`        // 当前页码
	PageSize   int        `json:"page_size"`   // 每页大小
	Total      int64      `json:"total"`       // 总记录数
	TotalPages int        `json:"total_pages"` // 总页数
}

// RespondWithPagination 返回分页数据响应
// 用于列表查询接口，统一分页数据格式
func RespondWithPagination(c *gin.Context, items interface{}, page, pageSize int, total int64) {
	// 防止除零错误，设置默认值
	if pageSize <= 0 {
		pageSize = 10 // 默认每页10条
	}
	if page <= 0 {
		page = 1 // 默认第一页
	}
	
	// 计算总页数
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 0 {
		totalPages = 0
	}

	// 确保 items 不为 nil，使用空切片而不是nil
	if items == nil {
		items = []interface{}{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": PaginatedData{
			Items:      items,
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: totalPages,
		},
	})
}

// RespondWithData 返回单项数据响应
// 用于获取单个资源或创建资源后的响应
func RespondWithData(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// RespondWithSuccess 返回操作成功响应
// 用于删除、更新等操作成功但不需要返回数据的场景
func RespondWithSuccess(c *gin.Context, message string) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": message,
	})
}

// RespondWithError 返回错误响应
// 统一的错误响应格式，包含错误信息和可选的详细信息
func RespondWithError(c *gin.Context, code int, errorMsg string, details ...string) {
	response := gin.H{
		"success": false,
		"error":   errorMsg,
	}

	// 如果提供了详细信息，添加到响应中
	if len(details) > 0 && details[0] != "" {
		response["details"] = details[0]
	}

	c.JSON(code, response)
}

// RespondWithValidationError 返回验证错误响应
// 用于请求参数验证失败的场景
func RespondWithValidationError(c *gin.Context, message string) {
	RespondWithError(c, http.StatusBadRequest, message)
}

// RespondWithNotFound 返回资源不存在响应
// 用于查询资源不存在的场景
func RespondWithNotFound(c *gin.Context, resource string) {
	RespondWithError(c, http.StatusNotFound, resource+"不存在")
}

// RespondWithUnauthorized 返回未授权响应
// 用于认证失败的场景
func RespondWithUnauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "未授权访问"
	}
	RespondWithError(c, http.StatusUnauthorized, message)
}

// RespondWithForbidden 返回权限不足响应
// 用于权限验证失败的场景
func RespondWithForbidden(c *gin.Context, message string) {
	if message == "" {
		message = "权限不足"
	}
	RespondWithError(c, http.StatusForbidden, message)
}

// RespondWithInternalError 返回服务器内部错误响应
// 用于服务器内部错误的场景，生产环境不应暴露详细错误信息
func RespondWithInternalError(c *gin.Context, message string) {
	// 返回通用错误信息，不暴露内部细节
	RespondWithError(c, http.StatusInternalServerError, message)
}

// RespondWithConflict 返回冲突错误响应
// 用于资源冲突的场景，如重复创建等
func RespondWithConflict(c *gin.Context, message string) {
	RespondWithError(c, http.StatusConflict, message)
}