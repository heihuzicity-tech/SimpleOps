package services

import (
	"bastion/models"
	"bastion/utils"
	"errors"
	"fmt"
	"gorm.io/gorm"
)

// CommandGroupService 命令组服务
type CommandGroupService struct {
	db *gorm.DB
}

// NewCommandGroupService 创建命令组服务实例
func NewCommandGroupService(db *gorm.DB) *CommandGroupService {
	return &CommandGroupService{db: db}
}

// List 获取命令组列表
func (s *CommandGroupService) List(req *models.CommandGroupListRequest) (*models.PageResponse, error) {
	var total int64
	var groups []models.CommandGroup
	
	query := s.db.Model(&models.CommandGroup{})
	
	// 搜索条件
	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	
	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count command groups failed: %w", err)
	}
	
	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Order("created_at DESC").
		Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("query command groups failed: %w", err)
	}
	
	// 加载每个组的命令项数量
	groupIDs := make([]uint, len(groups))
	for i, group := range groups {
		groupIDs[i] = group.ID
	}
	
	// 统计每个组的命令项数量
	var itemCounts []struct {
		CommandGroupID uint
		Count          int
	}
	if len(groupIDs) > 0 {
		s.db.Model(&models.CommandGroupItem{}).
			Select("command_group_id, COUNT(*) as count").
			Where("command_group_id IN ?", groupIDs).
			Group("command_group_id").
			Scan(&itemCounts)
	}
	
	// 构建响应
	countMap := make(map[uint]int)
	for _, ic := range itemCounts {
		countMap[ic.CommandGroupID] = ic.Count
	}
	
	responses := make([]models.CommandGroupResponse, len(groups))
	for i, group := range groups {
		responses[i] = models.CommandGroupResponse{
			ID:        group.ID,
			Name:      group.Name,
			Remark:    group.Remark,
			ItemCount: countMap[group.ID],
			CreatedAt: group.CreatedAt,
			UpdatedAt: group.UpdatedAt,
		}
	}
	
	return &models.PageResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     responses,
	}, nil
}

// Get 获取命令组详情
func (s *CommandGroupService) Get(id uint) (*models.CommandGroupResponse, error) {
	var group models.CommandGroup
	
	// 查询命令组及其命令项
	if err := s.db.Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order, id")
	}).First(&group, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrNotFound
		}
		return nil, fmt.Errorf("get command group failed: %w", err)
	}
	
	// 构建响应
	items := make([]models.CommandGroupItemResponse, len(group.Items))
	for i, item := range group.Items {
		items[i] = models.CommandGroupItemResponse{
			ID:         item.ID,
			Type:       item.Type,
			Content:    item.Content,
			IgnoreCase: item.IgnoreCase,
			SortOrder:  item.SortOrder,
		}
	}
	
	return &models.CommandGroupResponse{
		ID:        group.ID,
		Name:      group.Name,
		Remark:    group.Remark,
		ItemCount: len(items),
		Items:     items,
		CreatedAt: group.CreatedAt,
		UpdatedAt: group.UpdatedAt,
	}, nil
}

// Create 创建命令组
func (s *CommandGroupService) Create(req *models.CommandGroupCreateRequest) (*models.CommandGroupResponse, error) {
	// 检查名称是否已存在
	var count int64
	if err := s.db.Model(&models.CommandGroup{}).Where("name = ?", req.Name).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("check command group name failed: %w", err)
	}
	if count > 0 {
		return nil, utils.ErrDuplicate
	}
	
	// 创建命令组和命令项
	group := &models.CommandGroup{
		Name:   req.Name,
		Remark: req.Remark,
		Items:  make([]models.CommandGroupItem, len(req.Items)),
	}
	
	for i, item := range req.Items {
		group.Items[i] = models.CommandGroupItem{
			Type:       item.Type,
			Content:    item.Content,
			IgnoreCase: item.IgnoreCase,
			SortOrder:  item.SortOrder,
		}
	}
	
	// 在事务中创建
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(group).Error; err != nil {
			return fmt.Errorf("create command group failed: %w", err)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	
	// 返回创建的命令组
	return s.Get(group.ID)
}

// Update 更新命令组
func (s *CommandGroupService) Update(id uint, req *models.CommandGroupUpdateRequest) (*models.CommandGroupResponse, error) {
	// 查询命令组
	var group models.CommandGroup
	if err := s.db.First(&group, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrNotFound
		}
		return nil, fmt.Errorf("get command group failed: %w", err)
	}
	
	// 如果要更新名称，检查是否重复
	if req.Name != "" && req.Name != group.Name {
		var count int64
		if err := s.db.Model(&models.CommandGroup{}).
			Where("name = ? AND id != ?", req.Name, id).
			Count(&count).Error; err != nil {
			return nil, fmt.Errorf("check command group name failed: %w", err)
		}
		if count > 0 {
			return nil, utils.ErrDuplicate
		}
	}
	
	// 在事务中更新
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// 更新基本信息
		updates := make(map[string]interface{})
		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.Remark != "" {
			updates["remark"] = req.Remark
		}
		
		if len(updates) > 0 {
			if err := tx.Model(&group).Updates(updates).Error; err != nil {
				return fmt.Errorf("update command group failed: %w", err)
			}
		}
		
		// 更新命令项（如果提供）
		if req.Items != nil {
			// 删除旧的命令项
			if err := tx.Where("command_group_id = ?", id).Delete(&models.CommandGroupItem{}).Error; err != nil {
				return fmt.Errorf("delete old command items failed: %w", err)
			}
			
			// 创建新的命令项
			items := make([]models.CommandGroupItem, len(req.Items))
			for i, item := range req.Items {
				items[i] = models.CommandGroupItem{
					CommandGroupID: id,
					Type:          item.Type,
					Content:       item.Content,
					IgnoreCase:    item.IgnoreCase,
					SortOrder:     item.SortOrder,
				}
			}
			
			if len(items) > 0 {
				if err := tx.Create(&items).Error; err != nil {
					return fmt.Errorf("create command items failed: %w", err)
				}
			}
		}
		
		return nil
	}); err != nil {
		return nil, err
	}
	
	// 返回更新后的命令组
	return s.Get(id)
}

// Delete 删除命令组
func (s *CommandGroupService) Delete(id uint) error {
	// 检查是否被过滤规则使用
	var count int64
	if err := s.db.Model(&models.CommandFilter{}).
		Where("command_group_id = ?", id).
		Count(&count).Error; err != nil {
		return fmt.Errorf("check command group usage failed: %w", err)
	}
	
	if count > 0 {
		return utils.ErrInUse
	}
	
	// 删除命令组（级联删除命令项）
	if err := s.db.Delete(&models.CommandGroup{}, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.ErrNotFound
		}
		return fmt.Errorf("delete command group failed: %w", err)
	}
	
	return nil
}

// BatchDelete 批量删除命令组
func (s *CommandGroupService) BatchDelete(ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	
	// 检查是否被使用
	var count int64
	if err := s.db.Model(&models.CommandFilter{}).
		Where("command_group_id IN ?", ids).
		Count(&count).Error; err != nil {
		return fmt.Errorf("check command groups usage failed: %w", err)
	}
	
	if count > 0 {
		return utils.ErrInUse
	}
	
	// 批量删除
	if err := s.db.Where("id IN ?", ids).Delete(&models.CommandGroup{}).Error; err != nil {
		return fmt.Errorf("batch delete command groups failed: %w", err)
	}
	
	return nil
}

// GetByName 根据名称获取命令组
func (s *CommandGroupService) GetByName(name string) (*models.CommandGroup, error) {
	var group models.CommandGroup
	if err := s.db.Where("name = ?", name).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrNotFound
		}
		return nil, fmt.Errorf("get command group by name failed: %w", err)
	}
	return &group, nil
}

// GetItems 获取命令组的所有命令项
func (s *CommandGroupService) GetItems(groupID uint) ([]models.CommandGroupItem, error) {
	var items []models.CommandGroupItem
	if err := s.db.Where("command_group_id = ?", groupID).
		Order("sort_order, id").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("get command group items failed: %w", err)
	}
	return items, nil
}

// Export 导出命令组
func (s *CommandGroupService) Export(ids []uint) ([]models.CommandGroupExportData, error) {
	query := s.db.Model(&models.CommandGroup{})
	if len(ids) > 0 {
		query = query.Where("id IN ?", ids)
	}
	
	var groups []models.CommandGroup
	if err := query.Preload("Items", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order, id")
	}).Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("export command groups failed: %w", err)
	}
	
	// 转换为导出格式
	exportData := make([]models.CommandGroupExportData, len(groups))
	for i, group := range groups {
		items := make([]models.CommandGroupItemRequest, len(group.Items))
		for j, item := range group.Items {
			items[j] = models.CommandGroupItemRequest{
				Type:       item.Type,
				Content:    item.Content,
				IgnoreCase: item.IgnoreCase,
				SortOrder:  item.SortOrder,
			}
		}
		
		exportData[i] = models.CommandGroupExportData{
			Name:   group.Name,
			Remark: group.Remark,
			Items:  items,
		}
	}
	
	return exportData, nil
}

// Import 导入命令组
func (s *CommandGroupService) Import(data []models.CommandGroupExportData) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, groupData := range data {
			// 检查是否已存在
			var existingGroup models.CommandGroup
			err := tx.Where("name = ?", groupData.Name).First(&existingGroup).Error
			if err == nil {
				// 已存在，跳过
				continue
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("check existing group failed: %w", err)
			}
			
			// 创建新组
			group := &models.CommandGroup{
				Name:   groupData.Name,
				Remark: groupData.Remark,
				Items:  make([]models.CommandGroupItem, len(groupData.Items)),
			}
			
			for i, item := range groupData.Items {
				group.Items[i] = models.CommandGroupItem{
					Type:       item.Type,
					Content:    item.Content,
					IgnoreCase: item.IgnoreCase,
					SortOrder:  item.SortOrder,
				}
			}
			
			if err := tx.Create(group).Error; err != nil {
				return fmt.Errorf("import command group failed: %w", err)
			}
		}
		
		return nil
	})
}