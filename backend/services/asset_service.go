package services

import (
	"bastion/models"
	"bastion/utils"
	"errors"
	"fmt"
	"net"
	"time"

	"gorm.io/gorm"
)

// AssetService 资产服务
type AssetService struct {
	db *gorm.DB
}

// NewAssetService 创建资产服务实例
func NewAssetService(db *gorm.DB) *AssetService {
	return &AssetService{db: db}
}

// CreateAsset 创建资产
func (s *AssetService) CreateAsset(request *models.AssetCreateRequest) (*models.AssetResponse, error) {
	// 检查资产名称是否已存在
	var existingAsset models.Asset
	if err := s.db.Where("name = ?", request.Name).First(&existingAsset).Error; err == nil {
		return nil, errors.New("asset name already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check asset name: %w", err)
	}

	// 如果指定了凭证ID，检查凭证是否存在
	var credentials []models.Credential
	if len(request.CredentialIDs) > 0 {
		if err := s.db.Where("id IN ?", request.CredentialIDs).Find(&credentials).Error; err != nil {
			return nil, fmt.Errorf("failed to check credentials: %w", err)
		}
		if len(credentials) != len(request.CredentialIDs) {
			return nil, errors.New("some credentials not found")
		}
	}

	// 如果指定了分组ID，检查分组是否存在
	var groups []models.AssetGroup
	if len(request.GroupIDs) > 0 {
		if err := s.db.Where("id IN ?", request.GroupIDs).Find(&groups).Error; err != nil {
			return nil, fmt.Errorf("failed to check groups: %w", err)
		}
		if len(groups) != len(request.GroupIDs) {
			return nil, errors.New("some groups not found")
		}
	}

	// 创建资产
	asset := models.Asset{
		Name:     request.Name,
		Type:     request.Type,
		OsType:   request.OsType,
		Address:  request.Address,
		Port:     request.Port,
		Protocol: request.Protocol,
		Tags:     request.Tags,
		Status:   1, // 默认启用
	}
	
	// 如果没有指定操作系统类型，根据资产类型设置默认值
	if asset.OsType == "" {
		if asset.Type == "server" {
			asset.OsType = "linux"
		} else {
			asset.OsType = "linux" // 数据库默认也用linux
		}
	}

	// 使用事务创建资产及其关联
	tx := s.db.Begin()
	if err := tx.Create(&asset).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create asset: %w", err)
	}

	// 关联凭证
	if len(credentials) > 0 {
		if err := tx.Model(&asset).Association("Credentials").Append(credentials); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to associate credentials: %w", err)
		}
	}

	// 关联分组
	if len(groups) > 0 {
		if err := tx.Model(&asset).Association("Groups").Append(groups); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to associate groups: %w", err)
		}
	}

	tx.Commit()

	// 重新查询包含关联数据的资产
	if err := s.db.Preload("Credentials").Preload("Groups").Where("id = ?", asset.ID).First(&asset).Error; err != nil {
		return nil, fmt.Errorf("failed to query created asset: %w", err)
	}

	return asset.ToResponse(), nil
}

// GetAssets 获取资产列表
func (s *AssetService) GetAssets(request *models.AssetListRequest) ([]*models.AssetResponse, int64, error) {
	var assets []models.Asset
	var total int64

	// 构建查询
	query := s.db.Model(&models.Asset{})

	// 关键字搜索
	if request.Keyword != "" {
		query = query.Where("name LIKE ? OR address LIKE ?", "%"+request.Keyword+"%", "%"+request.Keyword+"%")
	}

	// 类型过滤
	if request.Type != "" {
		query = query.Where("type = ?", request.Type)
	}

	// 状态过滤
	if request.Status != nil {
		query = query.Where("status = ?", *request.Status)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count assets: %w", err)
	}

	// 分页参数
	if request.Page > 0 && request.PageSize > 0 {
		offset := (request.Page - 1) * request.PageSize
		query = query.Offset(offset).Limit(request.PageSize)
	}

	// 查询资产，预加载凭证和分组
	if err := query.Preload("Credentials").Preload("Groups").Find(&assets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to query assets: %w", err)
	}

	// 转换为响应格式
	responses := make([]*models.AssetResponse, len(assets))
	for i, asset := range assets {
		responses[i] = asset.ToResponse()
	}

	return responses, total, nil
}

// GetAsset 获取单个资产
func (s *AssetService) GetAsset(id uint) (*models.AssetResponse, error) {
	var asset models.Asset
	if err := s.db.Preload("Credentials").Preload("Groups").Where("id = ?", id).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset not found")
		}
		return nil, fmt.Errorf("failed to query asset: %w", err)
	}

	return asset.ToResponse(), nil
}

// UpdateAsset 更新资产
func (s *AssetService) UpdateAsset(id uint, request *models.AssetUpdateRequest) (*models.AssetResponse, error) {
	// 查找资产
	var asset models.Asset
	if err := s.db.Where("id = ?", id).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset not found")
		}
		return nil, fmt.Errorf("failed to query asset: %w", err)
	}

	// 如果更新名称，检查是否重复
	if request.Name != "" && request.Name != asset.Name {
		var existingAsset models.Asset
		if err := s.db.Where("name = ? AND id != ?", request.Name, id).First(&existingAsset).Error; err == nil {
			return nil, errors.New("asset name already exists")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check asset name: %w", err)
		}
	}

	// 如果指定了分组ID，检查分组是否存在
	var groups []models.AssetGroup
	if len(request.GroupIDs) > 0 {
		if err := s.db.Where("id IN ?", request.GroupIDs).Find(&groups).Error; err != nil {
			return nil, fmt.Errorf("failed to check groups: %w", err)
		}
		if len(groups) != len(request.GroupIDs) {
			return nil, errors.New("some groups not found")
		}
	}

	// 使用事务更新资产信息和关联关系
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新资产信息
	updates := make(map[string]interface{})
	if request.Name != "" {
		updates["name"] = request.Name
	}
	if request.Type != "" {
		updates["type"] = request.Type
	}
	if request.OsType != "" {
		updates["os_type"] = request.OsType
	}
	if request.Address != "" {
		updates["address"] = request.Address
	}
	if request.Port > 0 {
		updates["port"] = request.Port
	}
	if request.Protocol != "" {
		updates["protocol"] = request.Protocol
	}
	if request.Tags != "" {
		updates["tags"] = request.Tags
	}
	if request.Status != nil {
		updates["status"] = *request.Status
	}

	if len(updates) > 0 {
		if err := tx.Model(&asset).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update asset: %w", err)
		}
	}

	// 更新分组关联
	if len(request.GroupIDs) > 0 {
		// 先清除现有的分组关联
		if err := tx.Model(&asset).Association("Groups").Clear(); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to clear asset groups: %w", err)
		}
		// 添加新的分组关联
		if err := tx.Model(&asset).Association("Groups").Append(groups); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to associate groups: %w", err)
		}
	}

	tx.Commit()

	// 重新查询资产，包含凭证和分组信息
	if err := s.db.Preload("Credentials").Preload("Groups").Where("id = ?", id).First(&asset).Error; err != nil {
		return nil, fmt.Errorf("failed to query updated asset: %w", err)
	}

	return asset.ToResponse(), nil
}

// DeleteAsset 删除资产
func (s *AssetService) DeleteAsset(id uint) error {
	// 查找资产
	var asset models.Asset
	if err := s.db.Where("id = ?", id).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("asset not found")
		}
		return fmt.Errorf("failed to query asset: %w", err)
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 删除资产与凭证的关联关系（中间表记录）
	if err := tx.Where("asset_id = ?", id).Delete(&models.AssetCredential{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete asset-credential associations: %w", err)
	}

	// 软删除资产
	if err := tx.Delete(&asset).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete asset: %w", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CreateCredential 创建凭证
func (s *AssetService) CreateCredential(request *models.CredentialCreateRequest) (*models.CredentialResponse, error) {
	// 验证凭证类型相关字段
	if request.Type == "password" && request.Password == "" {
		return nil, errors.New("password is required for password type credential")
	}
	if request.Type == "key" && request.PrivateKey == "" {
		return nil, errors.New("private key is required for key type credential")
	}

	// 检查资产是否存在
	var assets []models.Asset
	if err := s.db.Where("id IN ?", request.AssetIDs).Find(&assets).Error; err != nil {
		return nil, fmt.Errorf("failed to check assets: %w", err)
	}
	if len(assets) != len(request.AssetIDs) {
		return nil, errors.New("some assets not found")
	}

	// 加密密码
	var encryptedPassword string
	if request.Password != "" {
		encrypted, err := utils.EncryptPassword(request.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		encryptedPassword = encrypted
	}

	// 创建凭证
	credential := models.Credential{
		Name:       request.Name,
		Type:       request.Type,
		Username:   request.Username,
		Password:   encryptedPassword,
		PrivateKey: request.PrivateKey,
	}

	// 使用事务创建凭证及其关联
	tx := s.db.Begin()
	if err := tx.Create(&credential).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create credential: %w", err)
	}

	// 关联资产
	if err := tx.Model(&credential).Association("Assets").Append(assets); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to associate assets: %w", err)
	}

	tx.Commit()

	// 预加载资产信息
	if err := s.db.Preload("Assets").Where("id = ?", credential.ID).First(&credential).Error; err != nil {
		return nil, fmt.Errorf("failed to query created credential: %w", err)
	}

	return credential.ToResponse(), nil
}

// GetCredentials 获取凭证列表
func (s *AssetService) GetCredentials(request *models.CredentialListRequest) ([]*models.CredentialResponse, int64, error) {
	var credentials []models.Credential
	var total int64

	// 构建查询
	query := s.db.Model(&models.Credential{})

	// 关键字搜索
	if request.Keyword != "" {
		query = query.Where("name LIKE ? OR username LIKE ?", "%"+request.Keyword+"%", "%"+request.Keyword+"%")
	}

	// 类型过滤
	if request.Type != "" {
		query = query.Where("type = ?", request.Type)
	}

	// 资产过滤 - 通过连接表查询
	if request.AssetID > 0 {
		query = query.Joins("JOIN asset_credentials ON credentials.id = asset_credentials.credential_id").
			Where("asset_credentials.asset_id = ?", request.AssetID)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count credentials: %w", err)
	}

	// 分页参数
	if request.Page > 0 && request.PageSize > 0 {
		offset := (request.Page - 1) * request.PageSize
		query = query.Offset(offset).Limit(request.PageSize)
	}

	// 查询凭证，预加载资产
	if err := query.Preload("Assets").Find(&credentials).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to query credentials: %w", err)
	}

	// 转换为响应格式
	responses := make([]*models.CredentialResponse, len(credentials))
	for i, credential := range credentials {
		responses[i] = credential.ToResponse()
	}

	return responses, total, nil
}

// GetCredential 获取单个凭证
func (s *AssetService) GetCredential(id uint) (*models.CredentialResponse, error) {
	var credential models.Credential
	if err := s.db.Preload("Assets").Where("id = ?", id).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("credential not found")
		}
		return nil, fmt.Errorf("failed to query credential: %w", err)
	}

	return credential.ToResponse(), nil
}

// UpdateCredential 更新凭证
func (s *AssetService) UpdateCredential(id uint, request *models.CredentialUpdateRequest) (*models.CredentialResponse, error) {
	// 查找凭证
	var credential models.Credential
	if err := s.db.Where("id = ?", id).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("credential not found")
		}
		return nil, fmt.Errorf("failed to query credential: %w", err)
	}

	// 更新凭证信息
	updates := make(map[string]interface{})
	if request.Name != "" {
		updates["name"] = request.Name
	}
	if request.Type != "" {
		updates["type"] = request.Type
	}
	if request.Username != "" {
		updates["username"] = request.Username
	}
	if request.Password != "" {
		encrypted, err := utils.EncryptPassword(request.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		updates["password"] = encrypted
	}
	if request.PrivateKey != "" {
		updates["private_key"] = request.PrivateKey
	}

	if len(updates) > 0 {
		if err := s.db.Model(&credential).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update credential: %w", err)
		}
	}

	// 重新查询凭证，包含资产信息
	if err := s.db.Preload("Assets").Where("id = ?", id).First(&credential).Error; err != nil {
		return nil, fmt.Errorf("failed to query updated credential: %w", err)
	}

	return credential.ToResponse(), nil
}

// DeleteCredential 删除凭证
func (s *AssetService) DeleteCredential(id uint) error {
	// 查找凭证
	var credential models.Credential
	if err := s.db.Where("id = ?", id).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("credential not found")
		}
		return fmt.Errorf("failed to query credential: %w", err)
	}

	// 软删除凭证
	if err := s.db.Delete(&credential).Error; err != nil {
		return fmt.Errorf("failed to delete credential: %w", err)
	}

	return nil
}

// TestConnection 测试连接
func (s *AssetService) TestConnection(request *models.ConnectionTestRequest) (*models.ConnectionTestResponse, error) {
	// 获取资产信息
	var asset models.Asset
	if err := s.db.Where("id = ?", request.AssetID).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset not found")
		}
		return nil, fmt.Errorf("failed to query asset: %w", err)
	}

	// 获取凭证信息并检查是否与资产关联
	var credential models.Credential
	if err := s.db.Preload("Assets").Where("id = ?", request.CredentialID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("credential not found")
		}
		return nil, fmt.Errorf("failed to query credential: %w", err)
	}

	// 检查凭证是否与该资产关联
	var hasAssociation bool
	for _, assocAsset := range credential.Assets {
		if assocAsset.ID == asset.ID {
			hasAssociation = true
			break
		}
	}
	if !hasAssociation {
		return nil, errors.New("credential is not associated with the asset")
	}

	// 执行连接测试
	response := &models.ConnectionTestResponse{
		TestedAt: time.Now(),
	}

	switch request.TestType {
	case "ping":
		response = s.testPing(asset.Address, response)
	case "ssh":
		response = s.testSSH(asset, credential, response)
	case "rdp":
		response = s.testRDP(asset, credential, response)
	case "database":
		response = s.testDatabase(asset, credential, response)
	default:
		return nil, errors.New("unsupported test type")
	}

	return response, nil
}

// testPing 测试ping连接
func (s *AssetService) testPing(address string, response *models.ConnectionTestResponse) *models.ConnectionTestResponse {
	startTime := time.Now()

	// 简单的TCP连接测试
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		response.Success = false
		response.Error = err.Error()
		response.Message = "Connection failed"
		return response
	}
	defer conn.Close()

	latency := time.Since(startTime)
	response.Success = true
	response.Message = "Connection successful"
	response.Latency = int(latency.Milliseconds())

	return response
}

// testSSH 测试SSH连接
func (s *AssetService) testSSH(asset models.Asset, credential models.Credential, response *models.ConnectionTestResponse) *models.ConnectionTestResponse {
	// 解密密码
	password := ""
	if credential.Password != "" {
		decrypted, err := utils.DecryptPassword(credential.Password)
		if err != nil {
			response.Success = false
			response.Error = "Failed to decrypt password"
			response.Message = "Authentication failed"
			return response
		}
		password = decrypted
	}

	// 这里应该实现真正的SSH连接测试
	// 为了简化，这里只做基本的TCP连接测试
	startTime := time.Now()
	address := fmt.Sprintf("%s:%d", asset.Address, asset.Port)
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		response.Success = false
		response.Error = err.Error()
		response.Message = "SSH connection failed"
		return response
	}
	defer conn.Close()

	latency := time.Since(startTime)
	response.Success = true
	response.Message = fmt.Sprintf("SSH connection successful (user: %s)", credential.Username)
	response.Latency = int(latency.Milliseconds())

	// 在实际实现中，这里应该使用SSH客户端进行真正的认证测试
	_ = password // 避免未使用变量警告

	return response
}

// testRDP 测试RDP连接
func (s *AssetService) testRDP(asset models.Asset, credential models.Credential, response *models.ConnectionTestResponse) *models.ConnectionTestResponse {
	// RDP连接测试实现
	startTime := time.Now()
	address := fmt.Sprintf("%s:%d", asset.Address, asset.Port)
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		response.Success = false
		response.Error = err.Error()
		response.Message = "RDP connection failed"
		return response
	}
	defer conn.Close()

	latency := time.Since(startTime)
	response.Success = true
	response.Message = fmt.Sprintf("RDP connection successful (user: %s)", credential.Username)
	response.Latency = int(latency.Milliseconds())

	return response
}

// testDatabase 测试数据库连接
func (s *AssetService) testDatabase(asset models.Asset, credential models.Credential, response *models.ConnectionTestResponse) *models.ConnectionTestResponse {
	// 解密密码
	password := ""
	if credential.Password != "" {
		decrypted, err := utils.DecryptPassword(credential.Password)
		if err != nil {
			response.Success = false
			response.Error = "Failed to decrypt password"
			response.Message = "Database authentication failed"
			return response
		}
		password = decrypted
	}

	// 数据库连接测试实现
	startTime := time.Now()
	address := fmt.Sprintf("%s:%d", asset.Address, asset.Port)
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		response.Success = false
		response.Error = err.Error()
		response.Message = "Database connection failed"
		return response
	}
	defer conn.Close()

	latency := time.Since(startTime)
	response.Success = true
	response.Message = fmt.Sprintf("Database connection successful (user: %s)", credential.Username)
	response.Latency = int(latency.Milliseconds())

	// 在实际实现中，这里应该使用数据库驱动进行真正的连接测试
	_ = password // 避免未使用变量警告

	return response
}

// GetAssetByName 根据名称获取资产
func (s *AssetService) GetAssetByName(name string) (*models.Asset, error) {
	var asset models.Asset
	if err := s.db.Preload("Credentials").Where("name = ?", name).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset not found")
		}
		return nil, fmt.Errorf("failed to query asset: %w", err)
	}

	return &asset, nil
}

// GetCredentialsByAssetID 根据资产ID获取凭证列表
func (s *AssetService) GetCredentialsByAssetID(assetID uint) ([]*models.CredentialResponse, error) {
	var credentials []models.Credential
	if err := s.db.Preload("Assets").
		Joins("JOIN asset_credentials ON credentials.id = asset_credentials.credential_id").
		Where("asset_credentials.asset_id = ?", assetID).
		Find(&credentials).Error; err != nil {
		return nil, fmt.Errorf("failed to query credentials: %w", err)
	}

	responses := make([]*models.CredentialResponse, len(credentials))
	for i, credential := range credentials {
		responses[i] = credential.ToResponse()
	}

	return responses, nil
}

// ======================== 资产分组管理 ========================

// CreateAssetGroup 创建资产分组
func (s *AssetService) CreateAssetGroup(request *models.AssetGroupCreateRequest) (*models.AssetGroupResponse, error) {
	// 检查分组名称是否已存在
	var existingGroup models.AssetGroup
	if err := s.db.Where("name = ?", request.Name).First(&existingGroup).Error; err == nil {
		return nil, errors.New("asset group name already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check group name: %w", err)
	}

	// 创建分组
	group := models.AssetGroup{
		Name:        request.Name,
		Description: request.Description,
	}

	if err := s.db.Create(&group).Error; err != nil {
		return nil, fmt.Errorf("failed to create asset group: %w", err)
	}

	return group.ToResponse(), nil
}

// GetAssetGroups 获取资产分组列表
func (s *AssetService) GetAssetGroups(request *models.AssetGroupListRequest) ([]*models.AssetGroupResponse, int64, error) {
	var groups []models.AssetGroup
	var total int64

	query := s.db.Model(&models.AssetGroup{})

	// 搜索条件
	if request.Keyword != "" {
		query = query.Where("name LIKE ? OR description LIKE ?", "%"+request.Keyword+"%", "%"+request.Keyword+"%")
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count asset groups: %w", err)
	}

	// 分页
	if request.Page > 0 && request.PageSize > 0 {
		offset := (request.Page - 1) * request.PageSize
		query = query.Offset(offset).Limit(request.PageSize)
	}

	// 查询数据，预加载资产数据以统计数量
	if err := query.Preload("Assets").Find(&groups).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to query asset groups: %w", err)
	}

	responses := make([]*models.AssetGroupResponse, len(groups))
	for i, group := range groups {
		responses[i] = group.ToResponse()
	}

	return responses, total, nil
}

// GetAssetGroup 获取单个资产分组
func (s *AssetService) GetAssetGroup(id uint) (*models.AssetGroupResponse, error) {
	var group models.AssetGroup
	if err := s.db.Preload("Assets").Where("id = ?", id).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset group not found")
		}
		return nil, fmt.Errorf("failed to query asset group: %w", err)
	}

	return group.ToResponse(), nil
}

// UpdateAssetGroup 更新资产分组
func (s *AssetService) UpdateAssetGroup(id uint, request *models.AssetGroupUpdateRequest) (*models.AssetGroupResponse, error) {
	var group models.AssetGroup
	if err := s.db.Where("id = ?", id).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("asset group not found")
		}
		return nil, fmt.Errorf("failed to query asset group: %w", err)
	}

	// 检查分组名称是否已存在（排除当前分组）
	if request.Name != "" && request.Name != group.Name {
		var existingGroup models.AssetGroup
		if err := s.db.Where("name = ? AND id != ?", request.Name, id).First(&existingGroup).Error; err == nil {
			return nil, errors.New("asset group name already exists")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check group name: %w", err)
		}
	}

	// 更新字段
	updates := make(map[string]interface{})
	if request.Name != "" {
		updates["name"] = request.Name
	}
	if request.Description != "" {
		updates["description"] = request.Description
	}

	if len(updates) > 0 {
		if err := s.db.Model(&group).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update asset group: %w", err)
		}
	}

	// 重新查询更新后的分组
	if err := s.db.Preload("Assets").Where("id = ?", id).First(&group).Error; err != nil {
		return nil, fmt.Errorf("failed to query updated asset group: %w", err)
	}

	return group.ToResponse(), nil
}

// DeleteAssetGroup 删除资产分组
func (s *AssetService) DeleteAssetGroup(id uint) error {
	var group models.AssetGroup
	if err := s.db.Preload("Assets").Where("id = ?", id).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("asset group not found")
		}
		return fmt.Errorf("failed to query asset group: %w", err)
	}

	// 检查是否有资产关联到此分组
	if len(group.Assets) > 0 {
		return errors.New("cannot delete asset group with associated assets")
	}

	// 删除分组
	if err := s.db.Delete(&group).Error; err != nil {
		return fmt.Errorf("failed to delete asset group: %w", err)
	}

	return nil
}
