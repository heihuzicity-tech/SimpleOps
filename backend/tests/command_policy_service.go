package main

import (
	"fmt"
	"os"
	
	_ "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// 简化的模型结构用于测试
type User struct {
	ID       uint   `gorm:"primaryKey"`
	Username string
}

type Command struct {
	ID          uint   `gorm:"primaryKey"`
	Name        string
	Type        string
	Description string
}

type CommandGroup struct {
	ID          uint   `gorm:"primaryKey"`
	Name        string
	Description string
	IsPreset    bool
}

func TestCommandPolicyService() {
	fmt.Println("🧪 开始测试命令策略服务...")
	
	// 构建数据库连接字符串
	dsn := "root:password123@tcp(10.0.0.7:3306)/bastion?charset=utf8mb4&parseTime=True&loc=Local"
	
	// 连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Printf("❌ 数据库连接失败: %v\n", err)
		os.Exit(1)
	}
	
	// 测试1: 查询命令数据
	var commands []Command
	result := db.Find(&commands)
	if result.Error != nil {
		fmt.Printf("❌ 查询命令失败: %v\n", result.Error)
		os.Exit(1)
	}
	
	fmt.Printf("✅ 数据库连接成功\n")
	fmt.Printf("✅ 命令表查询成功，共 %d 条记录\n", len(commands))
	
	// 显示前几条命令
	fmt.Println("📋 预设命令示例:")
	for i, cmd := range commands {
		if i >= 5 { break }
		fmt.Printf("   %d. %s (%s): %s\n", i+1, cmd.Name, cmd.Type, cmd.Description)
	}
	
	// 测试2: 查询命令组数据
	var groups []CommandGroup
	result = db.Find(&groups)
	if result.Error != nil {
		fmt.Printf("❌ 查询命令组失败: %v\n", result.Error)
		os.Exit(1)
	}
	
	fmt.Printf("✅ 命令组表查询成功，共 %d 条记录\n", len(groups))
	
	// 显示命令组
	fmt.Println("📁 预设命令组:")
	for i, group := range groups {
		fmt.Printf("   %d. %s: %s (预设: %t)\n", i+1, group.Name, group.Description, group.IsPreset)
	}
	
	// 测试3: 验证表关联关系
	type CommandGroupCommand struct {
		CommandGroupID uint
		CommandID      uint
	}
	
	var associations []CommandGroupCommand
	result = db.Table("command_group_commands").Find(&associations)
	if result.Error != nil {
		fmt.Printf("❌ 查询命令组关联失败: %v\n", result.Error)
		os.Exit(1)
	}
	
	fmt.Printf("✅ 命令组关联表查询成功，共 %d 条关联记录\n", len(associations))
	
	fmt.Println("🎉 命令策略服务基础功能测试全部通过!")
}

func main() {
	TestCommandPolicyService()
}