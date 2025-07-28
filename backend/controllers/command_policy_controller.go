package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CommandPolicyController 命令策略控制器
type CommandPolicyController struct {
	policyService *services.CommandPolicyService
}

// NewCommandPolicyController 创建命令策略控制器实例
func NewCommandPolicyController(policyService *services.CommandPolicyService) *CommandPolicyController {
	return &CommandPolicyController{
		policyService: policyService,
	}
}

// 命令管理接口

// GetCommands 获取命令列表
// @Summary      获取命令列表
// @Description  获取命令列表，支持分页和搜索
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "页码"
// @Param        page_size query    int     false  "每页数量"
// @Param        name      query    string  false  "命令名称"
// @Param        type      query    string  false  "匹配类型: exact, regex"
// @Success      200  {object}  models.PageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/commands [get]
func (c *CommandPolicyController) GetCommands(ctx *gin.Context) {
	var req models.CommandListRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	commands, total, err := c.policyService.GetCommands(&req)
	if err != nil {
		utils.RespondWithInternalError(ctx, err.Error())
		return
	}

	utils.RespondWithPagination(ctx, commands, req.Page, req.PageSize, total)
}

// CreateCommand 创建命令
// @Summary      创建命令
// @Description  创建新的命令定义
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        command  body      models.CommandCreateRequest  true  "命令信息"
// @Success      200      {object}  models.Command
// @Failure      400      {object}  ErrorResponse
// @Router       /api/command-filter/commands [post]
func (c *CommandPolicyController) CreateCommand(ctx *gin.Context) {
	var req models.CommandCreateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	command, err := c.policyService.CreateCommand(&req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, command)
}

// UpdateCommand 更新命令
// @Summary      更新命令
// @Description  更新命令信息
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id       path      int                          true  "命令ID"
// @Param        command  body      models.CommandUpdateRequest  true  "命令信息"
// @Success      200      {object}  models.Command
// @Failure      400      {object}  ErrorResponse
// @Router       /api/command-filter/commands/{id} [put]
func (c *CommandPolicyController) UpdateCommand(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的命令ID")
		return
	}

	var req models.CommandUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	command, err := c.policyService.UpdateCommand(uint(id), &req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, command)
}

// DeleteCommand 删除命令
// @Summary      删除命令
// @Description  删除指定的命令
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "命令ID"
// @Success      200  {object}  MessageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/commands/{id} [delete]
func (c *CommandPolicyController) DeleteCommand(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的命令ID")
		return
	}

	if err := c.policyService.DeleteCommand(uint(id)); err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithSuccess(ctx, "删除成功")
}

// 命令组管理接口

// GetCommandGroups 获取命令组列表
// @Summary      获取命令组列表
// @Description  获取命令组列表，支持分页和搜索
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page       query    int   false  "页码"
// @Param        page_size  query    int   false  "每页数量"
// @Param        name       query    string  false  "命令组名称"
// @Param        is_preset  query    bool    false  "是否预设组"
// @Success      200  {object}  models.PageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/command-groups [get]
func (c *CommandPolicyController) GetCommandGroups(ctx *gin.Context) {
	var req models.CommandGroupListRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	groups, total, err := c.policyService.GetCommandGroups(&req)
	if err != nil {
		utils.RespondWithInternalError(ctx, err.Error())
		return
	}

	utils.RespondWithPagination(ctx, groups, req.Page, req.PageSize, total)
}

// CreateCommandGroup 创建命令组
// @Summary      创建命令组
// @Description  创建新的命令组
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        group  body      models.CommandGroupCreateRequest  true  "命令组信息"
// @Success      200    {object}  models.CommandGroup
// @Failure      400    {object}  ErrorResponse
// @Router       /api/command-filter/command-groups [post]
func (c *CommandPolicyController) CreateCommandGroup(ctx *gin.Context) {
	var req models.CommandGroupCreateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	group, err := c.policyService.CreateCommandGroup(&req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, group)
}

// UpdateCommandGroup 更新命令组
// @Summary      更新命令组
// @Description  更新命令组信息
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id     path      int                              true  "命令组ID"
// @Param        group  body      models.CommandGroupUpdateRequest  true  "命令组信息"
// @Success      200    {object}  models.CommandGroup
// @Failure      400    {object}  ErrorResponse
// @Router       /api/command-filter/command-groups/{id} [put]
func (c *CommandPolicyController) UpdateCommandGroup(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的命令组ID")
		return
	}

	var req models.CommandGroupUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	group, err := c.policyService.UpdateCommandGroup(uint(id), &req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, group)
}

// DeleteCommandGroup 删除命令组
// @Summary      删除命令组
// @Description  删除指定的命令组
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "命令组ID"
// @Success      200  {object}  MessageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/command-groups/{id} [delete]
func (c *CommandPolicyController) DeleteCommandGroup(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的命令组ID")
		return
	}

	if err := c.policyService.DeleteCommandGroup(uint(id)); err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithSuccess(ctx, "删除成功")
}

// 策略管理接口

// GetPolicies 获取策略列表
// @Summary      获取策略列表
// @Description  获取策略列表，支持分页和搜索
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "页码"
// @Param        page_size query    int     false  "每页数量"
// @Param        name      query    string  false  "策略名称"
// @Param        enabled   query    bool    false  "是否启用"
// @Success      200  {object}  models.PageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/policies [get]
func (c *CommandPolicyController) GetPolicies(ctx *gin.Context) {
	var req models.PolicyListRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	policies, total, err := c.policyService.GetPolicies(&req)
	if err != nil {
		utils.RespondWithInternalError(ctx, err.Error())
		return
	}

	// 转换为响应格式
	var responses []models.PolicyResponse
	for _, policy := range policies {
		resp := models.PolicyResponse{
			ID:          policy.ID,
			Name:        policy.Name,
			Description: policy.Description,
			Enabled:     policy.Enabled,
			Priority:    policy.Priority,
			UserCount:   len(policy.Users),
			CommandCount: len(policy.Commands),
			CreatedAt:   policy.CreatedAt,
			UpdatedAt:   policy.UpdatedAt,
		}
		
		// 添加用户信息
		for _, user := range policy.Users {
			resp.Users = append(resp.Users, models.UserBasicInfo{
				ID:       user.ID,
				Username: user.Username,
				Email:    user.Email,
			})
		}
		
		// 添加命令信息
		for _, pc := range policy.Commands {
			pcResp := models.PolicyCommandResponse{
				ID: pc.ID,
			}
			if pc.Command != nil {
				pcResp.Type = "command"
				pcResp.Command = &models.CommandResponse{
					ID:          pc.Command.ID,
					Name:        pc.Command.Name,
					Type:        pc.Command.Type,
					Description: pc.Command.Description,
					CreatedAt:   pc.Command.CreatedAt,
					UpdatedAt:   pc.Command.UpdatedAt,
				}
			} else if pc.CommandGroup != nil {
				pcResp.Type = "command_group"
				pcResp.CommandGroup = &models.CommandGroupResponse{
					ID:          pc.CommandGroup.ID,
					Name:        pc.CommandGroup.Name,
					Description: pc.CommandGroup.Description,
					IsPreset:    pc.CommandGroup.IsPreset,
					CreatedAt:   pc.CommandGroup.CreatedAt,
					UpdatedAt:   pc.CommandGroup.UpdatedAt,
				}
			}
			resp.Commands = append(resp.Commands, pcResp)
		}
		
		responses = append(responses, resp)
	}

	utils.RespondWithPagination(ctx, responses, req.Page, req.PageSize, total)
}

// CreatePolicy 创建策略
// @Summary      创建策略
// @Description  创建新的命令策略
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        policy  body      models.PolicyCreateRequest  true  "策略信息"
// @Success      200     {object}  models.CommandPolicy
// @Failure      400     {object}  ErrorResponse
// @Router       /api/command-filter/policies [post]
func (c *CommandPolicyController) CreatePolicy(ctx *gin.Context) {
	var req models.PolicyCreateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	policy, err := c.policyService.CreatePolicy(&req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, policy)
}

// UpdatePolicy 更新策略
// @Summary      更新策略
// @Description  更新策略信息
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id      path      int                        true  "策略ID"
// @Param        policy  body      models.PolicyUpdateRequest  true  "策略信息"
// @Success      200     {object}  models.CommandPolicy
// @Failure      400     {object}  ErrorResponse
// @Router       /api/command-filter/policies/{id} [put]
func (c *CommandPolicyController) UpdatePolicy(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的策略ID")
		return
	}

	var req models.PolicyUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	policy, err := c.policyService.UpdatePolicy(uint(id), &req)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithData(ctx, policy)
}

// DeletePolicy 删除策略
// @Summary      删除策略
// @Description  删除指定的策略
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "策略ID"
// @Success      200  {object}  MessageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/policies/{id} [delete]
func (c *CommandPolicyController) DeletePolicy(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的策略ID")
		return
	}

	if err := c.policyService.DeletePolicy(uint(id)); err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithSuccess(ctx, "删除成功")
}

// BindPolicyUsers 绑定用户到策略
// @Summary      绑定用户到策略
// @Description  将用户绑定到指定策略
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id      path      int                           true  "策略ID"
// @Param        users   body      models.PolicyBindUsersRequest  true  "用户ID列表"
// @Success      200     {object}  MessageResponse
// @Failure      400     {object}  ErrorResponse
// @Router       /api/command-filter/policies/{id}/bind-users [post]
func (c *CommandPolicyController) BindPolicyUsers(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的策略ID")
		return
	}

	var req models.PolicyBindUsersRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	if err := c.policyService.BindPolicyUsers(uint(id), req.UserIDs); err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithSuccess(ctx, "绑定成功")
}

// BindPolicyCommands 绑定命令/命令组到策略
// @Summary      绑定命令到策略
// @Description  将命令或命令组绑定到指定策略
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        id        path      int                              true  "策略ID"
// @Param        commands  body      models.PolicyBindCommandsRequest  true  "命令信息"
// @Success      200       {object}  MessageResponse
// @Failure      400       {object}  ErrorResponse
// @Router       /api/command-filter/policies/{id}/bind-commands [post]
func (c *CommandPolicyController) BindPolicyCommands(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, "无效的策略ID")
		return
	}

	var req models.PolicyBindCommandsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	if err := c.policyService.BindPolicyCommands(uint(id), req.CommandIDs, req.CommandGroupIDs); err != nil {
		utils.RespondWithError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	utils.RespondWithSuccess(ctx, "绑定成功")
}

// 拦截日志接口

// GetInterceptLogs 获取拦截日志
// @Summary      获取拦截日志
// @Description  获取命令拦截日志列表
// @Tags         命令过滤
// @Accept       json
// @Produce      json
// @Param        page        query    int     false  "页码"
// @Param        page_size   query    int     false  "每页数量"
// @Param        session_id  query    string  false  "会话ID"
// @Param        user_id     query    int     false  "用户ID"
// @Param        asset_id    query    int     false  "资产ID"
// @Param        policy_id   query    int     false  "策略ID"
// @Param        start_time  query    string  false  "开始时间"
// @Param        end_time    query    string  false  "结束时间"
// @Success      200  {object}  models.PageResponse
// @Failure      400  {object}  ErrorResponse
// @Router       /api/command-filter/intercept-logs [get]
func (c *CommandPolicyController) GetInterceptLogs(ctx *gin.Context) {
	var req models.InterceptLogListRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		utils.RespondWithValidationError(ctx, err.Error())
		return
	}

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	logs, total, err := c.policyService.GetInterceptLogs(&req)
	if err != nil {
		utils.RespondWithInternalError(ctx, err.Error())
		return
	}

	// 转换为响应格式
	var responses []models.InterceptLogResponse
	for _, log := range logs {
		resp := models.InterceptLogResponse{
			ID:            log.ID,
			SessionID:     log.SessionID,
			UserID:        log.UserID,
			Username:      log.Username,
			AssetID:       log.AssetID,
			Command:       log.Command,
			PolicyID:      log.PolicyID,
			PolicyName:    log.PolicyName,
			PolicyType:    log.PolicyType,
			InterceptTime: log.InterceptTime,
			AlertLevel:    log.AlertLevel,
			AlertSent:     log.AlertSent,
		}
		
		// 添加资产信息
		if log.Asset.ID > 0 {
			resp.AssetName = log.Asset.Name
			resp.AssetAddr = log.Asset.Address
		}
		
		responses = append(responses, resp)
	}

	utils.RespondWithPagination(ctx, responses, req.Page, req.PageSize, total)
}

// 响应结构体定义

// ErrorResponse 错误响应
type ErrorResponse struct {
	Error string `json:"error"`
}

// MessageResponse 消息响应
type MessageResponse struct {
	Message string `json:"message"`
}