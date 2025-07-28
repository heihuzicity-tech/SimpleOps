package main

import (
	"bastion/services"
	"bastion/utils"
	"fmt"
)

func TestCommandInterception() {
	fmt.Println("🧪 开始测试命令拦截功能...")
	
	// 直接使用数据库连接
	db := utils.GetDB()
	if db == nil {
		fmt.Printf("❌ 数据库连接失败\n")
		return
	}
	
	// 创建命令策略服务实例
	commandPolicyService := services.NewCommandPolicyService(db)
	
	// 测试场景1: 测试危险命令检查
	fmt.Println("📋 测试场景1: 危险命令检查")
	
	testCommands := []string{
		"shutdown -h now",
		"rm -rf /",
		"ls -la",
		"reboot",
		"cat /etc/passwd",
		"dd if=/dev/zero of=/dev/sda",
	}
	
	// 使用一个测试用户ID (假设用户ID为1存在)
	testUserID := uint(1)
	testSessionID := "test-session-123"
	
	fmt.Println("🔍 测试命令检查结果:")
	for i, cmd := range testCommands {
		allowed, violation := commandPolicyService.CheckCommand(testUserID, testSessionID, cmd)
		
		if allowed {
			fmt.Printf("   %d. ✅ 命令 '%s' - 允许执行\n", i+1, cmd)
		} else {
			fmt.Printf("   %d. ❌ 命令 '%s' - 被拦截\n", i+1, cmd)
			if violation != nil {
				fmt.Printf("       策略: %s (类型: %s)\n", violation.PolicyName, violation.PolicyType)
			}
		}
	}
	
	// 测试场景2: 验证命令匹配逻辑
	fmt.Println("\n📋 测试场景2: 命令匹配逻辑")
	
	// 测试精确匹配
	fmt.Println("🔍 精确匹配测试:")
	exactTests := map[string]bool{
		"rm": true,  // 应该匹配
		"rm -rf /": true,  // 应该匹配(命令主体是rm)
		"remove": false,   // 不应该匹配
		"format": false,   // 不应该匹配
	}
	
	for cmd, shouldMatch := range exactTests {
		allowed, violation := commandPolicyService.CheckCommand(testUserID, testSessionID, cmd)
		matched := !allowed && violation != nil
		
		if matched == shouldMatch {
			status := "允许"
			if matched { status = "拦截" }
			fmt.Printf("   ✅ '%s' - %s (符合预期)\n", cmd, status)
		} else {
			status := "允许"
			if matched { status = "拦截" }
			expectedStatus := "允许"
			if shouldMatch { expectedStatus = "拦截" }
			fmt.Printf("   ❌ '%s' - %s (预期: %s)\n", cmd, status, expectedStatus)
		}
	}
	
	fmt.Println("🎉 命令拦截功能测试完成!")
}

func main() {
	TestCommandInterception()
}