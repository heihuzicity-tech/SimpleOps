package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func TestAPIRoutes() {
	fmt.Println("🧪 开始测试API路由配置...")
	
	// 测试健康检查接口
	fmt.Println("📡 测试健康检查接口...")
	resp, err := http.Get("http://localhost:8080/api/v1/health")
	if err != nil {
		fmt.Printf("❌ 健康检查接口访问失败: %v\n", err)
		fmt.Println("⚠️  需要先启动后端服务: go run main.go")
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == 200 {
		fmt.Println("✅ 健康检查接口正常")
	} else {
		fmt.Printf("❌ 健康检查接口状态码: %d\n", resp.StatusCode)
		return
	}
	
	// 测试命令过滤接口（需要认证，预期401）
	fmt.Println("📡 测试命令过滤接口认证...")
	
	testRoutes := []string{
		"/api/v1/command-filter/commands",
		"/api/v1/command-filter/command-groups", 
		"/api/v1/command-filter/policies",
		"/api/v1/command-filter/intercept-logs",
	}
	
	client := &http.Client{Timeout: 5 * time.Second}
	
	for _, route := range testRoutes {
		url := "http://localhost:8080" + route
		resp, err := client.Get(url)
		if err != nil {
			fmt.Printf("❌ 路由 %s 访问失败: %v\n", route, err)
			continue
		}
		defer resp.Body.Close()
		
		// 命令过滤接口需要管理员权限，预期返回401未认证
		if resp.StatusCode == 401 {
			fmt.Printf("✅ 路由 %s 正确返回401 (需要认证)\n", route)
		} else {
			fmt.Printf("⚠️  路由 %s 状态码: %d (预期401)\n", route, resp.StatusCode)
		}
	}
	
	fmt.Println("🎉 API路由测试完成!")
}

func main() {
	TestAPIRoutes()
}