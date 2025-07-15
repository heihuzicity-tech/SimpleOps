package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"bastion/interfaces"
	"bastion/models"
	"gorm.io/gorm"
)

// ServiceRegistry 服务注册表实现 - 管理所有服务实例和依赖注入
type ServiceRegistry struct {
	mu                   sync.RWMutex
	assetProvider        interfaces.AssetProvider
	sessionManager       interfaces.SessionManager
	connectionTester     interfaces.ConnectionTester
	auditLogger          interfaces.AuditLogger
	permissionChecker    interfaces.PermissionChecker
	notificationSender   interfaces.NotificationSender
	backgroundTaskManager interfaces.BackgroundTaskManager
	
	// 服务状态
	serviceStatus map[string]bool
	initialized   bool
}

// NewServiceRegistry 创建新的服务注册表
func NewServiceRegistry() *ServiceRegistry {
	return &ServiceRegistry{
		serviceStatus: make(map[string]bool),
		initialized:   false,
	}
}

// RegisterAssetProvider 注册资产提供者
func (sr *ServiceRegistry) RegisterAssetProvider(provider interfaces.AssetProvider) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.assetProvider = provider
	sr.serviceStatus["AssetProvider"] = true
	log.Println("AssetProvider服务已注册")
}

// RegisterSessionManager 注册会话管理器
func (sr *ServiceRegistry) RegisterSessionManager(manager interfaces.SessionManager) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.sessionManager = manager
	sr.serviceStatus["SessionManager"] = true
	log.Println("SessionManager服务已注册")
}

// RegisterConnectionTester 注册连接测试器
func (sr *ServiceRegistry) RegisterConnectionTester(tester interfaces.ConnectionTester) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.connectionTester = tester
	sr.serviceStatus["ConnectionTester"] = true
	log.Println("ConnectionTester服务已注册")
}

// RegisterAuditLogger 注册审计日志器
func (sr *ServiceRegistry) RegisterAuditLogger(logger interfaces.AuditLogger) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.auditLogger = logger
	sr.serviceStatus["AuditLogger"] = true
	log.Println("AuditLogger服务已注册")
}

// RegisterPermissionChecker 注册权限检查器
func (sr *ServiceRegistry) RegisterPermissionChecker(checker interfaces.PermissionChecker) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.permissionChecker = checker
	sr.serviceStatus["PermissionChecker"] = true
	log.Println("PermissionChecker服务已注册")
}

// RegisterNotificationSender 注册通知发送器
func (sr *ServiceRegistry) RegisterNotificationSender(sender interfaces.NotificationSender) {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	sr.notificationSender = sender
	sr.serviceStatus["NotificationSender"] = true
	log.Println("NotificationSender服务已注册")
}

// GetAssetProvider 获取资产提供者
func (sr *ServiceRegistry) GetAssetProvider() interfaces.AssetProvider {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.assetProvider
}

// GetSessionManager 获取会话管理器
func (sr *ServiceRegistry) GetSessionManager() interfaces.SessionManager {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.sessionManager
}

// GetConnectionTester 获取连接测试器
func (sr *ServiceRegistry) GetConnectionTester() interfaces.ConnectionTester {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.connectionTester
}

// GetAuditLogger 获取审计日志器
func (sr *ServiceRegistry) GetAuditLogger() interfaces.AuditLogger {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.auditLogger
}

// GetPermissionChecker 获取权限检查器
func (sr *ServiceRegistry) GetPermissionChecker() interfaces.PermissionChecker {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.permissionChecker
}

// GetNotificationSender 获取通知发送器
func (sr *ServiceRegistry) GetNotificationSender() interfaces.NotificationSender {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.notificationSender
}

// HealthCheck 服务健康检查
func (sr *ServiceRegistry) HealthCheck(ctx context.Context) (map[string]bool, error) {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	
	health := make(map[string]bool)
	
	// 检查各个服务的可用性
	health["AssetProvider"] = sr.assetProvider != nil
	health["SessionManager"] = sr.sessionManager != nil
	health["ConnectionTester"] = sr.connectionTester != nil
	health["AuditLogger"] = sr.auditLogger != nil
	health["PermissionChecker"] = sr.permissionChecker != nil
	health["NotificationSender"] = sr.notificationSender != nil
	
	return health, nil
}

// GetServiceStatus 获取服务状态
func (sr *ServiceRegistry) GetServiceStatus(ctx context.Context) (map[string]interface{}, error) {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	
	status := make(map[string]interface{})
	status["registered_services"] = sr.serviceStatus
	status["initialized"] = sr.initialized
	status["health"] = sr.serviceStatus
	
	return status, nil
}

// Initialize 初始化服务注册表
func (sr *ServiceRegistry) Initialize() error {
	sr.mu.Lock()
	defer sr.mu.Unlock()
	
	if sr.initialized {
		return nil
	}
	
	// 检查必需的服务是否已注册
	required := []string{"AssetProvider", "SessionManager", "ConnectionTester"}
	for _, service := range required {
		if !sr.serviceStatus[service] {
			return fmt.Errorf("必需的服务未注册: %s", service)
		}
	}
	
	sr.initialized = true
	log.Println("ServiceRegistry初始化完成")
	return nil
}

// AssetServiceAdapter 资产服务适配器 - 将现有AssetService适配为AssetProvider接口
type AssetServiceAdapter struct {
	assetService *AssetService
	db           *gorm.DB
}

// NewAssetServiceAdapter 创建资产服务适配器
func NewAssetServiceAdapter(assetService *AssetService, db *gorm.DB) *AssetServiceAdapter {
	return &AssetServiceAdapter{
		assetService: assetService,
		db:           db,
	}
}

// GetAssetByID 根据ID获取资产
func (asa *AssetServiceAdapter) GetAssetByID(ctx context.Context, id uint) (interfaces.Asset, error) {
	var asset models.Asset
	err := asa.db.First(&asset, id).Error
	if err != nil {
		return nil, err
	}
	return &AssetWrapper{&asset}, nil
}

// GetAssetsByGroup 根据分组获取资产
func (asa *AssetServiceAdapter) GetAssetsByGroup(ctx context.Context, groupID uint) ([]interfaces.Asset, error) {
	var assets []models.Asset
	err := asa.db.Where("group_id = ?", groupID).Find(&assets).Error
	if err != nil {
		return nil, err
	}
	
	var result []interfaces.Asset
	for i := range assets {
		result = append(result, &AssetWrapper{&assets[i]})
	}
	return result, nil
}

// GetAssetsByQuery 根据查询条件获取资产
func (asa *AssetServiceAdapter) GetAssetsByQuery(ctx context.Context, query *interfaces.AssetQuery) ([]interfaces.Asset, int64, error) {
	db := asa.db.Model(&models.Asset{})
	
	// 添加查询条件
	if query.GroupID != nil {
		db = db.Where("group_id = ?", *query.GroupID)
	}
	if query.Type != "" {
		db = db.Where("type = ?", query.Type)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.SearchKey != "" {
		db = db.Where("name LIKE ? OR address LIKE ?", 
			"%"+query.SearchKey+"%", "%"+query.SearchKey+"%")
	}
	
	// 获取总数
	var total int64
	db.Count(&total)
	
	// 分页和排序
	if query.Page > 0 && query.PageSize > 0 {
		offset := (query.Page - 1) * query.PageSize
		db = db.Offset(offset).Limit(query.PageSize)
	}
	
	if query.SortBy != "" {
		order := query.SortBy
		if query.SortOrder == "desc" {
			order += " DESC"
		}
		db = db.Order(order)
	}
	
	var assets []models.Asset
	err := db.Find(&assets).Error
	if err != nil {
		return nil, 0, err
	}
	
	var result []interfaces.Asset
	for i := range assets {
		result = append(result, &AssetWrapper{&assets[i]})
	}
	
	return result, total, nil
}

// CreateAsset 创建资产
func (asa *AssetServiceAdapter) CreateAsset(ctx context.Context, asset interfaces.Asset) (interfaces.Asset, error) {
	// 调用原有的AssetService方法
	status := 1
	if asset.GetStatus() == "inactive" {
		status = 0
	}
	
	assetModel := &models.Asset{
		Name:     asset.GetName(),
		Address:  asset.GetHost(),
		Port:     asset.GetPort(),
		Protocol: asset.GetType(),
		Status:   status,
	}
	
	err := asa.db.Create(assetModel).Error
	if err != nil {
		return nil, err
	}
	
	return &AssetWrapper{assetModel}, nil
}

// UpdateAsset 更新资产
func (asa *AssetServiceAdapter) UpdateAsset(ctx context.Context, asset interfaces.Asset) error {
	status := 1
	if asset.GetStatus() == "inactive" {
		status = 0
	}
	
	updates := map[string]interface{}{
		"name":     asset.GetName(),
		"address":  asset.GetHost(),
		"port":     asset.GetPort(),
		"protocol": asset.GetType(),
		"status":   status,
	}
	
	return asa.db.Model(&models.Asset{}).Where("id = ?", asset.GetID()).Updates(updates).Error
}

// DeleteAsset 删除资产
func (asa *AssetServiceAdapter) DeleteAsset(ctx context.Context, id uint) error {
	return asa.db.Delete(&models.Asset{}, id).Error
}

// GetAssetCredentials 获取资产凭证
func (asa *AssetServiceAdapter) GetAssetCredentials(ctx context.Context, assetID uint) ([]interfaces.Credential, error) {
	var asset models.Asset
	err := asa.db.Preload("Credentials").Where("id = ?", assetID).First(&asset).Error
	if err != nil {
		return nil, err
	}
	
	var result []interfaces.Credential
	for i := range asset.Credentials {
		result = append(result, &CredentialWrapper{&asset.Credentials[i]})
	}
	return result, nil
}

// GetCredentialByID 根据ID获取凭证
func (asa *AssetServiceAdapter) GetCredentialByID(ctx context.Context, id uint) (interfaces.Credential, error) {
	var credential models.Credential
	err := asa.db.First(&credential, id).Error
	if err != nil {
		return nil, err
	}
	return &CredentialWrapper{&credential}, nil
}

// GetDefaultCredential 获取默认凭证
func (asa *AssetServiceAdapter) GetDefaultCredential(ctx context.Context, assetID uint) (interfaces.Credential, error) {
	// 由于使用多对多关系，我们需要通过关联表查询
	credentials, err := asa.GetAssetCredentials(ctx, assetID)
	if err != nil {
		return nil, err
	}
	
	if len(credentials) == 0 {
		return nil, fmt.Errorf("资产没有关联的凭证")
	}
	
	// 返回第一个凭证作为默认凭证
	return credentials[0], nil
}

// GetAssetGroups 获取资产分组
func (asa *AssetServiceAdapter) GetAssetGroups(ctx context.Context) ([]interface{}, error) {
	var groups []models.AssetGroup
	err := asa.db.Find(&groups).Error
	if err != nil {
		return nil, err
	}
	
	var result []interface{}
	for _, group := range groups {
		result = append(result, group)
	}
	return result, nil
}

// GetAssetsByType 根据类型获取资产
func (asa *AssetServiceAdapter) GetAssetsByType(ctx context.Context, assetType string) ([]interfaces.Asset, error) {
	var assets []models.Asset
	err := asa.db.Where("type = ?", assetType).Find(&assets).Error
	if err != nil {
		return nil, err
	}
	
	var result []interfaces.Asset
	for i := range assets {
		result = append(result, &AssetWrapper{&assets[i]})
	}
	return result, nil
}

// UpdateAssetStatus 更新资产状态
func (asa *AssetServiceAdapter) UpdateAssetStatus(ctx context.Context, assetID uint, status string) error {
	return asa.db.Model(&models.Asset{}).Where("id = ?", assetID).Update("status", status).Error
}

// BatchUpdateAssetStatus 批量更新资产状态
func (asa *AssetServiceAdapter) BatchUpdateAssetStatus(ctx context.Context, assetIDs []uint, status string) error {
	return asa.db.Model(&models.Asset{}).Where("id IN ?", assetIDs).Update("status", status).Error
}

// AssetWrapper 资产包装器 - 让models.Asset实现interfaces.Asset接口
type AssetWrapper struct {
	*models.Asset
}

func (aw *AssetWrapper) GetID() uint                 { return aw.Asset.ID }
func (aw *AssetWrapper) GetName() string             { return aw.Asset.Name }
func (aw *AssetWrapper) GetHost() string             { return aw.Asset.Address }
func (aw *AssetWrapper) GetPort() int                { return aw.Asset.Port }
func (aw *AssetWrapper) GetType() string             { return aw.Asset.Protocol }
func (aw *AssetWrapper) GetGroupID() uint            { 
	if aw.Asset.GroupID != nil {
		return *aw.Asset.GroupID
	}
	return 0
}
func (aw *AssetWrapper) GetStatus() string           { 
	if aw.Asset.Status == 1 {
		return "active"
	}
	return "inactive"
}
func (aw *AssetWrapper) GetTags() map[string]string {
	// 解析JSON标签或返回空map
	if aw.Asset.Tags == "" {
		return make(map[string]string)
	}
	// 这里应该解析JSON，简化实现
	return make(map[string]string)
}

// CredentialWrapper 凭证包装器 - 让models.Credential实现interfaces.Credential接口
type CredentialWrapper struct {
	*models.Credential
}

func (cw *CredentialWrapper) GetID() uint          { return cw.Credential.ID }
func (cw *CredentialWrapper) GetType() string      { return cw.Credential.Type }
func (cw *CredentialWrapper) GetUsername() string  { return cw.Credential.Username }
func (cw *CredentialWrapper) GetPassword() string  { return cw.Credential.Password }
func (cw *CredentialWrapper) GetPrivateKey() string { return cw.Credential.PrivateKey }
func (cw *CredentialWrapper) GetAssetID() uint     { 
	if len(cw.Credential.Assets) > 0 {
		return cw.Credential.Assets[0].ID
	}
	return 0
}

// ConnectionTesterAdapter 连接测试器适配器
type ConnectionTesterAdapter struct {
	connectivityService *ConnectivityService
}

// NewConnectionTesterAdapter 创建连接测试器适配器
func NewConnectionTesterAdapter(connectivityService *ConnectivityService) *ConnectionTesterAdapter {
	return &ConnectionTesterAdapter{
		connectivityService: connectivityService,
	}
}

// TestConnection 测试连接
func (cta *ConnectionTesterAdapter) TestConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	return cta.connectivityService.TestConnection(ctx, asset, credential)
}

// TestTCPConnection 测试TCP连接
func (cta *ConnectionTesterAdapter) TestTCPConnection(ctx context.Context, host string, port int) (*interfaces.ConnectionResult, error) {
	return cta.connectivityService.TestTCPConnection(ctx, host, port)
}

// TestSSHConnection 测试SSH连接
func (cta *ConnectionTesterAdapter) TestSSHConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	return cta.connectivityService.TestSSHConnection(ctx, asset, credential)
}

// TestDatabaseConnection 测试数据库连接
func (cta *ConnectionTesterAdapter) TestDatabaseConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	return cta.connectivityService.TestDatabaseConnection(ctx, asset, credential)
}

// TestRDPConnection 测试RDP连接
func (cta *ConnectionTesterAdapter) TestRDPConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	return cta.connectivityService.TestRDPConnection(ctx, asset, credential)
}

// BatchTestConnections 批量测试连接
func (cta *ConnectionTesterAdapter) BatchTestConnections(ctx context.Context, assets []interfaces.Asset) (map[uint]*interfaces.ConnectionResult, error) {
	return cta.connectivityService.BatchTestConnections(ctx, assets)
}

// TestAssetConnectivity 测试资产连通性
func (cta *ConnectionTesterAdapter) TestAssetConnectivity(ctx context.Context, assetID uint) (*interfaces.ConnectionResult, error) {
	// 这里需要实现，获取资产和默认凭证然后测试
	return &interfaces.ConnectionResult{
		Success: false,
		Message: "功能待实现",
	}, fmt.Errorf("功能待实现")
}

// HealthCheck 健康检查
func (cta *ConnectionTesterAdapter) HealthCheck(ctx context.Context, asset interfaces.Asset) (*interfaces.ConnectionResult, error) {
	// 简单的TCP连接测试作为健康检查
	return cta.connectivityService.TestTCPConnection(ctx, asset.GetHost(), asset.GetPort())
}

// GetConnectionStats 获取连接统计
func (cta *ConnectionTesterAdapter) GetConnectionStats(ctx context.Context, assetID uint, duration time.Duration) (interface{}, error) {
	// 返回简单的统计信息
	return map[string]interface{}{
		"asset_id": assetID,
		"duration": duration.String(),
		"message":  "统计功能待实现",
	}, nil
}

// SessionManagerAdapter 会话管理器适配器
type SessionManagerAdapter struct {
	unifiedSessionService *UnifiedSessionService
}

// NewSessionManagerAdapter 创建会话管理器适配器
func NewSessionManagerAdapter(unifiedSessionService *UnifiedSessionService) *SessionManagerAdapter {
	return &SessionManagerAdapter{
		unifiedSessionService: unifiedSessionService,
	}
}

// CreateSession 创建会话
func (sma *SessionManagerAdapter) CreateSession(ctx context.Context, session interfaces.SessionInfo) (string, error) {
	return sma.unifiedSessionService.CreateSession(ctx, session)
}

// GetSession 获取会话
func (sma *SessionManagerAdapter) GetSession(ctx context.Context, sessionID string) (interfaces.SessionInfo, error) {
	return sma.unifiedSessionService.GetSession(ctx, sessionID)
}

// GetActiveSessions 获取活跃会话
func (sma *SessionManagerAdapter) GetActiveSessions(ctx context.Context, userID uint) ([]interfaces.SessionInfo, error) {
	return sma.unifiedSessionService.GetActiveSessions(ctx, userID)
}

// GetSessionsByQuery 查询会话
func (sma *SessionManagerAdapter) GetSessionsByQuery(ctx context.Context, query *interfaces.SessionQuery) ([]interfaces.SessionInfo, int64, error) {
	return sma.unifiedSessionService.GetSessionsByQuery(ctx, query)
}

// UpdateSessionActivity 更新会话活动
func (sma *SessionManagerAdapter) UpdateSessionActivity(ctx context.Context, sessionID string) error {
	return sma.unifiedSessionService.UpdateSessionActivity(ctx, sessionID)
}

// CloseSession 关闭会话
func (sma *SessionManagerAdapter) CloseSession(ctx context.Context, sessionID string) error {
	return sma.unifiedSessionService.CloseSession(ctx, sessionID)
}

// CloseUserSessions 关闭用户会话
func (sma *SessionManagerAdapter) CloseUserSessions(ctx context.Context, userID uint) error {
	return sma.unifiedSessionService.CloseUserSessions(ctx, userID)
}

// CloseAssetSessions 关闭资产会话
func (sma *SessionManagerAdapter) CloseAssetSessions(ctx context.Context, assetID uint) error {
	return sma.unifiedSessionService.CloseAssetSessions(ctx, assetID)
}

// GetSessionCount 获取会话数量
func (sma *SessionManagerAdapter) GetSessionCount(ctx context.Context, userID *uint) (int64, error) {
	return sma.unifiedSessionService.GetSessionCount(ctx, userID)
}

// MarkSessionActive 标记会话活跃
func (sma *SessionManagerAdapter) MarkSessionActive(ctx context.Context, sessionID string) error {
	return sma.unifiedSessionService.MarkSessionActive(ctx, sessionID)
}

// MarkSessionInactive 标记会话非活跃
func (sma *SessionManagerAdapter) MarkSessionInactive(ctx context.Context, sessionID string) error {
	return sma.unifiedSessionService.MarkSessionInactive(ctx, sessionID)
}

// GetInactiveSessions 获取非活跃会话
func (sma *SessionManagerAdapter) GetInactiveSessions(ctx context.Context, timeout time.Duration) ([]interfaces.SessionInfo, error) {
	return sma.unifiedSessionService.GetInactiveSessions(ctx, timeout)
}

// CleanupExpiredSessions 清理过期会话
func (sma *SessionManagerAdapter) CleanupExpiredSessions(ctx context.Context) error {
	return sma.unifiedSessionService.CleanupExpiredSessions(ctx)
}

// ForceCloseSession 强制关闭会话
func (sma *SessionManagerAdapter) ForceCloseSession(ctx context.Context, sessionID string, reason string) error {
	return sma.unifiedSessionService.ForceCloseSession(ctx, sessionID, reason)
}

// 全局服务注册表实例
var GlobalServiceRegistry = NewServiceRegistry()

// InitializeServices 初始化所有服务
func InitializeServices(assetService *AssetService, db *gorm.DB, redisClient interface{}) error {
	// 创建适配器
	assetAdapter := NewAssetServiceAdapter(assetService, db)
	connectivityService := NewConnectivityService()
	connectionTesterAdapter := NewConnectionTesterAdapter(connectivityService)
	
	// 注册服务
	GlobalServiceRegistry.RegisterAssetProvider(assetAdapter)
	GlobalServiceRegistry.RegisterConnectionTester(connectionTesterAdapter)
	
	// 如果有Redis客户端，创建会话管理器
	if redisClient != nil {
		// 这里需要类型断言或其他方式处理Redis客户端
		log.Println("会话管理器初始化需要Redis客户端配置")
	}
	
	// 初始化注册表
	return GlobalServiceRegistry.Initialize()
}