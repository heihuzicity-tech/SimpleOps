package utils

import (
	"bastion/config"
	"bastion/models"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims JWT自定义声明
type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// TokenResponse Token响应结构
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// GenerateToken 生成JWT token
func GenerateToken(user *models.User) (*TokenResponse, error) {
	// 设置过期时间
	expireTime := time.Now().Add(time.Duration(config.GlobalConfig.JWT.Expire) * time.Second)

	// 创建Claims
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expireTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    config.GlobalConfig.JWT.Issuer,
			Subject:   user.Username,
			ID:        uuid.New().String(),
		},
	}

	// 生成token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.GlobalConfig.JWT.Secret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken: tokenString,
		TokenType:   "Bearer",
		ExpiresIn:   config.GlobalConfig.JWT.Expire,
	}, nil
}

// ParseToken 解析JWT token
func ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(config.GlobalConfig.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// ValidateToken 验证JWT token
func ValidateToken(tokenString string) (*Claims, error) {
	claims, err := ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	// 检查token是否过期
	if claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("token expired")
	}

	return claims, nil
}

// RefreshToken 刷新JWT token
func RefreshToken(tokenString string) (*TokenResponse, error) {
	claims, err := ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	// 检查是否可以刷新（例如：token在1小时内过期才能刷新）
	if time.Until(claims.ExpiresAt.Time) > time.Hour {
		return nil, errors.New("token does not need refresh")
	}

	// 从数据库获取用户信息
	var user models.User
	if err := GetDB().Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// 检查用户是否仍然有效
	if !user.IsActive() {
		return nil, errors.New("user is inactive")
	}

	// 生成新的token
	return GenerateToken(&user)
}

// GetUserFromToken 从token中获取用户信息
func GetUserFromToken(tokenString string) (*models.User, error) {
	claims, err := ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	var user models.User
	if err := GetDB().Preload("Roles.Permissions").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// 检查用户是否仍然有效
	if !user.IsActive() {
		return nil, errors.New("user is inactive")
	}

	return &user, nil
}

// BlacklistToken 将token加入黑名单（Redis）
func BlacklistToken(tokenString string) error {
	claims, err := ParseToken(tokenString)
	if err != nil {
		return err
	}

	// 计算token剩余有效期
	expireTime := time.Until(claims.ExpiresAt.Time)
	if expireTime <= 0 {
		return nil // token已过期，无需加入黑名单
	}

	// 将token ID存入Redis黑名单
	key := "blacklist:" + claims.ID
	return GetRedis().Set(GetRedis().Context(), key, tokenString, expireTime).Err()
}

// IsTokenBlacklisted 检查token是否在黑名单中
func IsTokenBlacklisted(tokenString string) bool {
	claims, err := ParseToken(tokenString)
	if err != nil {
		return true
	}

	key := "blacklist:" + claims.ID
	exists, err := GetRedis().Exists(GetRedis().Context(), key).Result()
	return err == nil && exists > 0
}
