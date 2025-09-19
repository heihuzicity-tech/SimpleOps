package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"strings"
)

// 凭证类型常量
const (
	CredentialTypePassword = "password"
	CredentialTypeKey      = "key"
	CredentialTypeCert     = "cert"
)

// 凭证工具类 - 统一处理凭证加密解密和验证
type CredentialUtils struct {
	encryptionKey []byte
}

// NewCredentialUtils 创建新的凭证工具实例
func NewCredentialUtils(key string) *CredentialUtils {
	// 使用固定长度的密钥，确保AES-256加密
	keyBytes := []byte(key)
	if len(keyBytes) < 32 {
		// 填充到32字节
		padding := make([]byte, 32-len(keyBytes))
		keyBytes = append(keyBytes, padding...)
	} else if len(keyBytes) > 32 {
		// 截取前32字节
		keyBytes = keyBytes[:32]
	}
	
	return &CredentialUtils{
		encryptionKey: keyBytes,
	}
}

// EncryptCredential 加密凭证信息
func (cu *CredentialUtils) EncryptCredential(plaintext string) (string, error) {
	if plaintext == "" {
		return "", errors.New("明文凭证不能为空")
	}

	block, err := aes.NewCipher(cu.encryptionKey)
	if err != nil {
		return "", fmt.Errorf("创建AES加密器失败: %v", err)
	}

	// 使用GCM模式，提供认证加密
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("创建GCM失败: %v", err)
	}

	// 生成随机nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("生成nonce失败: %v", err)
	}

	// 加密数据
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	
	// 返回base64编码的密文
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptCredential 解密凭证信息
func (cu *CredentialUtils) DecryptCredential(encrypted string) (string, error) {
	if encrypted == "" {
		return "", errors.New("加密凭证不能为空")
	}

	// base64解码
	ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("base64解码失败: %v", err)
	}

	block, err := aes.NewCipher(cu.encryptionKey)
	if err != nil {
		return "", fmt.Errorf("创建AES解密器失败: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("创建GCM失败: %v", err)
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", errors.New("密文长度不足")
	}

	// 提取nonce和密文
	nonce := ciphertext[:gcm.NonceSize()]
	ciphertext = ciphertext[gcm.NonceSize():]

	// 解密数据
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("解密失败: %v", err)
	}

	return string(plaintext), nil
}

// ValidateCredentialType 验证凭证类型是否有效
func (cu *CredentialUtils) ValidateCredentialType(credType string) bool {
	switch credType {
	case CredentialTypePassword, CredentialTypeKey, CredentialTypeCert:
		return true
	default:
		return false
	}
}

// ValidatePrivateKey 验证私钥格式是否正确
func (cu *CredentialUtils) ValidatePrivateKey(keyData string) error {
	if keyData == "" {
		return errors.New("私钥数据不能为空")
	}

	// 解析PEM格式的私钥
	block, _ := pem.Decode([]byte(keyData))
	if block == nil {
		return errors.New("无效的PEM格式私钥")
	}

	// 检查是否为私钥块
	if !strings.Contains(block.Type, "PRIVATE KEY") {
		return errors.New("不是私钥格式")
	}

	// 尝试解析私钥
	switch block.Type {
	case "RSA PRIVATE KEY":
		_, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("解析RSA私钥失败: %v", err)
		}
	case "PRIVATE KEY":
		_, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("解析PKCS8私钥失败: %v", err)
		}
	default:
		return fmt.Errorf("不支持的私钥类型: %s", block.Type)
	}

	return nil
}

// ValidatePassword 验证密码强度
func (cu *CredentialUtils) ValidatePassword(password string) error {
	if len(password) < 6 {
		return errors.New("密码长度不能少于6位")
	}
	
	// 可以添加更多密码复杂度验证
	return nil
}

// GetCredentialDisplay 获取凭证的显示字符串（用于日志记录，不显示敏感信息）
func (cu *CredentialUtils) GetCredentialDisplay(credType, username string) string {
	if username != "" {
		return fmt.Sprintf("%s(%s)", credType, username)
	}
	return credType
}

// ParseSSHPrivateKey 解析SSH私钥，返回可用于SSH连接的私钥对象
func (cu *CredentialUtils) ParseSSHPrivateKey(keyData string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(keyData))
	if block == nil {
		return nil, errors.New("无效的PEM格式私钥")
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("不是RSA私钥")
		}
		return rsaKey, nil
	default:
		return nil, fmt.Errorf("不支持的私钥类型: %s", block.Type)
	}
}

// MaskSensitiveData 掩码敏感数据用于日志记录
func (cu *CredentialUtils) MaskSensitiveData(data string) string {
	if len(data) <= 4 {
		return "****"
	}
	
	if len(data) <= 8 {
		return data[:2] + "****"
	}
	
	return data[:2] + "****" + data[len(data)-2:]
}

// 全局凭证工具实例，使用默认密钥
var DefaultCredentialUtils = NewCredentialUtils("bastion-default-key-2024")

// 便捷函数，使用默认实例
func ValidateCredType(credType string) bool {
	return DefaultCredentialUtils.ValidateCredentialType(credType)
}

func ValidatePrivateKeyFormat(keyData string) error {
	return DefaultCredentialUtils.ValidatePrivateKey(keyData)
}