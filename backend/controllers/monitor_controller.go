package controllers

import (
	"bastion/models"
	"bastion/services"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// MonitorController 实时监控控制器
type MonitorController struct {
	monitorService *services.MonitorService
}

// NewMonitorController 创建监控控制器实例
func NewMonitorController(monitorService *services.MonitorService) *MonitorController {
	return &MonitorController{
		monitorService: monitorService,
	}
}

// GetActiveSessions 获取活跃会话列表
// @Summary      获取活跃会话列表
// @Description  获取当前所有活跃会话，支持实时监控
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page       query   int     false  "页码"
// @Param        page_size  query   int     false  "每页数量"
// @Param        username   query   string  false  "用户名"
// @Param        asset_name query   string  false  "资产名称"
// @Param        protocol   query   string  false  "协议类型"
// @Param        ip         query   string  false  "IP地址"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/active-sessions [get]
func (mc *MonitorController) GetActiveSessions(c *gin.Context) {
	var req models.ActiveSessionListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request parameters",
		})
		return
	}

	sessions, total, err := mc.monitorService.GetActiveSessions(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get active sessions",
		})
		return
	}

	// 记录监控查看操作
	userInterface, _ := c.Get("user")
	if user, ok := userInterface.(*models.User); ok {
		for _, session := range sessions {
			mc.monitorService.RecordMonitorView(session.SessionID, user.ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"sessions":  sessions,
			"total":     total,
			"page":      req.Page,
			"page_size": req.PageSize,
		},
	})
}

// TerminateSession 终止会话
// @Summary      终止会话
// @Description  管理员强制终止指定会话
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Param        body body      models.TerminateSessionRequest  true  "终止请求"
// @Success      200  {object}  map[string]interface{}  "终止成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "会话不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/sessions/{id}/terminate [post]
func (mc *MonitorController) TerminateSession(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	var req models.TerminateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)

	// 终止会话
	if err := mc.monitorService.TerminateSession(sessionID, user.ID, &req); err != nil {
		if err.Error() == "会话不存在或已结束" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		} else if err.Error() == "没有终止会话的权限" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": err.Error(),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Session terminated successfully",
		"data": gin.H{
			"session_id": sessionID,
			"reason":     req.Reason,
			"force":      req.Force,
		},
	})
}

// SendSessionWarning 发送会话警告
// @Summary      发送会话警告
// @Description  向指定会话用户发送警告消息
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Param        body body      models.SessionWarningRequest  true  "警告请求"
// @Success      200  {object}  map[string]interface{}  "发送成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "会话不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/sessions/{id}/warning [post]
func (mc *MonitorController) SendSessionWarning(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	var req models.SessionWarningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)

	// 发送警告
	if err := mc.monitorService.SendSessionWarning(sessionID, user.ID, &req); err != nil {
		if err.Error() == "会话不存在或已结束" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		} else if err.Error() == "没有发送警告的权限" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": err.Error(),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Warning sent successfully",
		"data": gin.H{
			"session_id": sessionID,
			"message":    req.Message,
			"level":      req.Level,
		},
	})
}

// GetMonitorStatistics 获取监控统计数据
// @Summary      获取监控统计数据
// @Description  获取实时监控相关的统计数据
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/monitor/statistics [get]
func (mc *MonitorController) GetMonitorStatistics(c *gin.Context) {
	stats, err := mc.monitorService.GetMonitorStatistics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get monitor statistics",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetSessionMonitorLogs 获取会话监控日志
// @Summary      获取会话监控日志
// @Description  获取指定会话的监控操作日志
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id        path    string  true   "会话ID"
// @Param        page      query   int     false  "页码"
// @Param        page_size query   int     false  "每页数量"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/sessions/{id}/monitor-logs [get]
func (mc *MonitorController) GetSessionMonitorLogs(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	logs, total, err := mc.monitorService.GetSessionMonitorLogs(sessionID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get session monitor logs",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"logs":      logs,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// MarkWarningAsRead 标记警告为已读
// @Summary      标记警告为已读
// @Description  用户标记收到的警告消息为已读
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      uint  true  "警告ID"
// @Success      200  {object}  map[string]interface{}  "标记成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "警告不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/warnings/{id}/read [post]
func (mc *MonitorController) MarkWarningAsRead(c *gin.Context) {
	idParam := c.Param("id")
	warningID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid warning ID",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)

	// 标记为已读
	if err := mc.monitorService.MarkWarningAsRead(uint(warningID), user.ID); err != nil {
		if err.Error() == "警告不存在或无权访问" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Warning marked as read",
	})
}

// HandleWebSocketMonitor 处理WebSocket监控连接
// @Summary      WebSocket监控连接
// @Description  建立WebSocket连接进行实时监控
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Router       /ws/monitor [get]
func (mc *MonitorController) HandleWebSocketMonitor(c *gin.Context) {
	if services.GlobalWebSocketService != nil {
		services.GlobalWebSocketService.HandleWebSocket(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "WebSocket service is not available",
		})
	}
}

// CleanupStaleSessionRecords 清理陈旧的会话记录（临时调试API）
// @Summary      清理陈旧会话记录
// @Description  清理数据库中的陈旧会话记录
// @Tags         实时监控
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "清理成功"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /audit/cleanup-stale-sessions [post]
func (mc *MonitorController) CleanupStaleSessionRecords(c *gin.Context) {
	// 获取当前时间
	now := time.Now()
	
	// 更新数据库中的陈旧会话状态 - 立即清理所有状态为active但实际已结束的会话
	result := mc.monitorService.GetDB().Model(&models.SessionRecord{}).
		Where("status = ?", "active").
		Updates(map[string]interface{}{
			"status":     "closed",
			"end_time":   now,
			"updated_at": now,
		})
	
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to cleanup stale sessions",
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Cleaned up %d stale session records", result.RowsAffected),
		"cleaned_count": result.RowsAffected,
	})
}