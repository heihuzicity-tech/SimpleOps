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

	// 创建控制器实例
	authController := controllers.NewAuthController(authService)
	userController := controllers.NewUserController(userService)

	// API路由组
	api := router.Group("/api/v1")
	{
		// 健康检查
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "ok",
				"message": "Bastion API is running",
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
		{
			// 当前用户相关路由
			authenticated.GET("/profile", authController.GetProfile)
			authenticated.PUT("/profile", authController.UpdateProfile)
			authenticated.POST("/change-password", authController.ChangePassword)
			authenticated.POST("/logout", authController.Logout)
			authenticated.GET("/me", authController.GetCurrentUser)

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
		}
	}

	return router
}
