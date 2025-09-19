package utils

import "errors"

// 通用错误定义
var (
	// ErrNotFound 资源未找到
	ErrNotFound = errors.New("resource not found")
	
	// ErrDuplicate 资源重复
	ErrDuplicate = errors.New("resource already exists")
	
	// ErrInUse 资源正在使用中
	ErrInUse = errors.New("resource is in use")
	
	// ErrInvalidParam 无效参数
	ErrInvalidParam = errors.New("invalid parameter")
	
	// ErrPermissionDenied 权限不足
	ErrPermissionDenied = errors.New("permission denied")
	
	// ErrInternal 内部错误
	ErrInternal = errors.New("internal error")
)