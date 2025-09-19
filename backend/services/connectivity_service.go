package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"bastion/interfaces"
	"bastion/utils"
)

// ConnectivityService 连接统一服务 - 统一处理各种连接测试和凭证管理
type ConnectivityService struct {
	credUtils      *utils.CredentialUtils
	connUtils      *utils.ConnectionUtils
	assetProvider  interfaces.AssetProvider
	auditLogger    interfaces.AuditLogger
	permChecker    interfaces.PermissionChecker
}

// NewConnectivityService 创建新的连接服务实例
func NewConnectivityService() *ConnectivityService {
	return &ConnectivityService{
		credUtils: utils.DefaultCredentialUtils,
		connUtils: utils.DefaultConnectionUtils,
	}
}

// SetDependencies 设置服务依赖
func (cs *ConnectivityService) SetDependencies(
	assetProvider interfaces.AssetProvider,
	auditLogger interfaces.AuditLogger,
	permChecker interfaces.PermissionChecker,
) {
	cs.assetProvider = assetProvider
	cs.auditLogger = auditLogger
	cs.permChecker = permChecker
}

// TestConnection 统一连接测试入口
func (cs *ConnectivityService) TestConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	startTime := time.Now()
	
	result := &interfaces.ConnectionResult{
		Success:      false,
		ResponseTime: 0,
	}

	// 检查权限
	if cs.permChecker != nil {
		// 从上下文获取用户ID（假设已设置）
		if userID, ok := ctx.Value("user_id").(uint); ok {
			canAccess, err := cs.permChecker.CanAccessAsset(ctx, userID, asset.GetID())
			if err != nil {
				result.Error = fmt.Errorf("权限检查失败: %v", err)
				result.Message = "权限检查失败"
				return result, err
			}
			if !canAccess {
				result.Error = fmt.Errorf("用户无权访问该资产")
				result.Message = "无权限访问"
				return result, result.Error
			}
		}
	}

	// 验证资产和凭证
	if err := cs.validateAssetAndCredential(asset, credential); err != nil {
		result.Error = err
		result.Message = err.Error()
		return result, err
	}

	// 根据资产类型进行连接测试
	var err error
	switch strings.ToLower(asset.GetType()) {
	case interfaces.ConnTypeSSH:
		err = cs.testSSHConnection(asset, credential)
	case interfaces.ConnTypeRDP:
		err = cs.testRDPConnection(asset, credential)
	case interfaces.ConnTypeMySQL, interfaces.ConnTypePostgres:
		err = cs.testDatabaseConnection(asset, credential)
	case interfaces.ConnTypeTelnet:
		err = cs.testTelnetConnection(asset, credential)
	case interfaces.ConnTypeVNC:
		err = cs.testVNCConnection(asset, credential)
	default:
		// 默认进行TCP连接测试
		err = cs.testTCPConnection(asset)
	}

	// 设置测试结果
	result.ResponseTime = time.Since(startTime)
	if err != nil {
		result.Success = false
		result.Error = err
		result.Message = fmt.Sprintf("连接测试失败: %v", err)
		log.Printf("连接测试失败 - 资产ID: %d, 类型: %s, 错误: %v", 
			asset.GetID(), asset.GetType(), err)
	} else {
		result.Success = true
		result.Message = "连接测试成功"
		log.Printf("连接测试成功 - 资产ID: %d, 类型: %s, 耗时: %v", 
			asset.GetID(), asset.GetType(), result.ResponseTime)
	}

	// 记录审计日志
	if cs.auditLogger != nil {
		if userID, ok := ctx.Value("user_id").(uint); ok {
			cs.auditLogger.LogConnectionTest(ctx, userID, asset.GetID(), result)
		}
	}

	return result, nil
}

// TestTCPConnection 测试TCP连接
func (cs *ConnectivityService) TestTCPConnection(ctx context.Context, host string, port int) (*interfaces.ConnectionResult, error) {
	startTime := time.Now()
	
	result := &interfaces.ConnectionResult{
		Success:      false,
		ResponseTime: 0,
	}

	err := cs.connUtils.TestTCPConnection(host, port, utils.DefaultConnectTimeout)
	result.ResponseTime = time.Since(startTime)
	
	if err != nil {
		result.Error = err
		result.Message = fmt.Sprintf("TCP连接失败: %v", err)
	} else {
		result.Success = true
		result.Message = "TCP连接成功"
	}

	return result, nil
}

// TestSSHConnection 测试SSH连接
func (cs *ConnectivityService) TestSSHConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	config, err := cs.createSSHConfig(asset, credential)
	if err != nil {
		return &interfaces.ConnectionResult{
			Success: false,
			Error:   err,
			Message: fmt.Sprintf("创建SSH配置失败: %v", err),
		}, err
	}

	startTime := time.Now()
	err = cs.connUtils.TestSSHConnection(config)
	responseTime := time.Since(startTime)

	result := &interfaces.ConnectionResult{
		ResponseTime: responseTime,
	}

	if err != nil {
		result.Success = false
		result.Error = err
		result.Message = fmt.Sprintf("SSH连接失败: %v", err)
	} else {
		result.Success = true
		result.Message = "SSH连接成功"
	}

	return result, nil
}

// TestDatabaseConnection 测试数据库连接
func (cs *ConnectivityService) TestDatabaseConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	config, err := cs.createDatabaseConfig(asset, credential)
	if err != nil {
		return &interfaces.ConnectionResult{
			Success: false,
			Error:   err,
			Message: fmt.Sprintf("创建数据库配置失败: %v", err),
		}, err
	}

	startTime := time.Now()
	err = cs.connUtils.TestDatabaseConnection(config)
	responseTime := time.Since(startTime)

	result := &interfaces.ConnectionResult{
		ResponseTime: responseTime,
	}

	if err != nil {
		result.Success = false
		result.Error = err
		result.Message = fmt.Sprintf("数据库连接失败: %v", err)
	} else {
		result.Success = true
		result.Message = "数据库连接成功"
	}

	return result, nil
}

// TestRDPConnection 测试RDP连接
func (cs *ConnectivityService) TestRDPConnection(ctx context.Context, asset interfaces.Asset, credential interfaces.Credential) (*interfaces.ConnectionResult, error) {
	config := &utils.ConnectionConfig{
		Host:     asset.GetHost(),
		Port:     asset.GetPort(),
		Username: credential.GetUsername(),
		ConnType: utils.ConnTypeRDP,
		Timeout:  utils.DefaultConnectTimeout,
	}

	startTime := time.Now()
	err := cs.connUtils.TestRDPConnection(config)
	responseTime := time.Since(startTime)

	result := &interfaces.ConnectionResult{
		ResponseTime: responseTime,
	}

	if err != nil {
		result.Success = false
		result.Error = err
		result.Message = fmt.Sprintf("RDP连接失败: %v", err)
	} else {
		result.Success = true
		result.Message = "RDP连接成功"
	}

	return result, nil
}

// BatchTestConnections 批量测试连接
func (cs *ConnectivityService) BatchTestConnections(ctx context.Context, assets []interfaces.Asset) (map[uint]*interfaces.ConnectionResult, error) {
	results := make(map[uint]*interfaces.ConnectionResult)
	
	for _, asset := range assets {
		// 获取默认凭证
		var credential interfaces.Credential
		if cs.assetProvider != nil {
			defaultCred, err := cs.assetProvider.GetDefaultCredential(ctx, asset.GetID())
			if err != nil {
				results[asset.GetID()] = &interfaces.ConnectionResult{
					Success: false,
					Error:   err,
					Message: fmt.Sprintf("获取默认凭证失败: %v", err),
				}
				continue
			}
			credential = defaultCred
		}

		// 测试连接
		result, err := cs.TestConnection(ctx, asset, credential)
		if err != nil && result == nil {
			result = &interfaces.ConnectionResult{
				Success: false,
				Error:   err,
				Message: err.Error(),
			}
		}
		results[asset.GetID()] = result
	}

	return results, nil
}

// CreateSSHConfig 创建SSH连接配置（供外部服务使用）
func (cs *ConnectivityService) CreateSSHConfig(asset interfaces.Asset, credential interfaces.Credential) (*utils.ConnectionConfig, error) {
	return cs.createSSHConfig(asset, credential)
}

// GetCredentialForAsset 获取资产的可用凭证
func (cs *ConnectivityService) GetCredentialForAsset(ctx context.Context, assetID uint) (interfaces.Credential, error) {
	if cs.assetProvider == nil {
		return nil, fmt.Errorf("资产提供者未设置")
	}

	// 首先尝试获取默认凭证
	credential, err := cs.assetProvider.GetDefaultCredential(ctx, assetID)
	if err == nil {
		return credential, nil
	}

	// 如果没有默认凭证，获取第一个可用凭证
	credentials, err := cs.assetProvider.GetAssetCredentials(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("获取资产凭证失败: %v", err)
	}

	if len(credentials) == 0 {
		return nil, fmt.Errorf("资产没有可用凭证")
	}

	return credentials[0], nil
}

// ValidateCredentialAccess 验证凭证访问权限
func (cs *ConnectivityService) ValidateCredentialAccess(ctx context.Context, userID uint, credentialID uint) error {
	if cs.permChecker == nil {
		return nil // 如果没有权限检查器，默认允许
	}

	canAccess, err := cs.permChecker.CanAccessCredential(ctx, userID, credentialID)
	if err != nil {
		return fmt.Errorf("权限检查失败: %v", err)
	}

	if !canAccess {
		return fmt.Errorf("用户无权访问该凭证")
	}

	return nil
}

// 内部辅助方法

// validateAssetAndCredential 验证资产和凭证
func (cs *ConnectivityService) validateAssetAndCredential(asset interfaces.Asset, credential interfaces.Credential) error {
	if asset == nil {
		return fmt.Errorf("资产信息不能为空")
	}

	if credential == nil {
		return fmt.Errorf("凭证信息不能为空")
	}

	// 验证资产基本信息
	if asset.GetHost() == "" {
		return fmt.Errorf("资产主机地址不能为空")
	}

	if asset.GetPort() <= 0 || asset.GetPort() > 65535 {
		return fmt.Errorf("资产端口号无效: %d", asset.GetPort())
	}

	// 验证凭证信息
	if credential.GetUsername() == "" && asset.GetType() != interfaces.ConnTypeRDP {
		return fmt.Errorf("用户名不能为空")
	}

	if credential.GetPassword() == "" && credential.GetPrivateKey() == "" {
		return fmt.Errorf("密码和私钥不能同时为空")
	}

	return nil
}

// createSSHConfig 创建SSH连接配置
func (cs *ConnectivityService) createSSHConfig(asset interfaces.Asset, credential interfaces.Credential) (*utils.ConnectionConfig, error) {
	config := &utils.ConnectionConfig{
		Host:     asset.GetHost(),
		Port:     asset.GetPort(),
		Username: credential.GetUsername(),
		ConnType: utils.ConnTypeSSH,
		Timeout:  utils.DefaultConnectTimeout,
	}

	// 处理密码认证
	if credential.GetPassword() != "" {
		config.Password = credential.GetPassword()
	}

	// 处理私钥认证
	if credential.GetPrivateKey() != "" {
		config.PrivateKey = credential.GetPrivateKey()
	}

	return config, nil
}

// createDatabaseConfig 创建数据库连接配置
func (cs *ConnectivityService) createDatabaseConfig(asset interfaces.Asset, credential interfaces.Credential) (*utils.ConnectionConfig, error) {
	config := &utils.ConnectionConfig{
		Host:     asset.GetHost(),
		Port:     asset.GetPort(),
		Username: credential.GetUsername(),
		Password: credential.GetPassword(),
		ConnType: asset.GetType(),
		Timeout:  utils.DatabaseTestTimeout,
	}

	// 设置数据库名称（从资产标签中获取，或使用默认值）
	if tags := asset.GetTags(); tags != nil {
		if dbName, exists := tags["database"]; exists {
			config.Database = dbName
		} else {
			// 设置默认数据库名称
			switch asset.GetType() {
			case interfaces.ConnTypeMySQL:
				config.Database = "mysql"
			case interfaces.ConnTypePostgres:
				config.Database = "postgres"
			}
		}
	}

	return config, nil
}

// testSSHConnection 内部SSH连接测试
func (cs *ConnectivityService) testSSHConnection(asset interfaces.Asset, credential interfaces.Credential) error {
	config, err := cs.createSSHConfig(asset, credential)
	if err != nil {
		return err
	}
	return cs.connUtils.TestSSHConnection(config)
}

// testRDPConnection 内部RDP连接测试
func (cs *ConnectivityService) testRDPConnection(asset interfaces.Asset, credential interfaces.Credential) error {
	config := &utils.ConnectionConfig{
		Host:     asset.GetHost(),
		Port:     asset.GetPort(),
		Username: credential.GetUsername(),
		ConnType: utils.ConnTypeRDP,
		Timeout:  utils.DefaultConnectTimeout,
	}
	return cs.connUtils.TestRDPConnection(config)
}

// testDatabaseConnection 内部数据库连接测试
func (cs *ConnectivityService) testDatabaseConnection(asset interfaces.Asset, credential interfaces.Credential) error {
	config, err := cs.createDatabaseConfig(asset, credential)
	if err != nil {
		return err
	}
	return cs.connUtils.TestDatabaseConnection(config)
}

// testTelnetConnection 内部Telnet连接测试
func (cs *ConnectivityService) testTelnetConnection(asset interfaces.Asset, credential interfaces.Credential) error {
	// Telnet主要是TCP连接测试
	return cs.connUtils.TestTCPConnection(asset.GetHost(), asset.GetPort(), utils.DefaultConnectTimeout)
}

// testVNCConnection 内部VNC连接测试
func (cs *ConnectivityService) testVNCConnection(asset interfaces.Asset, credential interfaces.Credential) error {
	// VNC主要是TCP连接测试
	return cs.connUtils.TestTCPConnection(asset.GetHost(), asset.GetPort(), utils.DefaultConnectTimeout)
}

// testTCPConnection 内部TCP连接测试
func (cs *ConnectivityService) testTCPConnection(asset interfaces.Asset) error {
	return cs.connUtils.TestTCPConnection(asset.GetHost(), asset.GetPort(), utils.DefaultConnectTimeout)
}

// GetSupportedConnectionTypes 获取支持的连接类型
func (cs *ConnectivityService) GetSupportedConnectionTypes() []string {
	return []string{
		interfaces.ConnTypeSSH,
		interfaces.ConnTypeRDP,
		interfaces.ConnTypeMySQL,
		interfaces.ConnTypePostgres,
		interfaces.ConnTypeTelnet,
		interfaces.ConnTypeVNC,
	}
}

// GetConnectionTypeDefaultPort 获取连接类型的默认端口
func (cs *ConnectivityService) GetConnectionTypeDefaultPort(connType string) int {
	return cs.connUtils.GetDefaultPort(connType)
}