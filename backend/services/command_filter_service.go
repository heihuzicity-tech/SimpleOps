package services

import (
	"bastion/models"
	"bastion/utils"
	"errors"
	"fmt"
	"strings"
	"gorm.io/gorm"
)

// CommandFilterService 命令过滤服务
type CommandFilterService struct {
	db *gorm.DB
	matcherService *CommandMatcherService // 用于缓存失效通知
}

// NewCommandFilterService 创建命令过滤服务实例
func NewCommandFilterService(db *gorm.DB) *CommandFilterService {
	return &CommandFilterService{db: db}
}

// SetMatcherService 设置匹配服务（用于缓存失效通知）
func (s *CommandFilterService) SetMatcherService(matcherService *CommandMatcherService) {
	s.matcherService = matcherService
}

// List 获取过滤规则列表
func (s *CommandFilterService) List(req *models.CommandFilterListRequest) (*models.PageResponse, error) {
	var total int64
	var filters []models.CommandFilter
	
	query := s.db.Model(&models.CommandFilter{})
	
	// 搜索条件
	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Enabled != nil {
		query = query.Where("enabled = ?", *req.Enabled)
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	
	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count command filters failed: %w", err)
	}
	
	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Preload("CommandGroup").
		Order("priority ASC, created_at DESC").
		Find(&filters).Error; err != nil {
		return nil, fmt.Errorf("query command filters failed: %w", err)
	}
	
	// 构建响应
	responses := make([]models.CommandFilterResponse, len(filters))
	for i, filter := range filters {
		responses[i] = s.buildFilterResponse(&filter, false)
	}
	
	return &models.PageResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     responses,
	}, nil
}

// Get 获取过滤规则详情
func (s *CommandFilterService) Get(id uint) (*models.CommandFilterResponse, error) {
	var filter models.CommandFilter
	
	// 查询过滤规则及其关联数据
	if err := s.db.Preload("CommandGroup").
		Preload("Users").
		Preload("Assets").
		Preload("Attributes").
		First(&filter, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrNotFound
		}
		return nil, fmt.Errorf("get command filter failed: %w", err)
	}
	
	response := s.buildFilterResponse(&filter, true)
	return &response, nil
}

// Create 创建过滤规则
func (s *CommandFilterService) Create(req *models.CommandFilterCreateRequest) (*models.CommandFilterResponse, error) {
	// 验证命令组是否存在
	var groupExists bool
	if err := s.db.Model(&models.CommandGroup{}).
		Select("1").
		Where("id = ?", req.CommandGroupID).
		Find(&groupExists).Error; err != nil {
		return nil, fmt.Errorf("check command group failed: %w", err)
	}
	if !groupExists {
		return nil, utils.ErrInvalidParam
	}
	
	// 验证优先级范围
	if req.Priority < 1 || req.Priority > 100 {
		return nil, utils.ErrInvalidParam
	}
	
	// 创建过滤规则
	filter := &models.CommandFilter{
		Name:           req.Name,
		Priority:       req.Priority,
		Enabled:        req.Enabled,
		UserType:       req.UserType,
		AssetType:      req.AssetType,
		AccountType:    req.AccountType,
		AccountNames:   req.AccountNames,
		CommandGroupID: req.CommandGroupID,
		Action:         req.Action,
		Remark:         req.Remark,
	}
	
	// 在事务中创建
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// 创建过滤规则
		if err := tx.Create(filter).Error; err != nil {
			return fmt.Errorf("create command filter failed: %w", err)
		}
		
		// 创建用户关联
		if filter.UserType == models.FilterTargetSpecific && len(req.UserIDs) > 0 {
			for _, userID := range req.UserIDs {
				if err := tx.Exec("INSERT INTO filter_users (filter_id, user_id) VALUES (?, ?)", 
					filter.ID, userID).Error; err != nil {
					return fmt.Errorf("create filter user relation failed: %w", err)
				}
			}
		}
		
		// 创建资产关联
		if filter.AssetType == models.FilterTargetSpecific && len(req.AssetIDs) > 0 {
			for _, assetID := range req.AssetIDs {
				if err := tx.Exec("INSERT INTO filter_assets (filter_id, asset_id) VALUES (?, ?)", 
					filter.ID, assetID).Error; err != nil {
					return fmt.Errorf("create filter asset relation failed: %w", err)
				}
			}
		}
		
		// 创建属性关联
		if len(req.Attributes) > 0 {
			for _, attr := range req.Attributes {
				attribute := &models.FilterAttribute{
					FilterID:       filter.ID,
					TargetType:     attr.TargetType,
					AttributeName:  attr.AttributeName,
					AttributeValue: attr.AttributeValue,
				}
				if err := tx.Create(attribute).Error; err != nil {
					return fmt.Errorf("create filter attribute failed: %w", err)
				}
			}
		}
		
		return nil
	}); err != nil {
		return nil, err
	}
	
	// 清除相关缓存
	s.invalidateRelatedCaches(filter.ID)
	
	// 返回创建的过滤规则
	return s.Get(filter.ID)
}

// Update 更新过滤规则
func (s *CommandFilterService) Update(id uint, req *models.CommandFilterUpdateRequest) (*models.CommandFilterResponse, error) {
	// 查询过滤规则
	var filter models.CommandFilter
	if err := s.db.First(&filter, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrNotFound
		}
		return nil, fmt.Errorf("get command filter failed: %w", err)
	}
	
	// 验证命令组（如果要更新）
	if req.CommandGroupID != 0 && req.CommandGroupID != filter.CommandGroupID {
		var groupExists bool
		if err := s.db.Model(&models.CommandGroup{}).
			Select("1").
			Where("id = ?", req.CommandGroupID).
			Find(&groupExists).Error; err != nil {
			return nil, fmt.Errorf("check command group failed: %w", err)
		}
		if !groupExists {
			return nil, utils.ErrInvalidParam
		}
	}
	
	// 验证优先级（如果要更新）
	if req.Priority != 0 && (req.Priority < 1 || req.Priority > 100) {
		return nil, utils.ErrInvalidParam
	}
	
	// 在事务中更新
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// 更新基本信息
		updates := make(map[string]interface{})
		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.Priority != 0 {
			updates["priority"] = req.Priority
		}
		if req.Enabled != nil {
			updates["enabled"] = *req.Enabled
		}
		if req.UserType != "" {
			updates["user_type"] = req.UserType
		}
		if req.AssetType != "" {
			updates["asset_type"] = req.AssetType
		}
		if req.AccountType != "" {
			updates["account_type"] = req.AccountType
		}
		if req.AccountNames != nil {
			updates["account_names"] = *req.AccountNames
		}
		if req.CommandGroupID != 0 {
			updates["command_group_id"] = req.CommandGroupID
		}
		if req.Action != "" {
			updates["action"] = req.Action
		}
		if req.Remark != nil {
			updates["remark"] = *req.Remark
		}
		
		if len(updates) > 0 {
			if err := tx.Model(&filter).Updates(updates).Error; err != nil {
				return fmt.Errorf("update command filter failed: %w", err)
			}
		}
		
		// 更新用户关联（如果提供）
		if req.UserIDs != nil {
			// 删除旧的用户关联
			if err := tx.Exec("DELETE FROM filter_users WHERE filter_id = ?", id).Error; err != nil {
				return fmt.Errorf("delete old filter users failed: %w", err)
			}
			
			// 创建新的用户关联
			if req.UserType == models.FilterTargetSpecific && len(*req.UserIDs) > 0 {
				for _, userID := range *req.UserIDs {
					if err := tx.Exec("INSERT INTO filter_users (filter_id, user_id) VALUES (?, ?)", 
						id, userID).Error; err != nil {
						return fmt.Errorf("create filter user relation failed: %w", err)
					}
				}
			}
		}
		
		// 更新资产关联（如果提供）
		if req.AssetIDs != nil {
			// 删除旧的资产关联
			if err := tx.Exec("DELETE FROM filter_assets WHERE filter_id = ?", id).Error; err != nil {
				return fmt.Errorf("delete old filter assets failed: %w", err)
			}
			
			// 创建新的资产关联
			if req.AssetType == models.FilterTargetSpecific && len(*req.AssetIDs) > 0 {
				for _, assetID := range *req.AssetIDs {
					if err := tx.Exec("INSERT INTO filter_assets (filter_id, asset_id) VALUES (?, ?)", 
						id, assetID).Error; err != nil {
						return fmt.Errorf("create filter asset relation failed: %w", err)
					}
				}
			}
		}
		
		// 更新属性（如果提供）
		if req.Attributes != nil {
			// 删除旧的属性
			if err := tx.Where("filter_id = ?", id).Delete(&models.FilterAttribute{}).Error; err != nil {
				return fmt.Errorf("delete old filter attributes failed: %w", err)
			}
			
			// 创建新的属性
			for _, attr := range *req.Attributes {
				attribute := &models.FilterAttribute{
					FilterID:       id,
					TargetType:     attr.TargetType,
					AttributeName:  attr.AttributeName,
					AttributeValue: attr.AttributeValue,
				}
				if err := tx.Create(attribute).Error; err != nil {
					return fmt.Errorf("create filter attribute failed: %w", err)
				}
			}
		}
		
		return nil
	}); err != nil {
		return nil, err
	}
	
	// 清除相关缓存
	s.invalidateRelatedCaches(id)
	
	// 返回更新后的过滤规则
	return s.Get(id)
}

// Delete 删除过滤规则
func (s *CommandFilterService) Delete(id uint) error {
	// 删除过滤规则（级联删除关联数据）
	if err := s.db.Delete(&models.CommandFilter{}, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.ErrNotFound
		}
		return fmt.Errorf("delete command filter failed: %w", err)
	}
	
	// 清除相关缓存
	s.invalidateRelatedCaches(id)
	
	return nil
}

// Toggle 启用/禁用过滤规则
func (s *CommandFilterService) Toggle(id uint) error {
	// 查询当前状态
	var filter models.CommandFilter
	if err := s.db.Select("id, enabled").First(&filter, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.ErrNotFound
		}
		return fmt.Errorf("get command filter failed: %w", err)
	}
	
	// 切换状态
	if err := s.db.Model(&filter).Update("enabled", !filter.Enabled).Error; err != nil {
		return fmt.Errorf("toggle command filter failed: %w", err)
	}
	
	// 清除相关缓存
	s.invalidateRelatedCaches(id)
	
	return nil
}

// BatchDelete 批量删除过滤规则
func (s *CommandFilterService) BatchDelete(ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	
	// 批量删除
	if err := s.db.Where("id IN ?", ids).Delete(&models.CommandFilter{}).Error; err != nil {
		return fmt.Errorf("batch delete command filters failed: %w", err)
	}
	
	// 清除相关缓存
	for _, id := range ids {
		s.invalidateRelatedCaches(id)
	}
	
	return nil
}

// GetByPriority 按优先级获取启用的过滤规则
func (s *CommandFilterService) GetByPriority() ([]models.CommandFilter, error) {
	var filters []models.CommandFilter
	if err := s.db.Where("enabled = ?", true).
		Order("priority ASC, id ASC").
		Preload("CommandGroup.Items").
		Preload("Users").
		Preload("Assets").
		Preload("Attributes").
		Find(&filters).Error; err != nil {
		return nil, fmt.Errorf("get filters by priority failed: %w", err)
	}
	return filters, nil
}

// GetApplicableFilters 获取适用于特定用户、资产、账号的过滤规则
func (s *CommandFilterService) GetApplicableFilters(userID uint, assetID uint, account string) ([]models.CommandFilter, error) {
	var filters []models.CommandFilter
	
	// 添加调试日志
	fmt.Printf("[DEBUG] GetApplicableFilters called with userID=%d, assetID=%d, account=%s\n", userID, assetID, account)
	
	// 构建基础查询
	query := s.db.Model(&models.CommandFilter{}).
		Where("enabled = ?", true).
		Preload("CommandGroup.Items").
		Preload("Attributes")
	
	// 用户过滤条件
	userSubQuery := s.db.Table("command_filters cf").
		Select("cf.id").
		Where("cf.enabled = ?", true).
		Where("cf.user_type = ? OR (cf.user_type = ? AND EXISTS (SELECT 1 FROM filter_users fu WHERE fu.filter_id = cf.id AND fu.user_id = ?))",
			models.FilterTargetAll, models.FilterTargetSpecific, userID)
	
	// 资产过滤条件
	assetSubQuery := s.db.Table("command_filters cf2").
		Select("cf2.id").
		Where("cf2.enabled = ?", true).
		Where("cf2.asset_type = ? OR (cf2.asset_type = ? AND EXISTS (SELECT 1 FROM filter_assets fa WHERE fa.filter_id = cf2.id AND fa.asset_id = ?))",
			models.FilterTargetAll, models.FilterTargetSpecific, assetID)
	
	// 账号过滤条件
	accountSubQuery := s.db.Table("command_filters cf3").
		Select("cf3.id").
		Where("cf3.enabled = ?", true).
		Where("cf3.account_type = ? OR (cf3.account_type = ? AND (cf3.account_names = ? OR cf3.account_names LIKE ? OR cf3.account_names LIKE ? OR cf3.account_names LIKE ?))",
			models.FilterTargetAll, models.FilterTargetSpecific, account, account+",%", "%,"+account, "%,"+account+",%")
	
	// 组合所有条件
	if err := query.Where("id IN (?) AND id IN (?) AND id IN (?)", 
		userSubQuery, assetSubQuery, accountSubQuery).
		Order("priority ASC, id ASC").
		Find(&filters).Error; err != nil {
		return nil, fmt.Errorf("get applicable filters failed: %w", err)
	}
	
	// 调试日志：输出查询结果
	fmt.Printf("[DEBUG] Found %d applicable filters\n", len(filters))
	for _, f := range filters {
		fmt.Printf("[DEBUG] Filter: ID=%d, Name=%s, UserType=%s, AssetType=%s, AccountType=%s, AccountNames=%s\n", 
			f.ID, f.Name, f.UserType, f.AssetType, f.AccountType, f.AccountNames)
	}
	
	// 如果有属性过滤，还需要进一步处理
	var applicableFilters []models.CommandFilter
	for _, filter := range filters {
		// 检查用户属性
		if filter.UserType == models.FilterTargetAttribute {
			// TODO: 需要实现用户属性匹配逻辑
			// 这里需要根据实际的用户属性系统来实现
			continue
		}
		
		// 检查资产属性
		if filter.AssetType == models.FilterTargetAttribute {
			// TODO: 需要实现资产属性匹配逻辑
			// 这里需要根据实际的资产属性系统来实现
			continue
		}
		
		applicableFilters = append(applicableFilters, filter)
	}
	
	return applicableFilters, nil
}

// Export 导出过滤规则
func (s *CommandFilterService) Export(ids []uint) ([]models.CommandFilterExportData, error) {
	query := s.db.Model(&models.CommandFilter{})
	if len(ids) > 0 {
		query = query.Where("id IN ?", ids)
	}
	
	var filters []models.CommandFilter
	if err := query.Preload("CommandGroup").
		Preload("Users").
		Preload("Assets").
		Preload("Attributes").
		Find(&filters).Error; err != nil {
		return nil, fmt.Errorf("export command filters failed: %w", err)
	}
	
	// 转换为导出格式
	exportData := make([]models.CommandFilterExportData, len(filters))
	for i, filter := range filters {
		// 收集用户ID
		userIDs := make([]uint, len(filter.Users))
		for j, user := range filter.Users {
			userIDs[j] = user.ID
		}
		
		// 收集资产ID
		assetIDs := make([]uint, len(filter.Assets))
		for j, asset := range filter.Assets {
			assetIDs[j] = asset.ID
		}
		
		// 收集属性
		attributes := make([]models.FilterAttributeRequest, len(filter.Attributes))
		for j, attr := range filter.Attributes {
			attributes[j] = models.FilterAttributeRequest{
				TargetType:     attr.TargetType,
				AttributeName:  attr.AttributeName,
				AttributeValue: attr.AttributeValue,
			}
		}
		
		exportData[i] = models.CommandFilterExportData{
			Name:           filter.Name,
			Priority:       filter.Priority,
			Enabled:        filter.Enabled,
			UserType:       filter.UserType,
			UserIDs:        userIDs,
			AssetType:      filter.AssetType,
			AssetIDs:       assetIDs,
			AccountType:    filter.AccountType,
			AccountNames:   filter.AccountNames,
			CommandGroupName: filter.CommandGroup.Name,
			Action:         filter.Action,
			Remark:         filter.Remark,
			Attributes:     attributes,
		}
	}
	
	return exportData, nil
}

// Import 导入过滤规则
func (s *CommandFilterService) Import(data []models.CommandFilterExportData) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, filterData := range data {
			// 查找命令组
			var commandGroup models.CommandGroup
			if err := tx.Where("name = ?", filterData.CommandGroupName).First(&commandGroup).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					// 命令组不存在，跳过
					continue
				}
				return fmt.Errorf("find command group failed: %w", err)
			}
			
			// 创建过滤规则
			filter := &models.CommandFilter{
				Name:           filterData.Name,
				Priority:       filterData.Priority,
				Enabled:        filterData.Enabled,
				UserType:       filterData.UserType,
				AssetType:      filterData.AssetType,
				AccountType:    filterData.AccountType,
				AccountNames:   filterData.AccountNames,
				CommandGroupID: commandGroup.ID,
				Action:         filterData.Action,
				Remark:         filterData.Remark,
			}
			
			if err := tx.Create(filter).Error; err != nil {
				return fmt.Errorf("import command filter failed: %w", err)
			}
			
			// 创建用户关联
			if filter.UserType == models.FilterTargetSpecific && len(filterData.UserIDs) > 0 {
				for _, userID := range filterData.UserIDs {
					if err := tx.Exec("INSERT INTO filter_users (filter_id, user_id) VALUES (?, ?)", 
						filter.ID, userID).Error; err != nil {
						// 忽略用户不存在的错误
						continue
					}
				}
			}
			
			// 创建资产关联
			if filter.AssetType == models.FilterTargetSpecific && len(filterData.AssetIDs) > 0 {
				for _, assetID := range filterData.AssetIDs {
					if err := tx.Exec("INSERT INTO filter_assets (filter_id, asset_id) VALUES (?, ?)", 
						filter.ID, assetID).Error; err != nil {
						// 忽略资产不存在的错误
						continue
					}
				}
			}
			
			// 创建属性
			for _, attr := range filterData.Attributes {
				attribute := &models.FilterAttribute{
					FilterID:       filter.ID,
					TargetType:     attr.TargetType,
					AttributeName:  attr.AttributeName,
					AttributeValue: attr.AttributeValue,
				}
				if err := tx.Create(attribute).Error; err != nil {
					return fmt.Errorf("create filter attribute failed: %w", err)
				}
			}
		}
		
		return nil
	})
}

// buildFilterResponse 构建过滤规则响应
func (s *CommandFilterService) buildFilterResponse(filter *models.CommandFilter, includeDetails bool) models.CommandFilterResponse {
	response := models.CommandFilterResponse{
		ID:             filter.ID,
		Name:           filter.Name,
		Priority:       filter.Priority,
		Enabled:        filter.Enabled,
		UserType:       filter.UserType,
		AssetType:      filter.AssetType,
		AccountType:    filter.AccountType,
		AccountNames:   filter.AccountNames,
		CommandGroupID: filter.CommandGroupID,
		Action:         filter.Action,
		Remark:         filter.Remark,
		CreatedAt:      filter.CreatedAt,
		UpdatedAt:      filter.UpdatedAt,
	}
	
	// 命令组信息
	if filter.CommandGroup != nil {
		response.CommandGroupName = filter.CommandGroup.Name
	}
	
	// 账号列表
	if filter.AccountNames != "" {
		response.AccountList = strings.Split(filter.AccountNames, ",")
		for i := range response.AccountList {
			response.AccountList[i] = strings.TrimSpace(response.AccountList[i])
		}
	}
	
	// 详细信息
	if includeDetails {
		// 用户列表
		response.UserIDs = make([]uint, len(filter.Users))
		for i, user := range filter.Users {
			response.UserIDs[i] = user.ID
		}
		
		// 资产列表
		response.AssetIDs = make([]uint, len(filter.Assets))
		for i, asset := range filter.Assets {
			response.AssetIDs[i] = asset.ID
		}
		
		// 属性列表
		response.Attributes = make([]models.FilterAttributeResponse, len(filter.Attributes))
		for i, attr := range filter.Attributes {
			response.Attributes[i] = models.FilterAttributeResponse{
				ID:             attr.ID,
				TargetType:     attr.TargetType,
				AttributeName:  attr.AttributeName,
				AttributeValue: attr.AttributeValue,
			}
		}
	}
	
	return response
}

// invalidateRelatedCaches 使相关缓存失效
func (s *CommandFilterService) invalidateRelatedCaches(filterID uint) {
	if s.matcherService != nil {
		// 使过滤规则相关的缓存失效
		s.matcherService.InvalidateFilterCacheByFilterID(filterID)
	}
}