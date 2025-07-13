package controllers

import (
	"bastion/models"
	"bastion/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RoleController 角色控制器
type RoleController struct {
	roleService *services.RoleService
}

// NewRoleController 创建角色控制器实例
func NewRoleController(roleService *services.RoleService) *RoleController {
	return &RoleController{roleService: roleService}
}

// CreateRole 创建角色
// @Summary      创建角色
// @Description  创建新的角色并分配权限
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body models.RoleCreateRequest true "角色创建请求"
// @Success      201  {object}  map[string]interface{}  "创建成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      409  {object}  map[string]interface{}  "角色名已存在"
// @Router       /roles [post]
func (rc *RoleController) CreateRole(c *gin.Context) {
	var request models.RoleCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用角色服务
	role, err := rc.roleService.CreateRole(&request)
	if err != nil {
		if err.Error() == "role name already exists" {
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    role,
	})
}

// GetRoles 获取角色列表
// @Summary      获取角色列表
// @Description  获取角色列表，支持分页和搜索
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page      query  int     false  "页码"  minimum(1)
// @Param        page_size query  int     false  "每页大小"  minimum(1) maximum(100)
// @Param        keyword   query  string  false  "搜索关键词"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Router       /roles [get]
func (rc *RoleController) GetRoles(c *gin.Context) {
	var request models.RoleListRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
		})
		return
	}

	// 调用角色服务
	roles, total, err := rc.roleService.GetRoles(&request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 分页信息
	page := request.Page
	pageSize := request.PageSize
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"roles": roles,
			"pagination": gin.H{
				"page":       page,
				"page_size":  pageSize,
				"total":      total,
				"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
			},
		},
	})
}

// GetRole 获取角色详情
// @Summary      获取角色详情
// @Description  根据角色ID获取角色详细信息
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "角色ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "角色不存在"
// @Router       /roles/{id} [get]
func (rc *RoleController) GetRole(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid role ID",
		})
		return
	}

	// 调用角色服务
	role, err := rc.roleService.GetRole(uint(id))
	if err != nil {
		if err.Error() == "role not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    role,
	})
}

// UpdateRole 更新角色
// @Summary      更新角色
// @Description  更新角色信息和权限
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path  int                        true  "角色ID"
// @Param        request body  models.RoleUpdateRequest  true  "角色更新请求"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "角色不存在"
// @Router       /roles/{id} [put]
func (rc *RoleController) UpdateRole(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid role ID",
		})
		return
	}

	var request models.RoleUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用角色服务
	role, err := rc.roleService.UpdateRole(uint(id), &request)
	if err != nil {
		if err.Error() == "role not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    role,
	})
}

// DeleteRole 删除角色
// @Summary      删除角色
// @Description  删除指定的角色（软删除）
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "角色ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "角色不存在"
// @Failure      409  {object}  map[string]interface{}  "角色正在使用中"
// @Router       /roles/{id} [delete]
func (rc *RoleController) DeleteRole(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid role ID",
		})
		return
	}

	// 调用角色服务
	if err := rc.roleService.DeleteRole(uint(id)); err != nil {
		if err.Error() == "role not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		if err.Error() == "cannot delete role: role is assigned to users" {
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Role deleted successfully",
	})
}

// GetPermissions 获取可用权限列表
// @Summary      获取权限列表
// @Description  获取系统中所有可用的权限列表
// @Tags         角色管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /permissions [get]
func (rc *RoleController) GetPermissions(c *gin.Context) {
	permissions, err := rc.roleService.GetPermissions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get permissions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    permissions,
	})
}
