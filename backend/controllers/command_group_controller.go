package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CommandGroupController 命令组控制器
type CommandGroupController struct {
	commandGroupService *services.CommandGroupService
}

// NewCommandGroupController 创建命令组控制器实例
func NewCommandGroupController(commandGroupService *services.CommandGroupService) *CommandGroupController {
	return &CommandGroupController{
		commandGroupService: commandGroupService,
	}
}

// GetCommandGroups 获取命令组列表
// @Summary      获取命令组列表
// @Description  获取命令组列表，支持分页和搜索
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "页码，默认1"      minimum(1)
// @Param        page_size query    int     false  "每页大小，默认10" minimum(1) maximum(100)
// @Param        name      query    string  false  "命令组名称"
// @Success      200       {object} models.PageResponse  "获取成功"
// @Failure      400       {object} utils.ErrorResponse  "参数错误"
// @Failure      500       {object} utils.ErrorResponse  "服务器内部错误"
// @Router       /api/command-filter/groups [get]
// @Security     BearerAuth
func (cc *CommandGroupController) GetCommandGroups(c *gin.Context) {
	// 解析请求参数
	var req models.CommandGroupListRequest
	
	// 分页参数
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	
	req.Page = page
	req.PageSize = pageSize
	req.Name = c.Query("name")
	
	// 调用服务
	result, err := cc.commandGroupService.List(&req)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// GetCommandGroup 获取命令组详情
// @Summary      获取命令组详情
// @Description  根据ID获取命令组详细信息，包含命令项列表
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "命令组ID"
// @Success      200  {object} models.CommandGroupResponse  "获取成功"
// @Failure      400  {object} utils.ErrorResponse         "参数错误"
// @Failure      404  {object} utils.ErrorResponse         "命令组不存在"
// @Failure      500  {object} utils.ErrorResponse         "服务器内部错误"
// @Router       /api/command-filter/groups/{id} [get]
// @Security     BearerAuth
func (cc *CommandGroupController) GetCommandGroup(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的命令组ID")
		return
	}
	
	// 调用服务
	result, err := cc.commandGroupService.Get(uint(id))
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "命令组")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// CreateCommandGroup 创建命令组
// @Summary      创建命令组
// @Description  创建新的命令组，可同时添加命令项
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     models.CommandGroupCreateRequest  true  "创建请求"
// @Success      200      {object} models.CommandGroupResponse       "创建成功"
// @Failure      400      {object} utils.ErrorResponse              "参数错误"
// @Failure      409      {object} utils.ErrorResponse              "命令组名称已存在"
// @Failure      500      {object} utils.ErrorResponse              "服务器内部错误"
// @Router       /api/command-filter/groups [post]
// @Security     BearerAuth
func (cc *CommandGroupController) CreateCommandGroup(c *gin.Context) {
	var req models.CommandGroupCreateRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 调用服务
	result, err := cc.commandGroupService.Create(&req)
	if err != nil {
		if errors.Is(err, utils.ErrDuplicate) {
			utils.RespondWithConflict(c, "命令组名称已存在")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// UpdateCommandGroup 更新命令组
// @Summary      更新命令组
// @Description  更新命令组信息，包括名称、备注和命令项
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id       path     int                               true  "命令组ID"
// @Param        request  body     models.CommandGroupUpdateRequest  true  "更新请求"
// @Success      200      {object} models.CommandGroupResponse       "更新成功"
// @Failure      400      {object} utils.ErrorResponse              "参数错误"
// @Failure      404      {object} utils.ErrorResponse              "命令组不存在"
// @Failure      409      {object} utils.ErrorResponse              "命令组名称已存在"
// @Failure      500      {object} utils.ErrorResponse              "服务器内部错误"
// @Router       /api/command-filter/groups/{id} [put]
// @Security     BearerAuth
func (cc *CommandGroupController) UpdateCommandGroup(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的命令组ID")
		return
	}
	
	var req models.CommandGroupUpdateRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 调用服务
	result, err := cc.commandGroupService.Update(uint(id), &req)
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "命令组")
			return
		}
		if errors.Is(err, utils.ErrDuplicate) {
			utils.RespondWithConflict(c, "命令组名称已存在")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// DeleteCommandGroup 删除命令组
// @Summary      删除命令组
// @Description  删除指定的命令组，如果命令组被过滤规则使用则不能删除
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "命令组ID"
// @Success      200  {object} utils.SuccessResponse  "删除成功"
// @Failure      400  {object} utils.ErrorResponse    "参数错误"
// @Failure      404  {object} utils.ErrorResponse    "命令组不存在"
// @Failure      409  {object} utils.ErrorResponse    "命令组正在使用中"
// @Failure      500  {object} utils.ErrorResponse    "服务器内部错误"
// @Router       /api/command-filter/groups/{id} [delete]
// @Security     BearerAuth
func (cc *CommandGroupController) DeleteCommandGroup(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的命令组ID")
		return
	}
	
	// 调用服务
	err = cc.commandGroupService.Delete(uint(id))
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "命令组")
			return
		}
		if errors.Is(err, utils.ErrInUse) {
			utils.RespondWithConflict(c, "命令组正在被过滤规则使用，无法删除")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "删除成功")
}

// BatchDeleteCommandGroups 批量删除命令组
// @Summary      批量删除命令组
// @Description  批量删除多个命令组，如果有命令组被使用则整体失败
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     models.BatchDeleteRequest  true  "批量删除请求"
// @Success      200      {object} utils.SuccessResponse     "删除成功"
// @Failure      400      {object} utils.ErrorResponse       "参数错误"
// @Failure      409      {object} utils.ErrorResponse       "有命令组正在使用中"
// @Failure      500      {object} utils.ErrorResponse       "服务器内部错误"
// @Router       /api/command-filter/groups/batch-delete [post]
// @Security     BearerAuth
func (cc *CommandGroupController) BatchDeleteCommandGroups(c *gin.Context) {
	var req models.BatchDeleteRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 验证参数
	if len(req.IDs) == 0 {
		utils.RespondWithValidationError(c, "请选择要删除的命令组")
		return
	}
	
	// 调用服务
	err := cc.commandGroupService.BatchDelete(req.IDs)
	if err != nil {
		if errors.Is(err, utils.ErrInUse) {
			utils.RespondWithConflict(c, "有命令组正在被过滤规则使用，无法删除")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "批量删除成功")
}

// ExportCommandGroups 导出命令组
// @Summary      导出命令组
// @Description  导出命令组配置，支持全部导出或指定ID导出
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        ids  query    []uint  false  "要导出的命令组ID列表"
// @Success      200  {object} []models.CommandGroupExportData  "导出成功"
// @Failure      500  {object} utils.ErrorResponse              "服务器内部错误"
// @Router       /api/command-filter/groups/export [get]
// @Security     BearerAuth
func (cc *CommandGroupController) ExportCommandGroups(c *gin.Context) {
	// 解析ID参数
	var ids []uint
	if idStr := c.Query("ids"); idStr != "" {
		// 这里简化处理，实际可能需要更复杂的解析逻辑
		// 例如: ids=1,2,3
		utils.RespondWithValidationError(c, "暂不支持指定ID导出")
		return
	}
	
	// 调用服务
	result, err := cc.commandGroupService.Export(ids)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// ImportCommandGroups 导入命令组
// @Summary      导入命令组
// @Description  导入命令组配置，已存在的命令组将被跳过
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     []models.CommandGroupExportData  true  "导入数据"
// @Success      200      {object} utils.SuccessResponse           "导入成功"
// @Failure      400      {object} utils.ErrorResponse             "参数错误"
// @Failure      500      {object} utils.ErrorResponse             "服务器内部错误"
// @Router       /api/command-filter/groups/import [post]
// @Security     BearerAuth
func (cc *CommandGroupController) ImportCommandGroups(c *gin.Context) {
	var data []models.CommandGroupExportData
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 验证参数
	if len(data) == 0 {
		utils.RespondWithValidationError(c, "导入数据不能为空")
		return
	}
	
	// 调用服务
	err := cc.commandGroupService.Import(data)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "导入成功")
}