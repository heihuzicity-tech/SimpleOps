package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// DashboardController 仪表盘控制器
type DashboardController struct {
	dashboardService *services.DashboardService
}

// NewDashboardController 创建仪表盘控制器实例
func NewDashboardController(dashboardService *services.DashboardService) *DashboardController {
	return &DashboardController{
		dashboardService: dashboardService,
	}
}

// GetDashboardStats 获取仪表盘统计数据
// @Summary      获取仪表盘统计数据
// @Description  获取主机、会话、用户、凭证等核心统计数据
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/stats [get]
func (dc *DashboardController) GetDashboardStats(c *gin.Context) {
	userID := c.GetUint("userID")
	
	// 获取用户信息判断是否管理员
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}
	user := userInterface.(*models.User)
	isAdmin := user.HasRole("admin")

	stats, err := dc.dashboardService.GetDashboardStats(userID, isAdmin)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取统计数据失败")
		return
	}

	utils.RespondWithData(c, stats)
}

// GetRecentLogins 获取最近登录记录
// @Summary      获取最近登录记录
// @Description  获取最近的SSH会话登录记录
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query  int  false  "返回记录数量"  default(10)
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/recent-logins [get]
func (dc *DashboardController) GetRecentLogins(c *gin.Context) {
	userID := c.GetUint("userID")
	
	// 获取用户信息判断是否管理员
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}
	user := userInterface.(*models.User)
	isAdmin := user.HasRole("admin")
	
	limit := 10
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 50 {
			limit = parsedLimit
		}
	}

	recentLogins, err := dc.dashboardService.GetRecentLogins(userID, isAdmin, limit)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取登录记录失败")
		return
	}

	utils.RespondWithData(c, recentLogins)
}

// GetHostDistribution 获取主机分组分布
// @Summary      获取主机分组分布
// @Description  获取主机按分组的分布情况
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/host-distribution [get]
func (dc *DashboardController) GetHostDistribution(c *gin.Context) {
	userID := c.GetUint("userID")
	
	// 获取用户信息判断是否管理员
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}
	user := userInterface.(*models.User)
	isAdmin := user.HasRole("admin")

	distribution, err := dc.dashboardService.GetHostDistribution(userID, isAdmin)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取主机分布失败")
		return
	}

	utils.RespondWithData(c, distribution)
}

// GetActivityTrends 获取活跃趋势数据
// @Summary      获取活跃趋势数据
// @Description  获取最近N天的会话、登录、命令执行趋势
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        days  query  int  false  "统计天数"  default(7)
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/activity-trends [get]
func (dc *DashboardController) GetActivityTrends(c *gin.Context) {
	days := 7
	if d := c.Query("days"); d != "" {
		if parsedDays, err := strconv.Atoi(d); err == nil && parsedDays > 0 && parsedDays <= 30 {
			days = parsedDays
		}
	}

	trends, err := dc.dashboardService.GetActivityTrends(days)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取活跃趋势失败")
		return
	}

	utils.RespondWithData(c, trends)
}

// GetAuditSummary 获取审计统计摘要
// @Summary      获取审计统计摘要
// @Description  获取审计日志的统计摘要信息
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/audit-summary [get]
func (dc *DashboardController) GetAuditSummary(c *gin.Context) {
	// 获取用户信息判断是否管理员
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}
	user := userInterface.(*models.User)
	if !user.HasRole("admin") {
		utils.RespondWithError(c, http.StatusForbidden, "需要管理员权限")
		return
	}

	summary, err := dc.dashboardService.GetAuditSummary()
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取审计摘要失败")
		return
	}

	utils.RespondWithData(c, summary)
}

// GetQuickAccess 获取快速访问列表
// @Summary      获取快速访问列表
// @Description  获取用户常用的主机快速访问列表
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query  int  false  "返回记录数量"  default(5)
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard/quick-access [get]
func (dc *DashboardController) GetQuickAccess(c *gin.Context) {
	userID := c.GetUint("userID")
	
	limit := 5
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 20 {
			limit = parsedLimit
		}
	}

	hosts, err := dc.dashboardService.GetQuickAccessHosts(userID, limit)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取快速访问列表失败")
		return
	}

	utils.RespondWithData(c, hosts)
}

// GetCompleteDashboard 获取完整仪表盘数据
// @Summary      获取完整仪表盘数据
// @Description  一次性获取仪表盘所需的所有数据
// @Tags         仪表盘
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  models.DashboardResponse  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /dashboard [get]
func (dc *DashboardController) GetCompleteDashboard(c *gin.Context) {
	userID := c.GetUint("userID")
	
	// 获取用户信息判断是否管理员
	userInterface, exists := c.Get("user")
	if !exists {
		utils.RespondWithUnauthorized(c, "User not found")
		return
	}
	user := userInterface.(*models.User)
	isAdmin := user.HasRole("admin")

	dashboard, err := dc.dashboardService.GetCompleteDashboard(userID, isAdmin)
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "获取仪表盘数据失败")
		return
	}

	utils.RespondWithData(c, dashboard)
}