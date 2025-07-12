package middleware

import (
	"bastion/models"
	"bastion/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware JWT认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// 检查token格式
		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization format",
			})
			c.Abort()
			return
		}

		tokenString := bearerToken[1]

		// 检查token是否在黑名单中
		if utils.IsTokenBlacklisted(tokenString) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token is blacklisted",
			})
			c.Abort()
			return
		}

		// 验证token
		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token: " + err.Error(),
			})
			c.Abort()
			return
		}

		// 获取用户信息
		user, err := utils.GetUserFromToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not found: " + err.Error(),
			})
			c.Abort()
			return
		}

		// 将用户信息存储到上下文中
		c.Set("user", user)
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)

		c.Next()
	}
}

// RequirePermission 权限验证中间件
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取用户信息
		userInterface, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not found in context",
			})
			c.Abort()
			return
		}

		user, ok := userInterface.(*models.User)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user type",
			})
			c.Abort()
			return
		}

		// 检查权限
		if !user.HasPermission(permission) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Insufficient permissions",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireRole 角色验证中间件
func RequireRole(roleName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取用户信息
		userInterface, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User not found in context",
			})
			c.Abort()
			return
		}

		user, ok := userInterface.(*models.User)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user type",
			})
			c.Abort()
			return
		}

		// 检查角色
		if !user.HasRole(roleName) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Insufficient role",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdmin 管理员权限中间件
func RequireAdmin() gin.HandlerFunc {
	return RequireRole("admin")
}

// OptionalAuth 可选认证中间件（不强制要求登录）
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// 检查token格式
		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := bearerToken[1]

		// 检查token是否在黑名单中
		if utils.IsTokenBlacklisted(tokenString) {
			c.Next()
			return
		}

		// 验证token
		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		// 获取用户信息
		user, err := utils.GetUserFromToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		// 将用户信息存储到上下文中
		c.Set("user", user)
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)

		c.Next()
	}
}
