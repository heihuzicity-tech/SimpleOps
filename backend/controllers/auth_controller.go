package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthController 认证控制器
type AuthController struct {
	authService  *services.AuthService
	auditService *services.AuditService
}

// NewAuthController 创建认证控制器实例
func NewAuthController(authService *services.AuthService) *AuthController {
	return &AuthController{
		authService:  authService,
		auditService: services.NewAuditService(utils.GetDB()),
	}
}

// Login 用户登录
// @Summary      用户登录
// @Description  用户使用用户名和密码登录系统
// @Tags         认证
// @Accept       json
// @Produce      json
// @Param        request body models.UserLoginRequest true "登录请求"
// @Success      200  {object}  models.DataResponse  "登录成功，返回用户信息和token"
// @Failure      400  {object}  models.ErrorResponse  "请求格式错误"
// @Failure      401  {object}  models.ErrorResponse  "用户名或密码错误"
// @Router       /auth/login [post]
func (ac *AuthController) Login(c *gin.Context) {
	var request models.UserLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 获取客户端信息
	clientIP := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	// 调用认证服务
	token, err := ac.authService.Login(&request)
	if err != nil {
		// 记录登录失败日志
		go ac.auditService.RecordLoginLog(
			0, // 登录失败时没有用户ID
			request.Username,
			clientIP,
			userAgent,
			"web",
			"failed",
			err.Error(),
		)

		utils.RespondWithUnauthorized(c, err.Error())
		return
	}

	// 获取用户信息
	var user models.User
	if err := utils.GetDB().Where("username = ?", request.Username).First(&user).Error; err == nil {
		// 记录登录成功日志
		go ac.auditService.RecordLoginLog(
			user.ID,
			user.Username,
			clientIP,
			userAgent,
			"web",
			"success",
			"Login successful",
		)
	}

	utils.RespondWithData(c, token)
}

// Logout 用户登出
// @Summary      用户登出
// @Description  用户登出系统，将token加入黑名单
// @Tags         认证
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "登出成功"
// @Failure      400  {object}  map[string]interface{}  "请求格式错误"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /auth/logout [post]
func (ac *AuthController) Logout(c *gin.Context) {
	// 获取token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		utils.RespondWithValidationError(c, "Authorization header is required")
		return
	}

	bearerToken := strings.Split(authHeader, " ")
	if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
		utils.RespondWithValidationError(c, "Invalid authorization format")
		return
	}

	tokenString := bearerToken[1]

	// 获取当前用户信息
	var userID uint
	var username string
	if userInterface, exists := c.Get("user"); exists {
		if u, ok := userInterface.(*models.User); ok {
			userID = u.ID
			username = u.Username
		}
	}

	// 调用认证服务
	if err := ac.authService.Logout(tokenString); err != nil {
		utils.RespondWithInternalError(c, "Failed to logout")
		return
	}

	// 记录登出日志
	if userID > 0 {
		go ac.auditService.RecordLoginLog(
			userID,
			username,
			c.ClientIP(),
			c.GetHeader("User-Agent"),
			"web",
			"logout",
			"User logged out successfully",
		)
	}

	utils.RespondWithSuccess(c, "Logout successful")
}

// RefreshToken 刷新token
// @Summary      刷新访问令牌
// @Description  使用现有的访问令牌获取新的访问令牌
// @Tags         认证
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "刷新成功"
// @Failure      400  {object}  map[string]interface{}  "请求格式错误"
// @Failure      401  {object}  map[string]interface{}  "令牌无效"
// @Router       /auth/refresh [post]
func (ac *AuthController) RefreshToken(c *gin.Context) {
	// 获取token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		utils.RespondWithValidationError(c, "Authorization header is required")
		return
	}

	bearerToken := strings.Split(authHeader, " ")
	if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
		utils.RespondWithValidationError(c, "Invalid authorization format")
		return
	}

	tokenString := bearerToken[1]

	// 调用认证服务
	newToken, err := ac.authService.RefreshToken(tokenString)
	if err != nil {
		utils.RespondWithUnauthorized(c, err.Error())
		return
	}

	utils.RespondWithData(c, newToken)
}

// GetProfile 获取用户资料
// @Summary      获取用户资料
// @Description  获取当前登录用户的详细资料
// @Tags         认证
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /auth/profile [get]
func (ac *AuthController) GetProfile(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		utils.RespondWithInternalError(c, "User ID not found in context")
		return
	}

	// 调用认证服务
	profile, err := ac.authService.GetProfile(userID.(uint))
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}

	utils.RespondWithData(c, profile)
}

// UpdateProfile 更新用户资料
func (ac *AuthController) UpdateProfile(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		utils.RespondWithInternalError(c, "User ID not found in context")
		return
	}

	var request models.UserUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 调用认证服务
	profile, err := ac.authService.UpdateProfile(userID.(uint), &request)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}

	utils.RespondWithData(c, profile)
}

// ChangePassword 修改密码
func (ac *AuthController) ChangePassword(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		utils.RespondWithInternalError(c, "User ID not found in context")
		return
	}

	var request models.PasswordChangeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 调用认证服务
	if err := ac.authService.ChangePassword(userID.(uint), &request); err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithSuccess(c, "Password changed successfully")
}

// GetCurrentUser 获取当前用户信息
func (ac *AuthController) GetCurrentUser(c *gin.Context) {
	// 从上下文获取用户信息
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithInternalError(c, "User not found in context")
		return
	}

	user, ok := userInterface.(*models.User)
	if !ok {
		utils.RespondWithInternalError(c, "Invalid user type")
		return
	}

	utils.RespondWithData(c, user.ToResponse())
}
