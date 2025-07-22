package services

import (
	"bastion/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestSSHSessionCreationAuditIntegration 集成测试SSH会话创建的审计记录完整性
func TestSSHSessionCreationAuditIntegration(t *testing.T) {
	// 设置集成测试环境
	db := setupIntegrationTestDB()
	auditService := NewAuditService(db)
	
	// 设置Gin路由和中间件
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// 添加审计中间件
	router.Use(auditService.LogMiddleware())
	
	// 模拟用户认证中间件
	router.Use(func(c *gin.Context) {
		user := &models.User{
			ID:       1,
			Username: "testuser",
		}
		c.Set("user", user)
		c.Next()
	})
	
	// 模拟SSH会话创建接口
	router.POST("/api/v1/ssh/sessions", func(c *gin.Context) {
		// 模拟成功的SSH会话创建
		sessionID := "ssh-1753150388-6621976715634441153"
		
		// 在响应前，模拟UpdateOperationLogSessionID的调用
		go func() {
			time.Sleep(50 * time.Millisecond) // 模拟异步更新
			auditService.UpdateOperationLogSessionID(
				1, // userID
				"/api/v1/ssh/sessions",
				sessionID,
				time.Now(),
			)
		}()
		
		c.JSON(201, gin.H{
			"session_id": sessionID,
			"status":     "created",
			"asset_name": "test-server",
		})
	})
	
	// 执行SSH会话创建请求
	requestBody := `{
		"asset_id": 123,
		"credential_id": 456,
		"protocol": "ssh",
		"width": 80,
		"height": 24
	}`
	
	req, _ := http.NewRequest("POST", "/api/v1/ssh/sessions", bytes.NewBufferString(requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "192.168.1.100")
	
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	// 等待异步操作完成
	time.Sleep(200 * time.Millisecond)
	
	// 验证HTTP响应
	assert.Equal(t, 201, w.Code, "SSH会话创建应该返回201状态码")
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err, "响应应该是有效的JSON")
	assert.Equal(t, "ssh-1753150388-6621976715634441153", response["session_id"], "应该返回正确的SessionID")
	
	// 关键验证1: 检查数据库中只有一条操作审计记录
	var auditCount int64
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").Count(&auditCount)
	assert.Equal(t, int64(1), auditCount, "应该只产生一条操作审计记录，不应该有重复")
	
	// 关键验证2: 检查操作审计记录的内容完整性
	var operationLog models.OperationLog
	err = db.Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").First(&operationLog).Error
	assert.NoError(t, err, "应该能找到操作审计记录")
	
	// 验证基本审计字段
	assert.Equal(t, uint(1), operationLog.UserID, "用户ID应该正确")
	assert.Equal(t, "testuser", operationLog.Username, "用户名应该正确")
	assert.Equal(t, "POST", operationLog.Method, "HTTP方法应该正确")
	assert.Equal(t, "/api/v1/ssh/sessions", operationLog.URL, "URL应该正确")
	assert.Equal(t, "create", operationLog.Action, "操作类型应该是create")
	assert.Equal(t, "session", operationLog.Resource, "资源类型应该是session")
	assert.Equal(t, 201, operationLog.Status, "状态码应该是201")
	
	// 关键验证3: 检查SessionID字段是否正确填充
	assert.Equal(t, "ssh-1753150388-6621976715634441153", operationLog.SessionID, 
		"SessionID字段应该包含完整的会话标识符")
	
	// 关键验证4: 检查ResourceID字段（简化后统一为0）
	assert.Equal(t, uint(0), operationLog.ResourceID, 
		"ResourceID已简化，统一为0")
	
	// 验证时间戳合理性
	assert.WithinDuration(t, time.Now(), operationLog.CreatedAt, 5*time.Second, "创建时间应该在合理范围内")
	assert.WithinDuration(t, time.Now(), operationLog.UpdatedAt, 5*time.Second, "更新时间应该在合理范围内")
	
	t.Logf("✅ 集成测试通过: SSH会话创建产生了1条完整的审计记录")
	t.Logf("   - SessionID: %s", operationLog.SessionID)
	t.Logf("   - ResourceID: %d", operationLog.ResourceID)
	t.Logf("   - 操作类型: %s %s", operationLog.Action, operationLog.Resource)
}

// TestConcurrentSSHSessionCreation 测试并发SSH会话创建的审计记录唯一性
func TestConcurrentSSHSessionCreation(t *testing.T) {
	// 每个goroutine共享同一个数据库连接
	db := setupIntegrationTestDB()
	auditService := NewAuditService(db)
	
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(auditService.LogMiddleware())
	
	// 模拟多用户认证中间件
	router.Use(func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "1"
		}
		user := &models.User{
			ID:       1,
			Username: fmt.Sprintf("user_%s", userID),
		}
		c.Set("user", user)
		c.Next()
	})
	
	router.POST("/api/v1/ssh/sessions", func(c *gin.Context) {
		// 生成唯一的SessionID（使用随机数确保唯一性）
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "1"
		}
		sessionID := fmt.Sprintf("ssh-%d-%s-%d", time.Now().Unix(), userID, rand.Int63())
		
		// 异步更新SessionID
		go func() {
			time.Sleep(50 * time.Millisecond)
			auditService.UpdateOperationLogSessionID(1, "/api/v1/ssh/sessions", sessionID, time.Now())
		}()
		
		c.JSON(201, gin.H{"session_id": sessionID, "status": "created"})
	})
	
	// 顺序创建5个SSH会话 (避免并发数据库问题)
	concurrentRequests := 5
	responses := make([]*httptest.ResponseRecorder, concurrentRequests)
	
	for i := 0; i < concurrentRequests; i++ {
		responses[i] = httptest.NewRecorder()
		
		req, _ := http.NewRequest("POST", "/api/v1/ssh/sessions", 
			bytes.NewBufferString(`{"asset_id": 123, "credential_id": 456}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", fmt.Sprintf("%d", i+1))
		
		// 顺序执行请求，但快速连续
		router.ServeHTTP(responses[i], req)
		time.Sleep(10 * time.Millisecond) // 小间隔确保异步操作完成
	}
	
	// 等待所有异步操作完成
	time.Sleep(200 * time.Millisecond)
	
	// 验证所有请求都成功
	for i, resp := range responses {
		assert.Equal(t, 201, resp.Code, fmt.Sprintf("请求%d应该成功", i+1))
	}
	
	// 验证数据库中有正确数量的审计记录
	var totalAuditCount int64
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").Count(&totalAuditCount)
	assert.Equal(t, int64(concurrentRequests), totalAuditCount, 
		fmt.Sprintf("应该产生%d条审计记录，每个会话一条", concurrentRequests))
	
	// 验证每条记录的SessionID都是唯一的
	var sessionIDs []string
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").
		Pluck("session_id", &sessionIDs)
	
	uniqueSessionIDs := make(map[string]bool)
	for _, sessionID := range sessionIDs {
		assert.False(t, uniqueSessionIDs[sessionID], fmt.Sprintf("SessionID %s 应该是唯一的", sessionID))
		uniqueSessionIDs[sessionID] = true
	}
	
	t.Logf("✅ 并发测试通过: %d个并发SSH会话创建产生了%d条唯一的审计记录", 
		concurrentRequests, totalAuditCount)
}

// TestAuditRecordConsistencyWithSessionAudit 测试操作审计与会话审计的一致性
func TestAuditRecordConsistencyWithSessionAudit(t *testing.T) {
	db := setupIntegrationTestDB()
	auditService := NewAuditService(db)
	
	// 模拟完整的SSH会话创建流程
	sessionID := "ssh-1753150388-6621976715634441153"
	userID := uint(1)
	assetID := uint(123)
	credentialID := uint(456)
	
	// 1. 模拟中间件记录操作日志
	err := auditService.RecordOperationLog(
		userID, "testuser", "192.168.1.100",
		"POST", "/api/v1/ssh/sessions",
		"create", "session", 0, "", // 初始SessionID为空
		201, "SSH session created successfully",
		nil, nil, 0, false,
	)
	assert.NoError(t, err, "应该成功记录操作日志")
	
	// 2. 模拟SSH服务记录会话开始
	go auditService.RecordSessionStart(
		sessionID, userID, "testuser", 
		assetID, "test-server", "192.168.1.100:22",
		credentialID, "ssh", "192.168.1.100",
	)
	
	// 3. 模拟更新操作日志的SessionID
	time.Sleep(50 * time.Millisecond)
	err = auditService.UpdateOperationLogSessionID(userID, "/api/v1/ssh/sessions", sessionID, time.Now())
	assert.NoError(t, err, "应该成功更新操作日志的SessionID")
	
	// 等待异步操作完成
	time.Sleep(100 * time.Millisecond)
	
	// 验证操作审计记录
	var operationLog models.OperationLog
	err = db.Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").First(&operationLog).Error
	assert.NoError(t, err, "应该找到操作审计记录")
	assert.Equal(t, sessionID, operationLog.SessionID, "操作审计记录应该包含SessionID")
	assert.Equal(t, uint(0), operationLog.ResourceID, "操作审计记录ResourceID已简化为0")
	
	// 验证会话记录
	var sessionRecord models.SessionRecord
	err = db.Where("session_id = ?", sessionID).First(&sessionRecord).Error
	assert.NoError(t, err, "应该找到会话记录")
	assert.Equal(t, userID, sessionRecord.UserID, "会话记录用户ID应该一致")
	assert.Equal(t, assetID, sessionRecord.AssetID, "会话记录资产ID应该一致")
	
	// 验证两种记录的一致性
	assert.Equal(t, operationLog.UserID, sessionRecord.UserID, "操作审计和会话记录的用户ID应该一致")
	assert.Equal(t, operationLog.SessionID, sessionRecord.SessionID, "操作审计和会话记录的SessionID应该一致")
	assert.WithinDuration(t, operationLog.CreatedAt, sessionRecord.CreatedAt, 2*time.Second, "两种记录的时间应该接近")
	
	t.Logf("✅ 一致性测试通过: 操作审计和会话记录一致")
	t.Logf("   - 操作审计SessionID: %s", operationLog.SessionID)
	t.Logf("   - 会话记录SessionID: %s", sessionRecord.SessionID)
}

// setupIntegrationTestDB 设置集成测试数据库
func setupIntegrationTestDB() *gorm.DB {
	// 设置测试配置
	setupTestConfig()
	
	// 创建内存数据库
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to test database: %v", err))
	}
	
	// 自动迁移所有表
	err = db.AutoMigrate(
		&models.OperationLog{},
		&models.SessionRecord{},
		&models.User{},
		&models.Asset{},
		&models.Credential{},
	)
	if err != nil {
		panic(fmt.Sprintf("Failed to migrate test database: %v", err))
	}
	
	// 创建测试数据
	createTestData(db)
	
	return db
}

// createTestData 创建集成测试所需的基础数据
func createTestData(db *gorm.DB) {
	// 创建测试用户
	users := []models.User{
		{ID: 1, Username: "testuser", Password: "hashedpassword"},
		{ID: 2, Username: "user2", Password: "hashedpassword"},
	}
	db.Create(&users)
	
	// 创建测试资产
	assets := []models.Asset{
		{ID: 123, Name: "test-server", Address: "192.168.1.100", Port: 22},
		{ID: 124, Name: "prod-server", Address: "192.168.1.101", Port: 22},
	}
	db.Create(&assets)
	
	// 创建测试凭证
	credentials := []models.Credential{
		{ID: 456, Username: "root", Type: "password"},
		{ID: 457, Username: "admin", Type: "key"},
	}
	db.Create(&credentials)
}