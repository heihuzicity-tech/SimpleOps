package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/bcrypt"
)

// 加密密钥，实际项目中应该从配置文件读取
var encryptionKey = []byte("bastion-key-32-chars-long-000000")

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

// EncryptPassword 加密密码（用于凭证存储）
func EncryptPassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}

	// 创建AES密码块
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 生成随机nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// 加密数据
	ciphertext := gcm.Seal(nonce, nonce, []byte(password), nil)

	// 返回base64编码的结果
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptPassword 解密密码（用于凭证使用）
func DecryptPassword(encryptedPassword string) (string, error) {
	if encryptedPassword == "" {
		return "", nil
	}

	// 解码base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedPassword)
	if err != nil {
		return "", err
	}

	// 创建AES密码块
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 获取nonce大小
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	// 分离nonce和密文
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// 解密数据
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
