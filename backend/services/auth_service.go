package services

import (
	"bastion/models"
	"bastion/utils"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// AuthService 认证服务
type AuthService struct {
	db *gorm.DB
}

// NewAuthService 创建认证服务实例
func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

// Login 用户登录
func (s *AuthService) Login(request *models.UserLoginRequest) (*utils.TokenResponse, error) {
	// 根据用户名查找用户
	var user models.User
	if err := s.db.Preload("Roles.Permissions").Where("username = ?", request.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid username or password")
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	// 检查用户是否激活
	if !user.IsActive() {
		return nil, errors.New("user account is disabled")
	}

	// 验证密码
	if !utils.CheckPassword(request.Password, user.Password) {
		return nil, errors.New("invalid username or password")
	}

	// 生成JWT token
	token, err := utils.GenerateToken(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return token, nil
}

// Logout 用户登出
func (s *AuthService) Logout(tokenString string) error {
	// 将token加入黑名单
	if err := utils.BlacklistToken(tokenString); err != nil {
		return fmt.Errorf("failed to blacklist token: %w", err)
	}

	return nil
}

// RefreshToken 刷新token
func (s *AuthService) RefreshToken(tokenString string) (*utils.TokenResponse, error) {
	return utils.RefreshToken(tokenString)
}

// GetProfile 获取用户资料
func (s *AuthService) GetProfile(userID uint) (*models.UserResponse, error) {
	var user models.User
	// 预加载Roles和Permissions以便计算用户权限
	if err := s.db.Preload("Roles.Permissions").Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user.ToResponse(), nil
}

// UpdateProfile 更新用户资料
func (s *AuthService) UpdateProfile(userID uint, request *models.UserUpdateRequest) (*models.UserResponse, error) {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	// 更新用户信息
	updates := make(map[string]interface{})
	if request.Email != "" {
		updates["email"] = request.Email
	}
	if request.Phone != "" {
		updates["phone"] = request.Phone
	}

	if len(updates) > 0 {
		if err := s.db.Model(&user).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	// 重新加载用户信息
	if err := s.db.Preload("Roles").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to reload user: %w", err)
	}

	return user.ToResponse(), nil
}

// ChangePassword 修改密码
func (s *AuthService) ChangePassword(userID uint, request *models.PasswordChangeRequest) error {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("failed to find user: %w", err)
	}

	// 验证旧密码
	if !utils.CheckPassword(request.OldPassword, user.Password) {
		return errors.New("invalid old password")
	}

	// 验证新密码强度
	if !utils.ValidatePasswordStrength(request.NewPassword) {
		return errors.New("password does not meet strength requirements")
	}

	// 哈希新密码
	hashedPassword, err := utils.HashPassword(request.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 更新密码
	if err := s.db.Model(&user).Update("password", hashedPassword).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// ValidateToken 验证token
func (s *AuthService) ValidateToken(tokenString string) (*models.User, error) {
	return utils.GetUserFromToken(tokenString)
}
