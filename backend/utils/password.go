package utils

import (
	"golang.org/x/crypto/bcrypt"
)

// HashPassword 对密码进行哈希处理
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ValidatePasswordStrength 验证密码强度
func ValidatePasswordStrength(password string) bool {
	// 至少6个字符
	if len(password) < 6 {
		return false
	}

	// 至少包含一个字母和一个数字
	hasLetter := false
	hasDigit := false

	for _, char := range password {
		switch {
		case char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z':
			hasLetter = true
		case char >= '0' && char <= '9':
			hasDigit = true
		}
	}

	return hasLetter && hasDigit
}
