package utils

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

// 连接类型常量
const (
	ConnTypeSSH      = "ssh"
	ConnTypeRDP      = "rdp"
	ConnTypeMySQL    = "mysql"
	ConnTypePostgres = "postgres"
	ConnTypeTelnet   = "telnet"
	ConnTypeVNC      = "vnc"
)

// 默认端口映射
var DefaultPorts = map[string]int{
	ConnTypeSSH:      22,
	ConnTypeRDP:      3389,
	ConnTypeMySQL:    3306,
	ConnTypePostgres: 5432,
	ConnTypeTelnet:   23,
	ConnTypeVNC:      5900,
}

// 默认超时配置
const (
	DefaultConnectTimeout = 10 * time.Second
	DefaultReadTimeout    = 5 * time.Second
	DatabaseTestTimeout   = 15 * time.Second
)

// ConnectionConfig 连接配置
type ConnectionConfig struct {
	Host        string
	Port        int
	Username    string
	Password    string
	PrivateKey  string
	ConnType    string
	Timeout     time.Duration
	Database    string // 数据库名称（用于数据库连接）
}

// ConnectionUtils 连接工具类
type ConnectionUtils struct {
	credUtils *CredentialUtils
}

// NewConnectionUtils 创建连接工具实例
func NewConnectionUtils() *ConnectionUtils {
	return &ConnectionUtils{
		credUtils: DefaultCredentialUtils,
	}
}

// TestTCPConnection 测试TCP连接
func (cu *ConnectionUtils) TestTCPConnection(host string, port int, timeout time.Duration) error {
	if host == "" {
		return fmt.Errorf("主机地址不能为空")
	}
	
	if port <= 0 || port > 65535 {
		return fmt.Errorf("端口号无效: %d", port)
	}
	
	if timeout <= 0 {
		timeout = DefaultConnectTimeout
	}

	address := net.JoinHostPort(host, strconv.Itoa(port))
	
	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return fmt.Errorf("TCP连接失败 %s: %v", address, err)
	}
	defer conn.Close()

	return nil
}

// TestSSHConnection 测试SSH连接
func (cu *ConnectionUtils) TestSSHConnection(config *ConnectionConfig) error {
	if err := cu.validateConnectionConfig(config, ConnTypeSSH); err != nil {
		return err
	}

	// 创建SSH客户端配置
	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // 测试时忽略主机密钥验证
		Timeout:         config.Timeout,
	}

	// 根据凭证类型配置认证方法
	if config.PrivateKey != "" {
		// 私钥认证
		signer, err := cu.createSSHSigner(config.PrivateKey)
		if err != nil {
			return fmt.Errorf("创建SSH签名器失败: %v", err)
		}
		sshConfig.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else {
		// 密码认证
		password, err := cu.credUtils.DecryptCredential(config.Password)
		if err != nil {
			return fmt.Errorf("解密密码失败: %v", err)
		}
		sshConfig.Auth = []ssh.AuthMethod{ssh.Password(password)}
	}

	// 连接SSH服务器
	address := cu.FormatAddress(config.Host, config.Port)
	client, err := ssh.Dial("tcp", address, sshConfig)
	if err != nil {
		return fmt.Errorf("SSH连接失败 %s: %v", address, err)
	}
	defer client.Close()

	// 测试执行简单命令
	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("创建SSH会话失败: %v", err)
	}
	defer session.Close()

	// 执行echo命令测试
	output, err := session.Output("echo 'connection_test'")
	if err != nil {
		return fmt.Errorf("SSH命令执行失败: %v", err)
	}

	if !strings.Contains(string(output), "connection_test") {
		return fmt.Errorf("SSH命令执行结果异常")
	}

	return nil
}

// TestDatabaseConnection 测试数据库连接
func (cu *ConnectionUtils) TestDatabaseConnection(config *ConnectionConfig) error {
	if err := cu.validateConnectionConfig(config, config.ConnType); err != nil {
		return err
	}

	// 解密密码
	password, err := cu.credUtils.DecryptCredential(config.Password)
	if err != nil {
		return fmt.Errorf("解密密码失败: %v", err)
	}

	// 构建数据库连接字符串
	var dsn string
	switch config.ConnType {
	case ConnTypeMySQL:
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=%ds",
			config.Username, password, config.Host, config.Port,
			config.Database, int(DatabaseTestTimeout.Seconds()))
	case ConnTypePostgres:
		dsn = fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable connect_timeout=%d",
			config.Host, config.Port, config.Username, password,
			config.Database, int(DatabaseTestTimeout.Seconds()))
	default:
		return fmt.Errorf("不支持的数据库类型: %s", config.ConnType)
	}

	// 创建数据库连接
	ctx, cancel := context.WithTimeout(context.Background(), DatabaseTestTimeout)
	defer cancel()

	db, err := sql.Open(config.ConnType, dsn)
	if err != nil {
		return fmt.Errorf("打开数据库连接失败: %v", err)
	}
	defer db.Close()

	// 测试连接
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("数据库连接测试失败: %v", err)
	}

	// 执行简单查询测试
	var result int
	query := "SELECT 1"
	if config.ConnType == ConnTypePostgres {
		query = "SELECT 1 as test"
	}

	err = db.QueryRowContext(ctx, query).Scan(&result)
	if err != nil {
		return fmt.Errorf("数据库查询测试失败: %v", err)
	}

	if result != 1 {
		return fmt.Errorf("数据库查询结果异常: %d", result)
	}

	return nil
}

// TestRDPConnection 测试RDP连接（简单的TCP端口测试）
func (cu *ConnectionUtils) TestRDPConnection(config *ConnectionConfig) error {
	if err := cu.validateConnectionConfig(config, ConnTypeRDP); err != nil {
		return err
	}

	// RDP连接测试主要是TCP端口可达性测试
	return cu.TestTCPConnection(config.Host, config.Port, config.Timeout)
}

// FormatAddress 格式化网络地址
func (cu *ConnectionUtils) FormatAddress(host string, port int) string {
	// 处理IPv6地址
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		return fmt.Sprintf("[%s]:%d", host, port)
	}
	return fmt.Sprintf("%s:%d", host, port)
}

// ParseAddress 解析网络地址
func (cu *ConnectionUtils) ParseAddress(address string) (host string, port int, err error) {
	host, portStr, err := net.SplitHostPort(address)
	if err != nil {
		return "", 0, fmt.Errorf("解析地址失败: %v", err)
	}

	port, err = strconv.Atoi(portStr)
	if err != nil {
		return "", 0, fmt.Errorf("解析端口失败: %v", err)
	}

	return host, port, nil
}

// ValidateAddress 验证网络地址格式
func (cu *ConnectionUtils) ValidateAddress(host string, port int) error {
	if host == "" {
		return fmt.Errorf("主机地址不能为空")
	}

	// 验证IP地址或域名格式
	if ip := net.ParseIP(host); ip == nil {
		// 如果不是IP地址，验证域名格式
		if !cu.isValidDomain(host) {
			return fmt.Errorf("无效的主机地址: %s", host)
		}
	}

	// 验证端口范围
	if port <= 0 || port > 65535 {
		return fmt.Errorf("端口号超出有效范围: %d", port)
	}

	return nil
}

// GetDefaultPort 获取指定连接类型的默认端口
func (cu *ConnectionUtils) GetDefaultPort(connType string) int {
	if port, exists := DefaultPorts[connType]; exists {
		return port
	}
	return 22 // SSH默认端口
}

// IsPortInUse 检查端口是否被占用
func (cu *ConnectionUtils) IsPortInUse(host string, port int) bool {
	timeout := 3 * time.Second
	conn, err := net.DialTimeout("tcp", cu.FormatAddress(host, port), timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// ResolveHostname 解析主机名为IP地址
func (cu *ConnectionUtils) ResolveHostname(hostname string) ([]string, error) {
	ips, err := net.LookupHost(hostname)
	if err != nil {
		return nil, fmt.Errorf("域名解析失败: %v", err)
	}
	return ips, nil
}

// validateConnectionConfig 验证连接配置
func (cu *ConnectionUtils) validateConnectionConfig(config *ConnectionConfig, expectedType string) error {
	if config == nil {
		return fmt.Errorf("连接配置不能为空")
	}

	if config.ConnType != expectedType {
		return fmt.Errorf("连接类型不匹配，期望: %s, 实际: %s", expectedType, config.ConnType)
	}

	if err := cu.ValidateAddress(config.Host, config.Port); err != nil {
		return err
	}

	if config.Username == "" && config.ConnType != ConnTypeRDP {
		return fmt.Errorf("用户名不能为空")
	}

	if config.Password == "" && config.PrivateKey == "" {
		return fmt.Errorf("密码和私钥不能同时为空")
	}

	if config.Timeout <= 0 {
		config.Timeout = DefaultConnectTimeout
	}

	return nil
}

// createSSHSigner 创建SSH签名器
func (cu *ConnectionUtils) createSSHSigner(privateKeyData string) (ssh.Signer, error) {
	// 解密私钥（如果加密的话）
	keyData, err := cu.credUtils.DecryptCredential(privateKeyData)
	if err != nil {
		// 如果解密失败，尝试直接使用原始数据
		keyData = privateKeyData
	}

	// 验证私钥格式
	if err := cu.credUtils.ValidatePrivateKey(keyData); err != nil {
		return nil, err
	}

	// 创建SSH签名器
	signer, err := ssh.ParsePrivateKey([]byte(keyData))
	if err != nil {
		return nil, fmt.Errorf("解析私钥失败: %v", err)
	}

	return signer, nil
}

// isValidDomain 验证域名格式
func (cu *ConnectionUtils) isValidDomain(domain string) bool {
	if len(domain) == 0 || len(domain) > 253 {
		return false
	}

	// 简单的域名格式验证
	parts := strings.Split(domain, ".")
	for _, part := range parts {
		if len(part) == 0 || len(part) > 63 {
			return false
		}
		
		for i, char := range part {
			if !((char >= 'a' && char <= 'z') ||
				(char >= 'A' && char <= 'Z') ||
				(char >= '0' && char <= '9') ||
				(char == '-' && i != 0 && i != len(part)-1)) {
				return false
			}
		}
	}

	return true
}

// 全局连接工具实例
var DefaultConnectionUtils = NewConnectionUtils()

// 便捷函数
func TestTCPConn(host string, port int) error {
	return DefaultConnectionUtils.TestTCPConnection(host, port, DefaultConnectTimeout)
}

func TestSSHConn(host string, port int, username, password string) error {
	config := &ConnectionConfig{
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
		ConnType: ConnTypeSSH,
		Timeout:  DefaultConnectTimeout,
	}
	return DefaultConnectionUtils.TestSSHConnection(config)
}

func FormatAddr(host string, port int) string {
	return DefaultConnectionUtils.FormatAddress(host, port)
}