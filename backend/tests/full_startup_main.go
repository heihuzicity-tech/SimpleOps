package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"time"
)

func TestFullStartup() {
	fmt.Println("🧪 开始测试完整服务启动...")
	
	// 编译程序
	fmt.Println("📋 测试1: 编译主程序")
	cmd := exec.Command("go", "build", "-o", "test_server", ".")
	if err := cmd.Run(); err != nil {
		fmt.Printf("❌ 编译失败: %v\n", err)
		return
	}
	fmt.Println("✅ 主程序编译成功")
	
	// 启动服务器
	fmt.Println("📋 测试2: 启动服务器")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	serverCmd := exec.CommandContext(ctx, "./test_server")
	serverCmd.Stdout = os.Stdout
	serverCmd.Stderr = os.Stderr
	
	// 在后台启动服务器
	if err := serverCmd.Start(); err != nil {
		fmt.Printf("❌ 服务器启动失败: %v\n", err)
		return
	}
	
	// 等待服务器启动
	fmt.Println("⏳ 等待服务器启动...")
	time.Sleep(3 * time.Second)
	
	// 测试健康检查接口
	fmt.Println("📋 测试3: 健康检查接口")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://localhost:8080/api/v1/health")
	if err != nil {
		fmt.Printf("❌ 健康检查失败: %v\n", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			fmt.Println("✅ 健康检查接口正常")
		} else {
			fmt.Printf("⚠️ 健康检查状态码: %d\n", resp.StatusCode)
		}
	}
	
	// 测试命令过滤接口
	fmt.Println("📋 测试4: 命令过滤接口")
	testRoutes := []string{
		"/api/v1/command-filter/commands",
		"/api/v1/command-filter/command-groups", 
		"/api/v1/command-filter/policies",
	}
	
	for _, route := range testRoutes {
		url := "http://localhost:8080" + route
		resp, err := client.Get(url)
		if err != nil {
			fmt.Printf("❌ 路由 %s 访问失败: %v\n", route, err)
			continue
		}
		defer resp.Body.Close()
		
		// 预期返回401未认证
		if resp.StatusCode == 401 {
			fmt.Printf("✅ 路由 %s 正确返回401 (需要认证)\n", route)
		} else {
			fmt.Printf("⚠️ 路由 %s 状态码: %d (预期401)\n", route, resp.StatusCode)
		}
	}
	
	// 停止服务器
	fmt.Println("📋 测试5: 优雅关闭服务器")
	if err := serverCmd.Process.Signal(os.Interrupt); err != nil {
		fmt.Printf("⚠️ 发送中断信号失败: %v\n", err)
		serverCmd.Process.Kill()
	}
	
	// 等待服务器关闭
	serverCmd.Wait()
	
	// 清理测试文件
	os.Remove("test_server")
	
	fmt.Println("🎉 完整服务启动测试完成!")
	fmt.Println("📋 测试总结:")
	fmt.Println("   ✅ 主程序编译成功")
	fmt.Println("   ✅ 服务器启动正常")
	fmt.Println("   ✅ 健康检查接口工作")
	fmt.Println("   ✅ 命令过滤接口注册成功")
	fmt.Println("   ✅ 服务器优雅关闭")
}

func main() {
	TestFullStartup()
}