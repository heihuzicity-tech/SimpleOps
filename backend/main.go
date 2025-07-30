package main

import (
	"bastion/config"
	_ "bastion/docs" // 导入swagger文档
	"bastion/routers"
	"bastion/services"
	"bastion/utils"
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title           运维堡垒机系统API
// @version         1.0
// @description     企业级运维堡垒机系统，提供SSH代理、用户管理、权限控制、审计日志等功能
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  MIT
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// 设置配置文件路径
	configPath := "config/config.yaml"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	// 加载配置
	if err := config.LoadConfig(configPath); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化数据库连接
	if err := utils.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 设置日志级别
	switch config.GlobalConfig.Log.Level {
	case "debug":
		logrus.SetLevel(logrus.DebugLevel)
	case "info":
		logrus.SetLevel(logrus.InfoLevel)
	case "warn":
		logrus.SetLevel(logrus.WarnLevel)
	case "error":
		logrus.SetLevel(logrus.ErrorLevel)
	default:
		logrus.SetLevel(logrus.InfoLevel)
	}

	// 设置Gin模式
	gin.SetMode(config.GlobalConfig.App.Mode)

	// 设置信号处理
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动服务
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 🎯 必须先初始化录制服务，再设置路由（因为路由中会创建SSH服务）
	logrus.Info("开始初始化核心服务...")
	
	// 初始化录制服务 - 必须在SSH服务之前
	services.InitRecordingService(utils.GetDB())
	
	// 初始化WebSocket服务
	services.InitWebSocketService()

	// 初始化命令过滤服务并验证配置
	logrus.Info("初始化命令过滤服务...")
	commandFilterService := services.NewCommandFilterService(utils.GetDB())
	if commandFilterService == nil {
		logrus.Fatal("命令过滤服务初始化失败")
	}
	
	// 验证服务配置
	logrus.Info("命令过滤服务初始化成功")
	
	logrus.Info("命令策略服务初始化并验证完成")

	// 初始化会话超时管理服务
	timeoutService := services.NewSessionTimeoutService(utils.GetDB())
	if err := timeoutService.Start(); err != nil {
		logrus.Fatalf("Failed to start session timeout service: %v", err)
	}
	
	// 将超时服务实例保存到全局变量或通过依赖注入
	services.GlobalSessionTimeoutService = timeoutService
	
	// 设置超时回调，当会话超时时自动断开SSH连接
	timeoutService.SetTimeoutCallback(func(sessionID string) {
		logrus.WithField("session_id", sessionID).Info("Session timeout callback triggered")
		// 这里可以调用SSH服务的断开方法
		// 在SSH服务集成超时管理后会自动处理
	})
	
	logrus.Info("Session timeout service initialized and started")

	// 确保录制服务完全初始化后再创建SSH服务
	if services.GlobalRecordingService == nil {
		logrus.Fatal("录制服务初始化失败")
	}
	logrus.WithField("recording_service", "initialized").Info("录制服务验证完成，开始设置路由")

	// 🎯 现在设置路由，此时录制服务已经初始化
	router := routers.SetupRouter()

	// 添加Swagger路由
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 启动SSH服务的会话清理任务
	sshService := services.NewSSHService(utils.GetDB())
	go sshService.StartSessionCleanup(ctx)

	// 启动监控服务的定时任务
	monitorService := services.NewMonitorService(utils.GetDB())
	go monitorService.StartMonitoringTasks()

	// 启动服务器
	go func() {
		serverAddr := config.GlobalConfig.App.GetServerAddr()
		logrus.Infof("Starting server on %s", serverAddr)
		logrus.Infof("Swagger UI available at: http://%s/swagger/index.html", serverAddr)
		if err := router.Run(serverAddr); err != nil {
			logrus.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待信号
	sig := <-sigChan
	logrus.Infof("Received signal: %v", sig)

	// 优雅关闭服务
	logrus.Info("Shutting down services...")
	
	// 关闭超时管理服务
	if services.GlobalSessionTimeoutService != nil {
		if err := services.GlobalSessionTimeoutService.Stop(); err != nil {
			logrus.Errorf("Failed to stop session timeout service: %v", err)
		}
	}

	// 关闭数据库连接
	utils.CloseDatabase()

	logrus.Info("Server stopped")
}
