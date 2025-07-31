package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CommandFilterController 命令过滤控制器
type CommandFilterController struct {
	commandFilterService  *services.CommandFilterService
	commandMatcherService *services.CommandMatcherService
}

// NewCommandFilterController 创建命令过滤控制器实例
func NewCommandFilterController(commandFilterService *services.CommandFilterService, commandMatcherService *services.CommandMatcherService) *CommandFilterController {
	return &CommandFilterController{
		commandFilterService:  commandFilterService,
		commandMatcherService: commandMatcherService,
	}
}

// GetCommandFilters 获取过滤规则列表
// @Summary      获取过滤规则列表
// @Description  获取过滤规则列表，支持分页和过滤条件
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "页码，默认1"          minimum(1)
// @Param        page_size query    int     false  "每页大小，默认10"      minimum(1) maximum(100)
// @Param        name      query    string  false  "规则名称"
// @Param        enabled   query    bool    false  "是否启用"
// @Param        action    query    string  false  "动作类型"
// @Success      200       {object} models.PageResponse  "获取成功"
// @Failure      400       {object} utils.ErrorResponse  "参数错误"
// @Failure      500       {object} utils.ErrorResponse  "服务器内部错误"
// @Router       /api/command-filter/filters [get]
// @Security     BearerAuth
func (cf *CommandFilterController) GetCommandFilters(c *gin.Context) {
	// 解析请求参数
	var req models.CommandFilterListRequest
	
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
	req.Action = c.Query("action")
	
	// 解析enabled参数
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		enabled, err := strconv.ParseBool(enabledStr)
		if err == nil {
			req.Enabled = &enabled
		}
	}
	
	// 调用服务
	result, err := cf.commandFilterService.List(&req)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// GetCommandFilter 获取过滤规则详情
// @Summary      获取过滤规则详情
// @Description  根据ID获取过滤规则详细信息，包含关联的用户、资产和属性
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "过滤规则ID"
// @Success      200  {object} models.CommandFilterResponse  "获取成功"
// @Failure      400  {object} utils.ErrorResponse          "参数错误"
// @Failure      404  {object} utils.ErrorResponse          "过滤规则不存在"
// @Failure      500  {object} utils.ErrorResponse          "服务器内部错误"
// @Router       /api/command-filter/filters/{id} [get]
// @Security     BearerAuth
func (cf *CommandFilterController) GetCommandFilter(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的过滤规则ID")
		return
	}
	
	// 调用服务
	result, err := cf.commandFilterService.Get(uint(id))
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "过滤规则")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// CreateCommandFilter 创建过滤规则
// @Summary      创建过滤规则
// @Description  创建新的命令过滤规则，包括用户、资产、账号和命令组的配置
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     models.CommandFilterCreateRequest  true  "创建请求"
// @Success      200      {object} models.CommandFilterResponse       "创建成功"
// @Failure      400      {object} utils.ErrorResponse               "参数错误"
// @Failure      500      {object} utils.ErrorResponse               "服务器内部错误"
// @Router       /api/command-filter/filters [post]
// @Security     BearerAuth
func (cf *CommandFilterController) CreateCommandFilter(c *gin.Context) {
	var req models.CommandFilterCreateRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 调用服务
	result, err := cf.commandFilterService.Create(&req)
	if err != nil {
		if errors.Is(err, utils.ErrInvalidParam) {
			utils.RespondWithValidationError(c, "命令组不存在或优先级无效")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// UpdateCommandFilter 更新过滤规则
// @Summary      更新过滤规则
// @Description  更新过滤规则信息，包括基本信息和关联配置
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id       path     int                                true  "过滤规则ID"
// @Param        request  body     models.CommandFilterUpdateRequest  true  "更新请求"
// @Success      200      {object} models.CommandFilterResponse       "更新成功"
// @Failure      400      {object} utils.ErrorResponse               "参数错误"
// @Failure      404      {object} utils.ErrorResponse               "过滤规则不存在"
// @Failure      500      {object} utils.ErrorResponse               "服务器内部错误"
// @Router       /api/command-filter/filters/{id} [put]
// @Security     BearerAuth
func (cf *CommandFilterController) UpdateCommandFilter(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的过滤规则ID")
		return
	}
	
	var req models.CommandFilterUpdateRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 调用服务
	result, err := cf.commandFilterService.Update(uint(id), &req)
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "过滤规则")
			return
		}
		if errors.Is(err, utils.ErrInvalidParam) {
			utils.RespondWithValidationError(c, "命令组不存在或优先级无效")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// DeleteCommandFilter 删除过滤规则
// @Summary      删除过滤规则
// @Description  删除指定的过滤规则
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "过滤规则ID"
// @Success      200  {object} utils.SuccessResponse  "删除成功"
// @Failure      400  {object} utils.ErrorResponse    "参数错误"
// @Failure      404  {object} utils.ErrorResponse    "过滤规则不存在"
// @Failure      500  {object} utils.ErrorResponse    "服务器内部错误"
// @Router       /api/command-filter/filters/{id} [delete]
// @Security     BearerAuth
func (cf *CommandFilterController) DeleteCommandFilter(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的过滤规则ID")
		return
	}
	
	// 调用服务
	err = cf.commandFilterService.Delete(uint(id))
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "过滤规则")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "删除成功")
}

// ToggleCommandFilter 启用/禁用过滤规则
// @Summary      启用/禁用过滤规则
// @Description  切换过滤规则的启用状态
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path     int  true  "过滤规则ID"
// @Success      200  {object} utils.SuccessResponse  "操作成功"
// @Failure      400  {object} utils.ErrorResponse    "参数错误"
// @Failure      404  {object} utils.ErrorResponse    "过滤规则不存在"
// @Failure      500  {object} utils.ErrorResponse    "服务器内部错误"
// @Router       /api/command-filter/filters/{id}/toggle [patch]
// @Security     BearerAuth
func (cf *CommandFilterController) ToggleCommandFilter(c *gin.Context) {
	// 解析ID参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithValidationError(c, "无效的过滤规则ID")
		return
	}
	
	// 调用服务
	err = cf.commandFilterService.Toggle(uint(id))
	if err != nil {
		if errors.Is(err, utils.ErrNotFound) {
			utils.RespondWithNotFound(c, "过滤规则")
			return
		}
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "状态切换成功")
}

// BatchDeleteCommandFilters 批量删除过滤规则
// @Summary      批量删除过滤规则
// @Description  批量删除多个过滤规则
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     models.BatchDeleteRequest  true  "批量删除请求"
// @Success      200      {object} utils.SuccessResponse     "删除成功"
// @Failure      400      {object} utils.ErrorResponse       "参数错误"
// @Failure      500      {object} utils.ErrorResponse       "服务器内部错误"
// @Router       /api/command-filter/filters/batch-delete [post]
// @Security     BearerAuth
func (cf *CommandFilterController) BatchDeleteCommandFilters(c *gin.Context) {
	var req models.BatchDeleteRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 验证参数
	if len(req.IDs) == 0 {
		utils.RespondWithValidationError(c, "请选择要删除的过滤规则")
		return
	}
	
	// 调用服务
	err := cf.commandFilterService.BatchDelete(req.IDs)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "批量删除成功")
}

// ExportCommandFilters 导出过滤规则
// @Summary      导出过滤规则
// @Description  导出过滤规则配置，支持全部导出或指定ID导出
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        ids  query    []uint  false  "要导出的过滤规则ID列表"
// @Success      200  {object} []models.CommandFilterExportData  "导出成功"
// @Failure      500  {object} utils.ErrorResponse                "服务器内部错误"
// @Router       /api/command-filter/filters/export [get]
// @Security     BearerAuth
func (cf *CommandFilterController) ExportCommandFilters(c *gin.Context) {
	// 解析ID参数
	var ids []uint
	if idStr := c.Query("ids"); idStr != "" {
		// 这里简化处理，实际可能需要更复杂的解析逻辑
		// 例如: ids=1,2,3
		utils.RespondWithValidationError(c, "暂不支持指定ID导出")
		return
	}
	
	// 调用服务
	result, err := cf.commandFilterService.Export(ids)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}

// ImportCommandFilters 导入过滤规则
// @Summary      导入过滤规则
// @Description  导入过滤规则配置，需要命令组存在
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     []models.CommandFilterExportData  true  "导入数据"
// @Success      200      {object} utils.SuccessResponse            "导入成功"
// @Failure      400      {object} utils.ErrorResponse              "参数错误"
// @Failure      500      {object} utils.ErrorResponse              "服务器内部错误"
// @Router       /api/command-filter/filters/import [post]
// @Security     BearerAuth
func (cf *CommandFilterController) ImportCommandFilters(c *gin.Context) {
	var data []models.CommandFilterExportData
	
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
	err := cf.commandFilterService.Import(data)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithSuccess(c, "导入成功")
}

// TestCommandMatch 测试命令匹配
// @Summary      测试命令匹配
// @Description  测试命令是否会被过滤规则匹配
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        request  body     models.CommandMatchRequest  true  "匹配请求"
// @Success      200      {object} models.CommandMatchResponse "匹配结果"
// @Failure      400      {object} utils.ErrorResponse         "参数错误"
// @Failure      500      {object} utils.ErrorResponse         "服务器内部错误"
// @Router       /api/command-filter/match [post]
// @Security     BearerAuth
func (cf *CommandFilterController) TestCommandMatch(c *gin.Context) {
	var req models.CommandMatchRequest
	
	// 绑定请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(c, "请求参数格式错误")
		return
	}
	
	// 调用服务
	result, err := cf.commandMatcherService.MatchCommand(&req)
	if err != nil {
		utils.RespondWithInternalError(c, err.Error())
		return
	}
	
	utils.RespondWithData(c, result)
}