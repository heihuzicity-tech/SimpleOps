package routers

import (
	"bastion/controllers"
	"bastion/middleware"
	"bastion/services"
	"bastion/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRouter 设置路由器
func SetupRouter() *gin.Engine {
	// 创建Gin引擎
	router := gin.Default()

	// 设置CORS中间件
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60, // 12 hours
	}))

	// 创建服务实例
	authService := services.NewAuthService(utils.GetDB())
	userService := services.NewUserService(utils.GetDB())
	roleService := services.NewRoleService(utils.GetDB())
	assetService := services.NewAssetService(utils.GetDB())
	sshService := services.NewSSHService(utils.GetDB())
	auditService := services.NewAuditService(utils.GetDB())
	monitorService := services.NewMonitorService(utils.GetDB())
	commandGroupService := services.NewCommandGroupService(utils.GetDB())
	commandFilterService := services.NewCommandFilterService(utils.GetDB())
	commandMatcherService := services.NewCommandMatcherService(utils.GetDB(), commandFilterService)

	// 创建控制器实例
	authController := controllers.NewAuthController(authService)
	userController := controllers.NewUserController(userService)
	roleController := controllers.NewRoleController(roleService)
	assetController := controllers.NewAssetController(assetService)
	sshController := controllers.NewSSHController(sshService)
	auditController := controllers.NewAuditController(auditService)
	monitorController := controllers.NewMonitorController(monitorService)
	recordingController := controllers.NewRecordingController()
	commandGroupController := controllers.NewCommandGroupController(commandGroupService)
	commandFilterController := controllers.NewCommandFilterController(commandFilterService, commandMatcherService)

	// API 路由组
	api := router.Group("/api/v1")
	{
		// 健康检查
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"success": true,
				"message": "Bastion API is running",
				"data": gin.H{
					"status": "ok",
				},
			})
		})

		// 认证路由（不需要身份验证）
		auth := api.Group("/auth")
		{
			auth.POST("/login", authController.Login)
			auth.POST("/refresh", authController.RefreshToken)
		}

		// 需要身份验证的路由
		authenticated := api.Group("/")
		authenticated.Use(middleware.AuthMiddleware())
		authenticated.Use(auditService.LogMiddleware()) // 添加审计中间件，自动记录所有操作日志
		{
			// 当前用户相关路由
			authenticated.GET("/profile", authController.GetProfile)
			authenticated.PUT("/profile", authController.UpdateProfile)
			authenticated.POST("/change-password", authController.ChangePassword)
			authenticated.POST("/logout", authController.Logout)
			authenticated.GET("/me", authController.GetCurrentUser)

			// 权限管理路由（所有认证用户可查看权限列表）
			authenticated.GET("/permissions", roleController.GetPermissions)

			// 用户管理路由（需要管理员权限）
			users := authenticated.Group("/users")
			users.Use(middleware.RequireAdmin())
			{
				users.POST("/", userController.CreateUser)
				users.GET("/", userController.GetUsers)
				users.GET("/:id", userController.GetUser)
				users.PUT("/:id", userController.UpdateUser)
				users.DELETE("/:id", userController.DeleteUser)
				users.POST("/:id/reset-password", userController.ResetPassword)
				users.POST("/:id/toggle-status", userController.ToggleUserStatus)
			}

			// 角色管理路由（需要管理员权限）
			roles := authenticated.Group("/roles")
			roles.Use(middleware.RequireAdmin())
			{
				roles.POST("/", roleController.CreateRole)
				roles.GET("/", roleController.GetRoles)
				roles.GET("/:id", roleController.GetRole)
				roles.PUT("/:id", roleController.UpdateRole)
				roles.DELETE("/:id", roleController.DeleteRole)
			}

			// 管理员专用资产管理路由
			admin := authenticated.Group("/admin")
			admin.Use(middleware.RequireAdmin())
			{
				admin.POST("/assets/batch-move", assetController.BatchMoveAssets)
			}

			// 资产管理路由（需要asset权限）
			assets := authenticated.Group("/assets")
			assets.Use(middleware.RequirePermission("asset:read"))
			{
				assets.POST("/", middleware.RequirePermission("asset:create"), assetController.CreateAsset)
				assets.GET("/", assetController.GetAssets)
				assets.GET("/:id", assetController.GetAsset)
				assets.PUT("/:id", middleware.RequirePermission("asset:update"), assetController.UpdateAsset)
				assets.DELETE("/:id", middleware.RequirePermission("asset:delete"), assetController.DeleteAsset)
				assets.POST("/test-connection", middleware.RequirePermission("asset:connect"), assetController.TestConnection)
			}

			// 资产分组管理路由（需要asset权限）
			assetGroups := authenticated.Group("/asset-groups")
			assetGroups.Use(middleware.RequirePermission("asset:read"))
			{
				assetGroups.POST("/", middleware.RequirePermission("asset:create"), assetController.CreateAssetGroup)
				assetGroups.GET("/", assetController.GetAssetGroups)
				assetGroups.GET("/with-hosts", assetController.GetAssetGroupsWithHosts) // 新增：获取包含主机详情的分组列表
				assetGroups.GET("/:id", assetController.GetAssetGroup)
				assetGroups.PUT("/:id", middleware.RequirePermission("asset:update"), assetController.UpdateAssetGroup)
				assetGroups.DELETE("/:id", middleware.RequirePermission("asset:delete"), assetController.DeleteAssetGroup)
			}

			// 凭证管理路由（需要asset权限）
			credentials := authenticated.Group("/credentials")
			credentials.Use(middleware.RequirePermission("asset:read"))
			{
				credentials.POST("/", middleware.RequirePermission("asset:create"), assetController.CreateCredential)
				credentials.GET("/", assetController.GetCredentials)
				credentials.GET("/:id", assetController.GetCredential)
				credentials.PUT("/:id", middleware.RequirePermission("asset:update"), assetController.UpdateCredential)
				credentials.DELETE("/:id", middleware.RequirePermission("asset:delete"), assetController.DeleteCredential)
			}

			// SSH会话管理路由（需要连接权限）
			ssh := authenticated.Group("/ssh")
			ssh.Use(middleware.RequirePermission("asset:connect"))
			{
				ssh.POST("/sessions", sshController.CreateSession)
				ssh.GET("/sessions", sshController.GetSessions)
				ssh.GET("/sessions/:id", sshController.GetSessionInfo)
				ssh.DELETE("/sessions/:id", sshController.CloseSession)
				ssh.POST("/sessions/:id/resize", sshController.ResizeSession)
				ssh.POST("/sessions/batch-cleanup", sshController.BatchCleanupSessions) // 用户批量清理会话（页面卸载时）
				ssh.POST("/sessions/health-check", middleware.RequirePermission("admin"), sshController.HealthCheckSessions)
				ssh.POST("/sessions/force-cleanup", middleware.RequirePermission("admin"), sshController.ForceCleanupSessions)
				ssh.POST("/keypair", sshController.GenerateKeyPair)
				
				// 🆕 会话超时管理路由
				ssh.POST("/sessions/:id/timeout", sshController.CreateSessionTimeout)     // 创建超时配置
				ssh.GET("/sessions/:id/timeout", sshController.GetSessionTimeout)        // 获取超时配置
				ssh.PUT("/sessions/:id/timeout", sshController.UpdateSessionTimeout)     // 更新超时配置
				ssh.DELETE("/sessions/:id/timeout", sshController.DeleteSessionTimeout)  // 删除超时配置
				ssh.POST("/sessions/:id/timeout/extend", sshController.ExtendSessionTimeout) // 延长超时时间
				ssh.POST("/sessions/:id/activity", sshController.UpdateSessionActivity)  // 更新活动时间
				
				// 🆕 超时管理统计（管理员权限）
				ssh.GET("/timeout/stats", middleware.RequirePermission("admin"), sshController.GetTimeoutStats) // 获取超时服务统计
			}

			// 审计管理路由（需要审计权限）
			audit := authenticated.Group("/audit")
			audit.Use(middleware.RequirePermission("audit:read"))
			{
				// 登录日志
				audit.GET("/login-logs", auditController.GetLoginLogs)

				// 操作日志
				audit.GET("/operation-logs", auditController.GetOperationLogs)
				audit.GET("/operation-logs/:id", auditController.GetOperationLog)
				audit.DELETE("/operation-logs/:id", middleware.RequirePermission("audit:delete"), auditController.DeleteOperationLog)
				audit.POST("/operation-logs/batch/delete", middleware.RequirePermission("audit:delete"), auditController.BatchDeleteOperationLogs)

				// 会话记录
				audit.GET("/session-records", auditController.GetSessionRecords)
				audit.GET("/session-records/:id", auditController.GetSessionRecord)
				audit.DELETE("/session-records/:id", middleware.RequirePermission("audit:delete"), auditController.DeleteSessionRecord)
				audit.POST("/session-records/batch/delete", middleware.RequirePermission("audit:delete"), auditController.BatchDeleteSessionRecords)

				// 命令日志
				audit.GET("/command-logs", auditController.GetCommandLogs)
				audit.GET("/command-logs/:id", auditController.GetCommandLog)

				// 统计数据
				audit.GET("/statistics", auditController.GetAuditStatistics)

				// 日志清理（需要管理员权限）
				audit.POST("/cleanup", middleware.RequireAdmin(), auditController.CleanupAuditLogs)
				
				// 会话记录清理（临时修复API，需要管理员权限）
				audit.POST("/cleanup-stale-sessions", middleware.RequireAdmin(), monitorController.CleanupStaleSessionRecords)

				// ======================== 实时监控路由 ========================
				// 活跃会话监控（需要监控权限）
				monitor := audit.Group("/")
				monitor.Use(middleware.RequirePermission("audit:monitor"))
				{
					// 活跃会话列表
					monitor.GET("/active-sessions", monitorController.GetActiveSessions)
					
					// 监控统计数据
					monitor.GET("/monitor/statistics", monitorController.GetMonitorStatistics)
					
					// 会话监控日志
					monitor.GET("/sessions/:id/monitor-logs", monitorController.GetSessionMonitorLogs)
				}

				// 会话控制操作（需要终止权限）
				control := audit.Group("/sessions/:id")
				control.Use(middleware.RequirePermission("audit:terminate"))
				{
					// 终止会话
					control.POST("/terminate", monitorController.TerminateSession)
				}

				// 会话警告操作（需要警告权限）  
				warning := audit.Group("/sessions/:id")
				warning.Use(middleware.RequirePermission("audit:warning"))
				{
					// 发送警告
					warning.POST("/warning", monitorController.SendSessionWarning)
				}

				// 警告管理
				warnings := audit.Group("/warnings")
				{
					// 标记警告为已读
					warnings.POST("/:id/read", monitorController.MarkWarningAsRead)
				}
			}
			
			// ======================== 录屏审计路由 ========================
			// 录屏审计（需要录屏权限）
			recording := authenticated.Group("/recording")
			recording.Use(middleware.RequirePermission("recording:view"))
			{
				// 录制列表
				recording.GET("/list", recordingController.GetRecordingList)
				
				// 录制详情
				recording.GET("/:id", recordingController.GetRecordingDetail)
				
				// 活跃录制
				recording.GET("/active", recordingController.GetActiveRecordings)
				
				// 批量操作路由
				batchGroup := recording.Group("/batch")
				{
					// 批量删除（需要删除权限）
					batchGroup.POST("/delete", middleware.RequirePermission("recording:delete"), recordingController.BatchDeleteRecording)
					
					// 批量下载（需要下载权限）
					batchGroup.POST("/download", middleware.RequirePermission("recording:download"), recordingController.BatchDownloadRecording)
					
					// 批量归档（需要删除权限）
					batchGroup.POST("/archive", middleware.RequirePermission("recording:delete"), recordingController.BatchArchiveRecording)
					
					// 批量操作状态查询
					batchGroup.GET("/status/:task_id", recordingController.GetBatchOperationStatus)
				}
				
				// 录制文件下载路由（需要下载权限）
				recording.GET("/:id/download", middleware.RequirePermission("recording:download"), recordingController.DownloadRecording)
				
				// 批量下载相关路由
				downloadGroup := recording.Group("/download")
				downloadGroup.Use(middleware.RequirePermission("recording:download"))
				{
					// 批量下载文件
					downloadGroup.GET("/batch/:task_id", recordingController.DownloadBatchFile)
				}
				
				// 删除录制（需要删除权限）
				deleteGroup := recording.Group("/:id")
				deleteGroup.Use(middleware.RequirePermission("recording:delete"))
				{
					deleteGroup.DELETE("", recordingController.DeleteRecording)
				}
			}

			// ======================== 命令过滤路由 ========================
			// 命令过滤管理（需要管理员权限）
			commandFilter := authenticated.Group("/command-filter")
			commandFilter.Use(middleware.RequireAdmin())
			{
				// 命令组管理
				groups := commandFilter.Group("/groups")
				{
					groups.GET("", commandGroupController.GetCommandGroups)
					groups.GET("/:id", commandGroupController.GetCommandGroup)
					groups.POST("", commandGroupController.CreateCommandGroup)
					groups.PUT("/:id", commandGroupController.UpdateCommandGroup)
					groups.DELETE("/:id", commandGroupController.DeleteCommandGroup)
					groups.POST("/batch-delete", commandGroupController.BatchDeleteCommandGroups)
					groups.GET("/export", commandGroupController.ExportCommandGroups)
					groups.POST("/import", commandGroupController.ImportCommandGroups)
				}

				// 命令过滤规则管理
				filters := commandFilter.Group("/filters")
				{
					filters.GET("", commandFilterController.GetCommandFilters)
					filters.GET("/:id", commandFilterController.GetCommandFilter)
					filters.POST("", commandFilterController.CreateCommandFilter)
					filters.PUT("/:id", commandFilterController.UpdateCommandFilter)
					filters.DELETE("/:id", commandFilterController.DeleteCommandFilter)
					filters.PATCH("/:id/toggle", commandFilterController.ToggleCommandFilter)
					filters.POST("/batch-delete", commandFilterController.BatchDeleteCommandFilters)
					filters.GET("/export", commandFilterController.ExportCommandFilters)
					filters.POST("/import", commandFilterController.ImportCommandFilters)
				}

				// 过滤日志管理
				logs := commandFilter.Group("/logs")
				{
					logs.GET("", commandFilterController.GetCommandFilterLogs)
					logs.GET("/stats", commandFilterController.GetCommandFilterLogStats)
				}

				// 命令匹配测试
				commandFilter.POST("/match", commandFilterController.TestCommandMatch)
			}
		}

		// WebSocket路由（使用特殊的WebSocket认证中间件）
		wsAuth := api.Group("/ws")
		wsAuth.Use(middleware.WebSocketAuthMiddleware())
		{
			// SSH WebSocket连接
			sshWS := wsAuth.Group("/ssh/sessions")
			sshWS.Use(middleware.RequirePermission("asset:connect"))
			{
				sshWS.GET("/:id/ws", sshController.HandleWebSocket)
			}

			// 监控WebSocket连接
			monitorWS := wsAuth.Group("/")
			monitorWS.Use(middleware.RequirePermission("audit:monitor"))
			{
				monitorWS.GET("/monitor", monitorController.HandleWebSocketMonitor)
			}
		}
	}

	return router
}
