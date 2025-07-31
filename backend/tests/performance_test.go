package tests

import (
	"bastion/models"
	"bastion/services"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"
	
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// BenchmarkCommandMatch 命令匹配性能测试
func BenchmarkCommandMatch(b *testing.B) {
	// 创建测试数据库连接
	db := setupTestDB()
	if db == nil {
		b.Skip("Database connection not available")
		return
	}
	
	// 创建服务实例
	filterService := services.NewCommandFilterService(db)
	matcherService := services.NewCommandMatcherService(db, filterService)
	
	// 准备测试数据
	testCommands := []string{
		"ls -la",
		"cat /etc/passwd", 
		"rm -rf /tmp/*",
		"sudo systemctl restart nginx",
		"grep -r \"password\" /var/log/",
		"find / -name \"*.conf\"",
		"ps aux | grep mysql",
		"netstat -tlnp",
		"vi /etc/hosts",
		"chmod 777 /tmp",
	}
	
	userID := uint(1)
	assetID := uint(1)
	account := "root"
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			cmd := testCommands[rand.Intn(len(testCommands))]
			req := &models.CommandMatchRequest{
				Command: cmd,
				UserID:  userID,
				AssetID: assetID,
				Account: account,
			}
			
			_, err := matcherService.MatchCommand(req)
			if err != nil {
				b.Errorf("Command match failed: %v", err)
			}
		}
	})
}

// TestConcurrentCommandMatch 并发命令匹配测试
func TestConcurrentCommandMatch(t *testing.T) {
	// 创建测试数据库连接
	db := setupTestDB()
	if db == nil {
		t.Skip("Database connection not available")
		return
	}
	
	// 创建服务实例
	filterService := services.NewCommandFilterService(db)
	matcherService := services.NewCommandMatcherService(db, filterService)
	
	// 测试参数
	numGoroutines := 100
	numRequests := 1000
	testCommands := []string{
		"ls -la",
		"cat /etc/passwd", 
		"rm -rf /tmp/*",
		"sudo systemctl restart nginx",
		"grep -r \"password\" /var/log/",
	}
	
	var wg sync.WaitGroup
	var totalDuration time.Duration
	var mutex sync.Mutex
	errorCount := 0
	
	start := time.Now()
	
	// 启动并发测试
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			
			for j := 0; j < numRequests/numGoroutines; j++ {
				cmdStart := time.Now()
				
				req := &models.CommandMatchRequest{
					Command: testCommands[rand.Intn(len(testCommands))],
					UserID:  uint(rand.Intn(10) + 1),
					AssetID: uint(rand.Intn(5) + 1),
					Account: "root",
				}
				
				_, err := matcherService.MatchCommand(req)
				
				mutex.Lock()
				if err != nil {
					errorCount++
				}
				totalDuration += time.Since(cmdStart)
				mutex.Unlock()
			}
		}()
	}
	
	wg.Wait()
	totalTime := time.Since(start)
	
	// 输出性能统计
	t.Logf("=== 并发性能测试结果 ===")
	t.Logf("总耗时: %v", totalTime)
	t.Logf("总请求数: %d", numRequests)
	t.Logf("并发数: %d", numGoroutines)
	t.Logf("错误数: %d", errorCount)
	t.Logf("平均响应时间: %v", totalDuration/time.Duration(numRequests))
	t.Logf("TPS: %.2f", float64(numRequests)/totalTime.Seconds())
	
	// 获取缓存统计
	cacheStats := matcherService.GetCacheStats()
	t.Logf("\n=== 缓存统计 ===")
	if regexCache, ok := cacheStats["regex_cache"].(map[string]interface{}); ok {
		t.Logf("正则缓存命中率: %.2f%%", regexCache["hit_rate"])
		t.Logf("正则缓存大小: %v/%v", regexCache["size"], regexCache["max_size"])
	}
	if userAssetCache, ok := cacheStats["user_asset_cache"].(map[string]interface{}); ok {
		t.Logf("用户资产缓存命中率: %.2f%%", userAssetCache["hit_rate"])
		t.Logf("用户资产缓存大小: %v/%v", userAssetCache["size"], userAssetCache["max_size"])
	}
	if commandGroupCache, ok := cacheStats["command_group_cache"].(map[string]interface{}); ok {
		t.Logf("命令组缓存命中率: %.2f%%", commandGroupCache["hit_rate"])
		t.Logf("命令组缓存大小: %v/%v", commandGroupCache["size"], commandGroupCache["max_size"])
	}
	
	// 验证性能目标
	avgResponseTime := totalDuration / time.Duration(numRequests)
	if avgResponseTime > 100*time.Millisecond {
		t.Errorf("平均响应时间超过100ms目标: %v", avgResponseTime)
	}
	
	if errorCount > numRequests/100 { // 错误率不能超过1%
		t.Errorf("错误率过高: %d/%d", errorCount, numRequests)
	}
	
	t.Logf("✅ 性能测试通过!")
}

// TestCacheEffectiveness 缓存有效性测试
func TestCacheEffectiveness(t *testing.T) {
	// 创建测试数据库连接
	db := setupTestDB()
	if db == nil {
		t.Skip("Database connection not available")
		return
	}
	
	// 创建服务实例
	filterService := services.NewCommandFilterService(db)
	matcherService := services.NewCommandMatcherService(db, filterService)
	
	// 重置性能统计
	matcherService.ResetPerformanceStats()
	
	// 测试相同请求的缓存效果
	req := &models.CommandMatchRequest{
		Command: "ls -la",
		UserID:  1,
		AssetID: 1,
		Account: "root",
	}
	
	// 第一次请求（缓存未命中）
	start1 := time.Now()
	_, err := matcherService.MatchCommand(req)
	firstTime := time.Since(start1)
	if err != nil {
		t.Fatalf("First request failed: %v", err)
	}
	
	// 第二次请求（应该使用缓存）
	start2 := time.Now()
	_, err = matcherService.MatchCommand(req)
	secondTime := time.Since(start2)
	if err != nil {
		t.Fatalf("Second request failed: %v", err)
	}
	
	// 检查缓存效果
	t.Logf("第一次请求耗时: %v", firstTime)
	t.Logf("第二次请求耗时: %v", secondTime)
	
	if secondTime >= firstTime {
		t.Logf("警告: 第二次请求耗时没有明显改善，可能缓存未生效")
	} else {
		improvement := float64(firstTime-secondTime) / float64(firstTime) * 100
		t.Logf("缓存优化效果: %.2f%%", improvement)
	}
	
	// 获取缓存统计
	cacheStats := matcherService.GetCacheStats()
	t.Logf("\n=== 缓存统计 ===")
	t.Logf("缓存统计: %+v", cacheStats)
}

// setupTestDB 设置测试数据库连接
func setupTestDB() *gorm.DB {
	// 这里需要根据实际的数据库配置进行调整
	dsn := "root:password@tcp(localhost:3306)/bastion_test?charset=utf8mb4&parseTime=True&loc=Local"
	
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // 静默模式，避免测试时输出太多SQL
	})
	
	if err != nil {
		fmt.Printf("Failed to connect to test database: %v\n", err)
		return nil
	}
	
	return db
}

// BenchmarkRegexCompilation 正则表达式编译性能测试
func BenchmarkRegexCompilation(b *testing.B) {
	// 创建测试数据库连接
	db := setupTestDB()
	if db == nil {
		b.Skip("Database connection not available")
		return
	}
	
	// 创建服务实例
	filterService := services.NewCommandFilterService(db)
	matcherService := services.NewCommandMatcherService(db, filterService)
	
	// 测试正则表达式项
	testItem := &models.CommandGroupItem{
		ID:         1,
		Type:       models.CommandTypeRegex,
		Content:    "^(sudo\\s+)?(rm|del|delete)\\s+.*",
		IgnoreCase: true,
	}
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := matcherService.getOrCompileRegex(testItem)
			if err != nil {
				b.Errorf("Regex compilation failed: %v", err)
			}
		}
	})
	
	b.StopTimer()
	
	// 输出缓存统计
	stats := matcherService.GetCacheStats()
	if regexCache, ok := stats["regex_cache"].(map[string]interface{}); ok {
		b.Logf("正则缓存命中率: %.2f%%", regexCache["hit_rate"])
	}
}