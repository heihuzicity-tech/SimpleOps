package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"strconv"

	"github.com/gin-gonic/gin"
)

// UserController 用户控制器
type UserController struct {
	userService *services.UserService
}

// NewUserController 创建用户控制器实例
func NewUserController(userService *services.UserService) *UserController {
	return &UserController{userService: userService}
}

// CreateUser 创建用户
func (uc *UserController) CreateUser(c *gin.Context) {
	var request models.UserCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 调用用户服务
	user, err := uc.userService.CreateUser(&request)
	if err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithData(c, user)
}

// GetUsers 获取用户列表
// @Summary      获取用户列表
// @Description  获取用户列表，支持分页和搜索
// @Tags         用户管理
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "页码，默认1"           minimum(1)
// @Param        page_size query    int     false  "每页大小，默认10"       minimum(1) maximum(100)
// @Param        keyword   query    string  false  "搜索关键词"
// @Success      200       {object} models.PaginatedResponse  "获取成功，返回用户列表"
// @Failure      401       {object} models.ErrorResponse      "未授权"
// @Failure      403       {object} models.ErrorResponse      "权限不足"
// @Failure      500       {object} models.ErrorResponse      "服务器内部错误"
// @Router       /users [get]
// @Security     BearerAuth
func (uc *UserController) GetUsers(c *gin.Context) {
	// 获取分页参数
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	// 调用用户服务
	users, total, err := uc.userService.GetUsers(page, pageSize)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}

	utils.RespondWithPagination(c, users, page, pageSize, total)
}

// GetUser 获取单个用户
// @Summary      获取用户详情
// @Description  根据用户ID获取用户详细信息
// @Tags         用户管理
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "用户ID"
// @Success      200  {object} models.DataResponse    "获取成功，返回用户详情"
// @Failure      400  {object} models.ErrorResponse   "参数错误"
// @Failure      401  {object} models.ErrorResponse   "未授权"
// @Failure      403  {object} models.ErrorResponse   "权限不足"
// @Failure      404  {object} models.ErrorResponse   "用户不存在"
// @Router       /users/{id} [get]
// @Security     BearerAuth
func (uc *UserController) GetUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "Invalid user ID")
		return
	}

	// 调用用户服务
	user, err := uc.userService.GetUser(uint(userID))
	if err != nil {
		utils.RespondWithNotFound(c, "User")
		return
	}

	utils.RespondWithData(c, user)
}

// UpdateUser 更新用户
func (uc *UserController) UpdateUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "Invalid user ID")
		return
	}

	var request models.UserUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 调用用户服务
	user, err := uc.userService.UpdateUser(uint(userID), &request)
	if err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithData(c, user)
}

// DeleteUser 删除用户
func (uc *UserController) DeleteUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "Invalid user ID")
		return
	}

	// 调用用户服务
	if err := uc.userService.DeleteUser(uint(userID)); err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithSuccess(c, "User deleted successfully")
}

// ResetPassword 重置密码
func (uc *UserController) ResetPassword(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "Invalid user ID")
		return
	}

	var request struct {
		NewPassword string `json:"new_password" binding:"required,min=6,max=50"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		utils.RespondWithValidationError(c, "Invalid request format")
		return
	}

	// 调用用户服务
	if err := uc.userService.ResetPassword(uint(userID), request.NewPassword); err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithSuccess(c, "Password reset successfully")
}

// ToggleUserStatus 切换用户状态
func (uc *UserController) ToggleUserStatus(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "Invalid user ID")
		return
	}

	// 调用用户服务
	if err := uc.userService.ToggleUserStatus(uint(userID)); err != nil {
		utils.RespondWithValidationError(c, err.Error())
		return
	}

	utils.RespondWithSuccess(c, "User status toggled successfully")
}
