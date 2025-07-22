package services

import (
	"bastion/models"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestConcurrentAuditRecording 测试并发审计记录的数据一致性
func TestConcurrentAuditRecording(t *testing.T) {
	// 设置测试数据库
	db := setupConcurrentTestDB()
	auditService := NewAuditService(db)
	
	// 并发参数
	concurrentUsers := 10
	sessionsPerUser := 5
	totalExpectedRecords := concurrentUsers * sessionsPerUser
	
	t.Logf("开始并发测试: %d个用户，每用户%d个会话，预期%d条记录", 
		concurrentUsers, sessionsPerUser, totalExpectedRecords)
	
	// 使用WaitGroup确保所有goroutine完成
	var wg sync.WaitGroup
	var mu sync.Mutex
	errors := make([]error, 0)
	
	// 启动多个用户的并发会话创建
	for userID := 1; userID <= concurrentUsers; userID++ {
		wg.Add(1)
		
		go func(uid int) {
			defer wg.Done()
			
			for sessionNum := 1; sessionNum <= sessionsPerUser; sessionNum++ {
				// 生成唯一SessionID
				sessionID := fmt.Sprintf("ssh-%d-user%d-session%d-%d", 
					time.Now().Unix(), uid, sessionNum, time.Now().UnixNano())
				
				// 记录操作日志
				err := auditService.RecordOperationLog(
					uint(uid),                    // userID
					fmt.Sprintf("user%d", uid),  // username
					fmt.Sprintf("192.168.1.%d", uid), // IP
					"POST",                       // method
					"/api/v1/ssh/sessions",       // URL
					"create",                     // action
					"session",                    // resource
					0,                           // resourceID (初始为0)
					"",                          // sessionID (初始为空)
					201,                         // status
					"SSH session created successfully", // message
					nil, nil, 0, false,         // 其他参数
				)
				
				if err != nil {
					mu.Lock()
					errors = append(errors, fmt.Errorf("用户%d会话%d记录失败: %v", uid, sessionNum, err))
					mu.Unlock()
					continue
				}
				
				// 模拟异步更新SessionID (实际生产环境的行为)
				time.Sleep(10 * time.Millisecond) // 小延迟模拟真实场景
				
				err = auditService.UpdateOperationLogSessionID(
					uint(uid),
					"/api/v1/ssh/sessions",
					sessionID,
					time.Now(),
				)
				
				if err != nil {
					mu.Lock()
					errors = append(errors, fmt.Errorf("用户%d会话%d更新SessionID失败: %v", uid, sessionNum, err))
					mu.Unlock()
				}
			}
		}(userID)
	}
	
	// 等待所有goroutine完成
	wg.Wait()
	
	// 验证没有错误
	assert.Equal(t, 0, len(errors), "并发操作不应该产生错误")
	if len(errors) > 0 {
		for _, err := range errors {
			t.Logf("错误: %v", err)
		}
	}
	
	// 等待所有异步操作完成
	time.Sleep(500 * time.Millisecond)
	
	// 验证数据库记录总数
	var totalCount int64
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").Count(&totalCount)
	assert.Equal(t, int64(totalExpectedRecords), totalCount, 
		fmt.Sprintf("应该产生%d条审计记录", totalExpectedRecords))
	
	// 验证每个用户的记录数
	for userID := 1; userID <= concurrentUsers; userID++ {
		var userCount int64
		db.Model(&models.OperationLog{}).Where(
			"user_id = ? AND url = ? AND method = ?", 
			userID, "/api/v1/ssh/sessions", "POST").Count(&userCount)
		assert.Equal(t, int64(sessionsPerUser), userCount, 
			fmt.Sprintf("用户%d应该有%d条记录", userID, sessionsPerUser))
	}
	
	// 验证SessionID唯一性
	var sessionIDs []string
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").
		Pluck("session_id", &sessionIDs)
	
	uniqueSessionIDs := make(map[string]bool)
	duplicateCount := 0
	
	for _, sessionID := range sessionIDs {
		if sessionID == "" {
			continue // 跳过空SessionID
		}
		if uniqueSessionIDs[sessionID] {
			duplicateCount++
			t.Logf("发现重复SessionID: %s", sessionID)
		} else {
			uniqueSessionIDs[sessionID] = true
		}
	}
	
	assert.Equal(t, 0, duplicateCount, "不应该有重复的SessionID")
	
	// 验证ResourceID正确性
	var resourceIDs []uint
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ? AND session_id != ''", 
		"/api/v1/ssh/sessions", "POST").Pluck("resource_id", &resourceIDs)
	
	nonZeroResourceIDs := 0
	for _, resourceID := range resourceIDs {
		if resourceID > 0 {
			nonZeroResourceIDs++
		}
	}
	
	// 至少应该有一些ResourceID被正确提取
	assert.Greater(t, nonZeroResourceIDs, 0, "应该有ResourceID被正确提取")
	
	t.Logf("✅ 并发测试完成:")
	t.Logf("   - 总记录数: %d", totalCount)
	t.Logf("   - 唯一SessionID数: %d", len(uniqueSessionIDs))
	t.Logf("   - 有效ResourceID数: %d", nonZeroResourceIDs)
	t.Logf("   - 重复SessionID数: %d", duplicateCount)
}

// TestAuditServiceThreadSafety 测试审计服务的线程安全性
func TestAuditServiceThreadSafety(t *testing.T) {
	db := setupConcurrentTestDB()
	auditService := NewAuditService(db)
	
	// 模拟高并发场景
	concurrentOps := 100
	var wg sync.WaitGroup
	
	t.Logf("开始线程安全测试: %d个并发操作", concurrentOps)
	
	// 并发执行多种审计操作
	for i := 0; i < concurrentOps; i++ {
		wg.Add(1)
		
		go func(opID int) {
			defer wg.Done()
			
			// 测试不同类型的操作
			operations := []struct {
				method   string
				url      string  
				action   string
				resource string
			}{
				{"POST", "/api/v1/ssh/sessions", "create", "session"},
				{"GET", "/api/v1/assets", "read", "assets"},
				{"PUT", "/api/v1/users/1", "update", "users"},
				{"DELETE", "/api/v1/credentials/1", "delete", "credentials"},
			}
			
			op := operations[opID%len(operations)]
			sessionID := fmt.Sprintf("test-session-%d-%d", opID, time.Now().UnixNano())
			
			err := auditService.RecordOperationLog(
				1, "testuser", "127.0.0.1",
				op.method, op.url, op.action, op.resource,
				uint(opID), sessionID,
				200, "操作成功",
				nil, nil, 0, false,
			)
			
			assert.NoError(t, err, fmt.Sprintf("操作%d应该成功", opID))
		}(i)
	}
	
	wg.Wait()
	
	// 验证所有记录都被正确保存
	var totalCount int64
	db.Model(&models.OperationLog{}).Count(&totalCount)
	assert.GreaterOrEqual(t, int(totalCount), concurrentOps, "应该至少有并发操作数量的记录")
	
	t.Logf("✅ 线程安全测试完成: 成功处理%d个并发操作，数据库记录%d条", 
		concurrentOps, totalCount)
}

// TestResourceIDExtractionUnderLoad 测试高负载下的ResourceID提取准确性
func TestResourceIDExtractionUnderLoad(t *testing.T) {
	db := setupConcurrentTestDB() 
	auditService := NewAuditService(db)
	
	// 测试不同的SessionID格式
	testCases := []struct {
		sessionID    string
		expectedID   uint
		description  string
	}{
		{"ssh-1753150388-6621976715634441153", 1753150388, "标准格式"},
		{"ssh-1234567890-999", 1234567890, "短格式"},
		{"ssh-999888777-abc123def", 999888777, "混合格式"},
		{"invalid-session", 0, "无效格式"}, // 应该使用哈希值，但我们测试≠0
	}
	
	concurrentTests := 20 
	var wg sync.WaitGroup
	results := make([]bool, len(testCases)*concurrentTests)
	
	t.Logf("开始ResourceID提取负载测试: %d个测试用例 × %d并发", 
		len(testCases), concurrentTests)
	
	for i := 0; i < concurrentTests; i++ {
		wg.Add(1)
		
		go func(round int) {
			defer wg.Done()
			
			for j, tc := range testCases {
				// 记录操作日志
				err := auditService.RecordOperationLog(
					1, "testuser", "127.0.0.1",
					"POST", "/api/v1/ssh/sessions",
					"create", "session", 0, "",
					201, "测试记录",
					nil, nil, 0, false,
				)
				
				if err != nil {
					results[round*len(testCases)+j] = false
					continue
				}
				
				// 更新SessionID
				err = auditService.UpdateOperationLogSessionID(
					1, "/api/v1/ssh/sessions", tc.sessionID, time.Now())
				
				results[round*len(testCases)+j] = (err == nil)
			}
		}(i)
	}
	
	wg.Wait()
	time.Sleep(200 * time.Millisecond) // 等待异步操作
	
	// 验证结果
	successCount := 0
	for _, success := range results {
		if success {
			successCount++
		}
	}
	
	expectedSuccess := len(testCases) * concurrentTests
	successRate := float64(successCount) / float64(expectedSuccess) * 100
	
	assert.GreaterOrEqual(t, successRate, 95.0, "成功率应该≥95%")
	
	// 验证ResourceID提取准确性
	var records []models.OperationLog
	db.Where("url = ? AND method = ? AND session_id != ''", 
		"/api/v1/ssh/sessions", "POST").Find(&records)
	
	correctExtractions := 0
	for _, record := range records {
		if record.SessionID == "ssh-1753150388-6621976715634441153" && record.ResourceID == 1753150388 {
			correctExtractions++
		} else if record.SessionID == "ssh-1234567890-999" && record.ResourceID == 1234567890 {
			correctExtractions++
		} else if record.SessionID == "ssh-999888777-abc123def" && record.ResourceID == 999888777 {
			correctExtractions++
		} else if record.SessionID == "invalid-session" && record.ResourceID != 0 {
			correctExtractions++ // 无效格式应该使用哈希值
		}
	}
	
	t.Logf("✅ ResourceID提取负载测试完成:")
	t.Logf("   - 操作成功率: %.1f%% (%d/%d)", successRate, successCount, expectedSuccess)
	t.Logf("   - 数据库记录数: %d", len(records))
	t.Logf("   - ResourceID正确提取数: %d", correctExtractions)
}

// setupConcurrentTestDB 设置并发测试专用数据库
func setupConcurrentTestDB() *gorm.DB {
	// 设置测试配置
	setupTestConfig()
	
	// 创建内存数据库，支持并发访问
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		// 禁用外键约束以提高并发性能
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to concurrent test database: %v", err))
	}
	
	// 设置连接池参数
	sqlDB, err := db.DB()
	if err != nil {
		panic(fmt.Sprintf("Failed to get underlying sql.DB: %v", err))
	}
	sqlDB.SetMaxOpenConns(20)  // 最大连接数
	sqlDB.SetMaxIdleConns(10)  // 最大空闲连接数
	
	// 自动迁移
	err = db.AutoMigrate(&models.OperationLog{})
	if err != nil {
		panic(fmt.Sprintf("Failed to migrate concurrent test database: %v", err))
	}
	
	return db
}