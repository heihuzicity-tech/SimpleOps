package main

import (
	"bastion/config"
	"bastion/services"
	"bastion/utils"
	"fmt"
	"os"
)

func TestServiceRegistration() {
	fmt.Println("🧪 开始测试服务注册功能...")
	
	// 设置配置文件路径
	configPath := "config/config.yaml"
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf("⚠️ 配置文件 %s 不存在，尝试使用示例配置\n", configPath)
		configPath = "config/config.example.yaml"
		if _, err := os.Stat(configPath); os.IsNotExist(err) {
			fmt.Printf("❌ 配置文件 %s 也不存在，跳过配置测试\n", configPath)
			return
		}
	}
	
	// 加载配置
	fmt.Println("📋 测试1: 加载配置文件")
	if err := config.LoadConfig(configPath); err != nil {
		fmt.Printf("❌ 配置加载失败: %v\n", err)
		return
	}
	fmt.Println("✅ 配置加载成功")
	
	// 初始化数据库连接
	fmt.Println("📋 测试2: 初始化数据库连接")
	if err := utils.InitDatabase(); err != nil {
		fmt.Printf("❌ 数据库初始化失败: %v\n", err)
		return
	}
	fmt.Println("✅ 数据库连接初始化成功")
	
	// 测试命令策略服务创建
	fmt.Println("📋 测试3: 创建命令策略服务实例")
	commandPolicyService := services.NewCommandPolicyService(utils.GetDB())
	if commandPolicyService == nil {
		fmt.Println("❌ 命令策略服务创建失败")
		return
	}
	fmt.Println("✅ 命令策略服务实例创建成功")
	
	// 测试服务验证
	fmt.Println("📋 测试4: 验证服务配置")
	if err := commandPolicyService.ValidateService(); err != nil {
		fmt.Printf("❌ 服务配置验证失败: %v\n", err)
		return
	}
	fmt.Println("✅ 服务配置验证成功")
	
	// 测试其他核心服务创建（确保依赖正常）
	fmt.Println("📋 测试5: 验证依赖服务")
	
	// 测试审计服务
	auditService := services.NewAuditService(utils.GetDB())
	if auditService == nil {
		fmt.Println("❌ 审计服务创建失败")
		return
	}
	fmt.Println("✅ 审计服务依赖正常")
	
	// 测试SSH服务
	sshService := services.NewSSHService(utils.GetDB())
	if sshService == nil {
		fmt.Println("❌ SSH服务创建失败")
		return
	}
	fmt.Println("✅ SSH服务依赖正常")
	
	// 清理资源
	utils.CloseDatabase()
	
	fmt.Println("🎉 服务注册功能测试全部通过!")
	fmt.Println("📋 测试总结:")
	fmt.Println("   ✅ 配置文件加载正常")
	fmt.Println("   ✅ 数据库连接初始化成功")
	fmt.Println("   ✅ 命令策略服务创建成功")
	fmt.Println("   ✅ 服务配置验证通过")
	fmt.Println("   ✅ 服务依赖关系正常")
}

func main() {
	TestServiceRegistration()
}