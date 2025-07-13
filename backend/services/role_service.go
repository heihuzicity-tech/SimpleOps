package services

import (
	"bastion/models"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// RoleService 角色服务
type RoleService struct {
	db *gorm.DB
}

// NewRoleService 创建角色服务实例
func NewRoleService(db *gorm.DB) *RoleService {
	return &RoleService{db: db}
}

// CreateRole 创建角色
func (s *RoleService) CreateRole(request *models.RoleCreateRequest) (*models.RoleResponse, error) {
	// 检查角色名是否已存在
	var existingRole models.Role
	if err := s.db.Where("name = ?", request.Name).First(&existingRole).Error; err == nil {
		return nil, errors.New("role name already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check role name: %w", err)
	}

	// 验证权限是否存在
	var permissions []models.Permission
	if len(request.Permissions) > 0 {
		if err := s.db.Where("name IN ?", request.Permissions).Find(&permissions).Error; err != nil {
			return nil, fmt.Errorf("failed to find permissions: %w", err)
		}
		if len(permissions) != len(request.Permissions) {
			return nil, errors.New("some permissions do not exist")
		}
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 创建角色
	role := models.Role{
		Name:        request.Name,
		Description: request.Description,
	}

	if err := tx.Create(&role).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	// 关联权限
	if len(permissions) > 0 {
		if err := tx.Model(&role).Association("Permissions").Append(permissions); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to associate permissions: %w", err)
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// 重新查询角色，包含权限信息
	var createdRole models.Role
	if err := s.db.Preload("Permissions").Where("id = ?", role.ID).First(&createdRole).Error; err != nil {
		return nil, fmt.Errorf("failed to query created role: %w", err)
	}

	return createdRole.ToResponse(), nil
}

// GetRoles 获取角色列表
func (s *RoleService) GetRoles(request *models.RoleListRequest) ([]*models.RoleResponse, int64, error) {
	var roles []models.Role
	var total int64

	// 构建查询
	query := s.db.Model(&models.Role{})

	// 关键字搜索
	if request.Keyword != "" {
		query = query.Where("name LIKE ? OR description LIKE ?", "%"+request.Keyword+"%", "%"+request.Keyword+"%")
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count roles: %w", err)
	}

	// 分页参数
	if request.Page > 0 && request.PageSize > 0 {
		offset := (request.Page - 1) * request.PageSize
		query = query.Offset(offset).Limit(request.PageSize)
	}

	// 查询角色，预加载权限和用户
	if err := query.Preload("Permissions").Preload("Users").Find(&roles).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to query roles: %w", err)
	}

	// 转换为响应格式
	responses := make([]*models.RoleResponse, len(roles))
	for i, role := range roles {
		responses[i] = role.ToResponse()
	}

	return responses, total, nil
}

// GetRole 获取单个角色
func (s *RoleService) GetRole(id uint) (*models.RoleResponse, error) {
	var role models.Role
	if err := s.db.Preload("Permissions").Preload("Users").Where("id = ?", id).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("role not found")
		}
		return nil, fmt.Errorf("failed to query role: %w", err)
	}

	return role.ToResponse(), nil
}

// UpdateRole 更新角色
func (s *RoleService) UpdateRole(id uint, request *models.RoleUpdateRequest) (*models.RoleResponse, error) {
	// 查找角色
	var role models.Role
	if err := s.db.Preload("Permissions").Where("id = ?", id).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("role not found")
		}
		return nil, fmt.Errorf("failed to query role: %w", err)
	}

	// 验证权限是否存在
	var permissions []models.Permission
	if len(request.Permissions) > 0 {
		if err := s.db.Where("name IN ?", request.Permissions).Find(&permissions).Error; err != nil {
			return nil, fmt.Errorf("failed to find permissions: %w", err)
		}
		if len(permissions) != len(request.Permissions) {
			return nil, errors.New("some permissions do not exist")
		}
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新角色基本信息
	updates := make(map[string]interface{})
	if request.Description != "" {
		updates["description"] = request.Description
	}

	if len(updates) > 0 {
		if err := tx.Model(&role).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update role: %w", err)
		}
	}

	// 更新权限关联
	if len(request.Permissions) > 0 {
		// 清除现有权限关联
		if err := tx.Model(&role).Association("Permissions").Clear(); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to clear permissions: %w", err)
		}

		// 添加新的权限关联
		if len(permissions) > 0 {
			if err := tx.Model(&role).Association("Permissions").Append(permissions); err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("failed to associate permissions: %w", err)
			}
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// 重新查询角色，包含权限信息
	var updatedRole models.Role
	if err := s.db.Preload("Permissions").Preload("Users").Where("id = ?", id).First(&updatedRole).Error; err != nil {
		return nil, fmt.Errorf("failed to query updated role: %w", err)
	}

	return updatedRole.ToResponse(), nil
}

// DeleteRole 删除角色
func (s *RoleService) DeleteRole(id uint) error {
	// 查找角色
	var role models.Role
	if err := s.db.Where("id = ?", id).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("role not found")
		}
		return fmt.Errorf("failed to query role: %w", err)
	}

	// 检查是否有用户使用此角色
	var userRoleCount int64
	if err := s.db.Model(&models.UserRole{}).Where("role_id = ?", id).Count(&userRoleCount).Error; err != nil {
		return fmt.Errorf("failed to check user role associations: %w", err)
	}

	if userRoleCount > 0 {
		return errors.New("cannot delete role: it is assigned to users")
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 清除权限关联
	if err := tx.Model(&role).Association("Permissions").Clear(); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear permissions: %w", err)
	}

	// 软删除角色
	if err := tx.Delete(&role).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete role: %w", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetRoleByName 根据名称获取角色
func (s *RoleService) GetRoleByName(name string) (*models.Role, error) {
	var role models.Role
	if err := s.db.Preload("Permissions").Where("name = ?", name).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("role not found")
		}
		return nil, fmt.Errorf("failed to query role: %w", err)
	}

	return &role, nil
}

// GetAvailablePermissions 获取可用权限列表
func (s *RoleService) GetAvailablePermissions() []string {
	return []string{
		"user:create",
		"user:read",
		"user:update",
		"user:delete",
		"role:create",
		"role:read",
		"role:update",
		"role:delete",
		"asset:create",
		"asset:read",
		"asset:update",
		"asset:delete",
		"asset:connect",
		"audit:read",
		"session:read",
		"log:read",
		"all",
	}
}

// GetPermissions 获取权限列表
func (s *RoleService) GetPermissions() ([]*models.Permission, error) {
	var permissions []*models.Permission
	if err := s.db.Find(&permissions).Error; err != nil {
		return nil, fmt.Errorf("failed to query permissions: %w", err)
	}

	return permissions, nil
}
