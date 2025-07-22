package services

import (
	"bastion/config"
	"bastion/models"
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestConfig 设置测试配置
func setupTestConfig() {
	if config.GlobalConfig == nil {
		config.GlobalConfig = &config.Config{
			Audit: config.AuditConfig{
				EnableOperationLog: true,
				RetentionDays:     30,
			},
		}
	}
}

// setupTestDB 设置测试数据库
func setupTestDB() *gorm.DB {
	// 初始化测试配置
	setupTestConfig()
	
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	
	// 自动迁移测试需要的表
	db.AutoMigrate(&models.OperationLog{})
	
	return db
}


// TestParseResourceInfo 测试资源信息解析
func TestParseResourceInfo(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		requestBody    string
		expectedAction string
		expectedResource string
	}{
		{
			name:           "SSH Session Creation",
			method:         "POST",
			path:           "/api/v1/ssh/sessions",
			requestBody:    `{"assetId": 123, "credentialId": 456}`,
			expectedAction: "create",
			expectedResource: "session",
		},
		{
			name:           "Asset Test Connection",
			method:         "POST",
			path:           "/api/v1/assets/test-connection",
			requestBody:    `{"assetId": 789}`,
			expectedAction: "test",
			expectedResource: "assets",
		},
		{
			name:           "Asset Update",
			method:         "PUT",
			path:           "/api/v1/assets/123",
			requestBody:    `{"name": "updated"}`,
			expectedAction: "update",
			expectedResource: "assets",
		},
	}

	auditService := &AuditService{}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			action, resource, _ := auditService.parseResourceInfo(tt.method, tt.path, tt.requestBody)
			
			assert.Equal(t, tt.expectedAction, action, "Action should match")
			assert.Equal(t, tt.expectedResource, resource, "Resource should match")
		})
	}
}

// TestLogMiddlewareNoDuplication 测试中间件不产生重复记录
func TestLogMiddlewareNoDuplication(t *testing.T) {
	db := setupTestDB()
	auditService := NewAuditService(db)
	
	// 设置Gin为测试模式
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// 添加审计中间件
	router.Use(auditService.LogMiddleware())
	
	// 模拟用户中间件
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
		c.JSON(201, gin.H{
			"sessionId": "ssh-1753150388-6621976715634441153",
			"status":    "created",
		})
	})
	
	// 执行请求
	requestBody := `{"assetId": 123, "credentialId": 456}`
	req, _ := http.NewRequest("POST", "/api/v1/ssh/sessions", bytes.NewBufferString(requestBody))
	req.Header.Set("Content-Type", "application/json")
	
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	// 等待异步操作完成
	time.Sleep(100 * time.Millisecond)
	
	// 验证响应状态
	assert.Equal(t, 201, w.Code)
	
	// 验证数据库中只有一条记录
	var count int64
	db.Model(&models.OperationLog{}).Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").Count(&count)
	assert.Equal(t, int64(1), count, "应该只有一条操作审计记录")
	
	// 验证记录内容
	var log models.OperationLog
	db.Where("url = ? AND method = ?", "/api/v1/ssh/sessions", "POST").First(&log)
	
	assert.Equal(t, uint(1), log.UserID, "用户ID应该正确")
	assert.Equal(t, "testuser", log.Username, "用户名应该正确")
	assert.Equal(t, "create", log.Action, "操作类型应该是create")
	assert.Equal(t, "session", log.Resource, "资源类型应该是session")
	assert.Equal(t, 201, log.Status, "状态码应该是201")
	// 注意：SessionID字段初始为空，需要通过UpdateOperationLogSessionID更新
}


// TestUpdateOperationLogSessionID 测试SessionID更新功能
func TestUpdateOperationLogSessionID(t *testing.T) {
	db := setupTestDB()
	auditService := NewAuditService(db)
	
	// 先创建一个SessionID为空的操作日志记录
	log := &models.OperationLog{
		UserID:     1,
		Username:   "testuser",
		IP:         "127.0.0.1",
		Method:     "POST",
		URL:        "/api/v1/ssh/sessions",
		Action:     "create",
		Resource:   "session",
		ResourceID: 0,        // 保持为0，不更新
		SessionID:  "",       // 初始为空，待更新
		Status:     201,
		Message:    "SSH session created successfully",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	
	err := db.Create(log).Error
	assert.NoError(t, err, "应该能成功创建操作日志记录")
	
	// 测试SessionID更新
	sessionID := "ssh-1753150388-6621976715634441153"
	err = auditService.UpdateOperationLogSessionID(1, "/api/v1/ssh/sessions", sessionID, time.Now())
	assert.NoError(t, err, "应该能成功更新SessionID")
	
	// 验证SessionID已更新，ResourceID保持不变
	var updatedLog models.OperationLog
	db.Where("id = ?", log.ID).First(&updatedLog)
	
	assert.Equal(t, sessionID, updatedLog.SessionID, "SessionID应该被更新为完整会话标识符")
	assert.Equal(t, uint(0), updatedLog.ResourceID, "ResourceID应该保持为0")
	
	// 测试空SessionID的情况
	err = auditService.UpdateOperationLogSessionID(1, "/api/v1/ssh/sessions", "", time.Now())
	assert.Error(t, err, "空SessionID应该返回错误")
}

// TestShouldLogOperation 测试操作过滤逻辑
func TestShouldLogOperation(t *testing.T) {
	auditService := &AuditService{}
	
	// 测试不同的HTTP方法和路径
	testCases := []struct {
		method   string
		path     string
		expected bool
		desc     string
	}{
		{"GET", "/api/v1/users", false, "GET请求应该被过滤"},
		{"POST", "/api/v1/ssh/sessions", true, "POST请求应该记录"},
		{"DELETE", "/audit/operation-logs/123", false, "审计删除操作应该被过滤"},
		{"POST", "/audit/operation-logs/batch/delete", false, "批量删除审计应该被过滤"},
		{"PUT", "/api/v1/assets/123", true, "PUT请求应该记录"},
	}
	
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			result := auditService.shouldLogOperation(tc.method, tc.path)
			assert.Equal(t, tc.expected, result, tc.desc)
		})
	}
}

// TestDetermineAction 测试操作类型判断
func TestDetermineAction(t *testing.T) {
	auditService := &AuditService{}
	
	testCases := []struct {
		method   string
		path     string
		expected string
		desc     string
	}{
		{"POST", "/api/v1/assets/test-connection", "test", "连接测试应该识别为test"},
		{"POST", "/api/v1/ssh/sessions", "create", "POST请求应该是create"},
		{"PUT", "/api/v1/users/123", "update", "PUT请求应该是update"},
		{"DELETE", "/api/v1/assets/123", "delete", "DELETE请求应该是delete"},
		{"PATCH", "/api/v1/roles/123", "update", "PATCH请求应该是update"},
		{"GET", "/api/v1/users", "read", "GET请求应该是read"},
	}
	
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			result := auditService.determineAction(tc.method, tc.path)
			assert.Equal(t, tc.expected, result, tc.desc)
		})
	}
}


// TestExtractSessionIDFromContext 测试从上下文提取SessionID
func TestExtractSessionIDFromContext(t *testing.T) {
	auditService := &AuditService{}
	
	// 创建Gin测试上下文
	gin.SetMode(gin.TestMode)
	
	// 测试非session资源
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	result := auditService.extractSessionIDFromContext(c, "assets")
	assert.Equal(t, "", result, "非session资源应该返回空")
	
	// 测试session资源但无SessionID
	result = auditService.extractSessionIDFromContext(c, "session")
	assert.Equal(t, "", result, "无SessionID参数应该返回空")
}

// BenchmarkLogMiddleware 基准测试审计中间件性能
func BenchmarkLogMiddleware(b *testing.B) {
	db := setupTestDB()
	auditService := NewAuditService(db)
	
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(auditService.LogMiddleware())
	
	router.Use(func(c *gin.Context) {
		user := &models.User{ID: 1, Username: "benchuser"}
		c.Set("user", user)
		c.Next()
	})
	
	router.POST("/api/v1/ssh/sessions", func(c *gin.Context) {
		c.JSON(201, gin.H{"status": "ok"})
	})
	
	requestBody := `{"assetId": 123}`
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/api/v1/ssh/sessions", bytes.NewBufferString(requestBody))
		req.Header.Set("Content-Type", "application/json")
		
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}