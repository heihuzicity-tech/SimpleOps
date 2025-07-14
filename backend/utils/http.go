package utils

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
)

// ResetRequestBody 重置HTTP请求体
// 用于在中间件中读取请求体后重新设置请求体，以便后续处理能够正常读取
func ResetRequestBody(req *http.Request, body []byte) io.ReadCloser {
	return io.NopCloser(bytes.NewBuffer(body))
}

// GetClientIP 获取客户端真实IP地址
func GetClientIP(req *http.Request) string {
	// 检查 X-Forwarded-For 头
	if xff := req.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}

	// 检查 X-Real-IP 头
	if xri := req.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// 检查 CF-Connecting-IP 头 (Cloudflare)
	if cfip := req.Header.Get("CF-Connecting-IP"); cfip != "" {
		return cfip
	}

	// 使用 RemoteAddr
	return req.RemoteAddr
}

// GetUserAgent 获取用户代理字符串
func GetUserAgent(req *http.Request) string {
	return req.Header.Get("User-Agent")
}

// GenerateID 生成随机ID
func GenerateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}
