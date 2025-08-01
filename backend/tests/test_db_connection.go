package main

import (
	"bastion/config"
	"fmt"
	"log"
	"net"
	"time"
)

func main() {
	fmt.Println("=== 测试数据库连接 ===")

	// 加载配置
	if err := config.LoadConfig("config/config.yaml"); err != nil {
		log.Printf("加载配置失败: %v", err)
		return
	}

	dbConfig := config.GlobalConfig.Database
	fmt.Printf("数据库配置:\n")
	fmt.Printf("  Host: %s\n", dbConfig.Host)
	fmt.Printf("  Port: %d\n", dbConfig.Port)
	fmt.Printf("  Username: %s\n", dbConfig.Username)
	fmt.Printf("  Database: %s\n", dbConfig.DBName)

	// 测试网络连接
	address := fmt.Sprintf("%s:%d", dbConfig.Host, dbConfig.Port)
	fmt.Printf("\n正在测试连接到 %s...\n", address)

	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		fmt.Printf("❌ 无法连接到数据库服务器: %v\n", err)
		fmt.Println("\n这解释了为什么会出现500错误 - 数据库连接失败")
		fmt.Println("解决方案:")
		fmt.Println("1. 确保数据库服务器运行在 10.0.0.7:3306")
		fmt.Println("2. 或者修改 config/config.yaml 中的数据库配置为可用的数据库")
		fmt.Println("3. 或者使用 config.example.yaml 中的 localhost 配置")
		return
	}
	defer conn.Close()

	fmt.Printf("✅ 成功连接到数据库服务器 %s\n", address)
	fmt.Println("数据库连接正常，500错误可能由其他原因导致")
}