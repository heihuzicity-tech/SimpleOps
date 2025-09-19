package services

import (
	"bastion/models"
	"bastion/utils"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// UserService 用户服务
type UserService struct {
	db *gorm.DB
}

// NewUserService 创建用户服务实例
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// CreateUser 创建用户
func (s *UserService) CreateUser(request *models.UserCreateRequest) (*models.UserResponse, error) {
	// 检查用户名是否已存在
	var existingUser models.User
	if err := s.db.Where("username = ?", request.Username).First(&existingUser).Error; err == nil {
		return nil, errors.New("username already exists")
	}

	// 检查角色是否存在
	var roles []models.Role
	if err := s.db.Where("id IN ?", request.RoleIDs).Find(&roles).Error; err != nil {
		return nil, fmt.Errorf("failed to find roles: %w", err)
	}
	if len(roles) != len(request.RoleIDs) {
		return nil, errors.New("some roles not found")
	}

	// 哈希密码
	hashedPassword, err := utils.HashPassword(request.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 创建用户
	user := models.User{
		Username: request.Username,
		Password: hashedPassword,
		Email:    request.Email,
		Phone:    request.Phone,
		Status:   1, // 默认启用
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 保存用户
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// 关联角色
	for _, roleID := range request.RoleIDs {
		userRole := models.UserRole{
			UserID: user.ID,
			RoleID: roleID,
		}
		if err := tx.Create(&userRole).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to assign role: %w", err)
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// 重新加载用户信息
	if err := s.db.Preload("Roles").Where("id = ?", user.ID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to reload user: %w", err)
	}

	return user.ToResponse(), nil
}

// GetUsers 获取用户列表
func (s *UserService) GetUsers(page, pageSize int) ([]models.UserResponse, int64, error) {
	var users []models.User
	var total int64

	// 获取总数
	if err := s.db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := s.db.Preload("Roles").Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to find users: %w", err)
	}

	// 转换为响应格式
	var responses []models.UserResponse
	for _, user := range users {
		responses = append(responses, *user.ToResponse())
	}

	return responses, total, nil
}

// GetUser 获取单个用户
func (s *UserService) GetUser(userID uint) (*models.UserResponse, error) {
	var user models.User
	if err := s.db.Preload("Roles").Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	return user.ToResponse(), nil
}

// UpdateUser 更新用户
func (s *UserService) UpdateUser(userID uint, request *models.UserUpdateRequest) (*models.UserResponse, error) {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新用户信息
	updates := make(map[string]interface{})
	if request.Email != "" {
		updates["email"] = request.Email
	}
	if request.Phone != "" {
		updates["phone"] = request.Phone
	}
	if request.Status != nil {
		updates["status"] = *request.Status
	}

	if len(updates) > 0 {
		if err := tx.Model(&user).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	// 更新角色关联
	if len(request.RoleIDs) > 0 {
		// 删除现有角色关联
		if err := tx.Where("user_id = ?", userID).Delete(&models.UserRole{}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to delete user roles: %w", err)
		}

		// 检查角色是否存在
		var roles []models.Role
		if err := tx.Where("id IN ?", request.RoleIDs).Find(&roles).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to find roles: %w", err)
		}
		if len(roles) != len(request.RoleIDs) {
			tx.Rollback()
			return nil, errors.New("some roles not found")
		}

		// 添加新角色关联
		for _, roleID := range request.RoleIDs {
			userRole := models.UserRole{
				UserID: userID,
				RoleID: roleID,
			}
			if err := tx.Create(&userRole).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("failed to assign role: %w", err)
			}
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// 重新加载用户信息
	if err := s.db.Preload("Roles").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to reload user: %w", err)
	}

	return user.ToResponse(), nil
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(userID uint) error {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("failed to find user: %w", err)
	}

	// 软删除用户
	if err := s.db.Delete(&user).Error; err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// ResetPassword 重置密码
func (s *UserService) ResetPassword(userID uint, newPassword string) error {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("failed to find user: %w", err)
	}

	// 验证新密码强度
	if !utils.ValidatePasswordStrength(newPassword) {
		return errors.New("password does not meet strength requirements")
	}

	// 哈希新密码
	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 更新密码
	if err := s.db.Model(&user).Update("password", hashedPassword).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// ToggleUserStatus 切换用户状态
func (s *UserService) ToggleUserStatus(userID uint) error {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("failed to find user: %w", err)
	}

	// 切换状态
	newStatus := 1 - user.Status
	if err := s.db.Model(&user).Update("status", newStatus).Error; err != nil {
		return fmt.Errorf("failed to update user status: %w", err)
	}

	return nil
}
