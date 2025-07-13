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

	// 设置路由
	router := routers.SetupRouter()

	// 添加Swagger路由
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 设置信号处理
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动SSH服务的会话清理任务
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 从路由器中获取SSH服务（需要修改路由器以暴露服务）
	// 这里暂时创建一个临时的SSH服务实例用于清理任务
	sshService := services.NewSSHService(utils.GetDB())
	go sshService.StartSessionCleanup(ctx)

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

	// 关闭数据库连接
	utils.CloseDatabase()

	logrus.Info("Server stopped")
}
