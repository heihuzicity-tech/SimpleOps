package services

import (
	"bastion/config"
	"bastion/models"
	"bastion/utils"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	mathrand "math/rand"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
)

// SSHService SSH服务
type SSHService struct {
	db           *gorm.DB
	auditService *AuditService
	sessions     map[string]*SSHSession
	sessionsMu   sync.RWMutex
}

// SSHSession SSH会话
type SSHSession struct {
	ID           string       `json:"id"`
	UserID       uint         `json:"user_id"`
	AssetID      uint         `json:"asset_id"`
	CredentialID uint         `json:"credential_id"`
	ClientConn   *ssh.Client  `json:"-"`
	SessionConn  *ssh.Session `json:"-"`
	StdoutPipe   io.Reader    `json:"-"`
	StdinPipe    io.WriteCloser `json:"-"`
	Status       string       `json:"status"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	LastActive   time.Time    `json:"last_active"`
	Commands     []SSHCommand `json:"commands,omitempty"`
	mu           sync.RWMutex `json:"-"`
}

// SSHCommand SSH命令记录
type SSHCommand struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	Command   string    `json:"command"`
	Output    string    `json:"output"`
	ExitCode  int       `json:"exit_code"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Duration  int64     `json:"duration"` // 毫秒
}

// SSHSessionRequest SSH会话创建请求
type SSHSessionRequest struct {
	AssetID      uint   `json:"asset_id" binding:"required"`
	CredentialID uint   `json:"credential_id" binding:"required"`
	Protocol     string `json:"protocol" binding:"required,oneof=ssh"`
	Width        int    `json:"width" binding:"omitempty,min=1"`
	Height       int    `json:"height" binding:"omitempty,min=1"`
}

// SSHSessionResponse SSH会话响应
type SSHSessionResponse struct {
	ID         string    `json:"id"`
	Status     string    `json:"status"`
	AssetName  string    `json:"asset_name"`
	AssetAddr  string    `json:"asset_addr"`
	Username   string    `json:"username"`
	CreatedAt  time.Time `json:"created_at"`
	LastActive time.Time `json:"last_active"`
}

// NewSSHService 创建SSH服务实例
func NewSSHService(db *gorm.DB) *SSHService {
	return &SSHService{
		db:           db,
		auditService: NewAuditService(db),
		sessions:     make(map[string]*SSHSession),
	}
}

// CreateSession 创建SSH会话
func (s *SSHService) CreateSession(userID uint, request *SSHSessionRequest) (*SSHSessionResponse, error) {
	// 获取资产信息
	var asset models.Asset
	if err := s.db.Where("id = ?", request.AssetID).First(&asset).Error; err != nil {
		return nil, fmt.Errorf("asset not found: %w", err)
	}

	// 获取凭证信息并验证与资产的关联关系
	var credential models.Credential
	if err := s.db.Where("id = ?", request.CredentialID).First(&credential).Error; err != nil {
		return nil, fmt.Errorf("credential not found: %w", err)
	}

	// 验证凭证与资产的关联关系
	var count int64
	if err := s.db.Table("asset_credentials").Where("asset_id = ? AND credential_id = ?", request.AssetID, request.CredentialID).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to verify asset-credential relationship: %w", err)
	}
	if count == 0 {
		return nil, fmt.Errorf("credential is not associated with the asset")
	}

	// 获取用户信息
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// 创建SSH客户端配置
	sshConfig, err := s.createSSHConfig(credential)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH config: %w", err)
	}

	// 建立SSH连接
	address := fmt.Sprintf("%s:%d", asset.Address, asset.Port)
	clientConn, err := ssh.Dial("tcp", address, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH server: %w", err)
	}

	// 创建会话
	sessionConn, err := clientConn.NewSession()
	if err != nil {
		clientConn.Close()
		return nil, fmt.Errorf("failed to create SSH session: %w", err)
	}

	// 获取stdout和stdin管道
	stdout, err := sessionConn.StdoutPipe()
	if err != nil {
		sessionConn.Close()
		clientConn.Close()
		return nil, fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stdin, err := sessionConn.StdinPipe()
	if err != nil {
		sessionConn.Close()
		clientConn.Close()
		return nil, fmt.Errorf("failed to get stdin pipe: %w", err)
	}

	// 生成会话ID
	sessionID := s.generateSessionID()

	// 创建会话对象
	session := &SSHSession{
		ID:           sessionID,
		UserID:       userID,
		AssetID:      request.AssetID,
		CredentialID: request.CredentialID,
		ClientConn:   clientConn,
		SessionConn:  sessionConn,
		StdoutPipe:   stdout,
		StdinPipe:    stdin,
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		LastActive:   time.Now(),
		Commands:     make([]SSHCommand, 0),
	}

	// 设置终端模式
	if request.Width > 0 && request.Height > 0 {
		if err := sessionConn.RequestPty("xterm", request.Height, request.Width, ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}); err != nil {
			session.Close()
			return nil, fmt.Errorf("failed to request pty: %w", err)
		}
	}

	// 启动shell
	if err := sessionConn.Shell(); err != nil {
		session.Close()
		return nil, fmt.Errorf("failed to start shell: %w", err)
	}

	// 保存会话
	s.sessionsMu.Lock()
	s.sessions[sessionID] = session
	s.sessionsMu.Unlock()

	// 记录会话开始到审计日志
	clientIP := "127.0.0.1" // 这里需要从上下文中获取真实IP
	go s.auditService.RecordSessionStart(
		sessionID,
		userID,
		user.Username,
		asset.ID,
		asset.Name,
		fmt.Sprintf("%s:%d", asset.Address, asset.Port),
		credential.ID,
		request.Protocol,
		clientIP,
	)

	// 记录操作日志
	go s.auditService.RecordOperationLog(
		userID,
		user.Username,
		clientIP,
		"POST",
		"/api/v1/ssh/sessions",
		"create",
		"session",
		0,
		201,
		"SSH session created successfully",
		request,
		nil,
		0,
	)

	return &SSHSessionResponse{
		ID:         sessionID,
		Status:     "active",
		AssetName:  asset.Name,
		AssetAddr:  fmt.Sprintf("%s:%d", asset.Address, asset.Port),
		Username:   credential.Username,
		CreatedAt:  session.CreatedAt,
		LastActive: session.LastActive,
	}, nil
}

// GetSession 获取SSH会话
func (s *SSHService) GetSession(sessionID string) (*SSHSession, error) {
	s.sessionsMu.RLock()
	defer s.sessionsMu.RUnlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	return session, nil
}

// GetSessions 获取用户的所有活跃会话
func (s *SSHService) GetSessions(userID uint) ([]*SSHSessionResponse, error) {
	s.sessionsMu.RLock()
	defer s.sessionsMu.RUnlock()

	var sessions []*SSHSessionResponse
	for _, session := range s.sessions {
		if session.UserID == userID {
			// 获取资产信息
			var asset models.Asset
			if err := s.db.Where("id = ?", session.AssetID).First(&asset).Error; err != nil {
				continue
			}

			// 获取凭证信息
			var credential models.Credential
			if err := s.db.Where("id = ?", session.CredentialID).First(&credential).Error; err != nil {
				continue
			}

			sessions = append(sessions, &SSHSessionResponse{
				ID:         session.ID,
				Status:     session.Status,
				AssetName:  asset.Name,
				AssetAddr:  fmt.Sprintf("%s:%d", asset.Address, asset.Port),
				Username:   credential.Username,
				CreatedAt:  session.CreatedAt,
				LastActive: session.LastActive,
			})
		}
	}

	return sessions, nil
}

// CloseSession 关闭SSH会话
func (s *SSHService) CloseSession(sessionID string) error {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found")
	}

	// 获取用户信息
	var user models.User
	if err := s.db.Where("id = ?", session.UserID).First(&user).Error; err == nil {
		// 记录会话结束到审计日志
		go s.auditService.RecordSessionEnd(sessionID, "closed")

		// 记录操作日志
		go s.auditService.RecordOperationLog(
			session.UserID,
			user.Username,
			"127.0.0.1",
			"DELETE",
			fmt.Sprintf("/api/v1/ssh/sessions/%s", sessionID),
			"delete",
			"session",
			0,
			200,
			"SSH session closed successfully",
			nil,
			nil,
			0,
		)
	}

	session.Close()
	delete(s.sessions, sessionID)

	return nil
}

// WriteToSession 向会话写入数据
func (s *SSHService) WriteToSession(sessionID string, data []byte) error {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if session.SessionConn == nil {
		return fmt.Errorf("session connection is closed")
	}

	if session.StdinPipe == nil {
		return fmt.Errorf("stdin pipe is not available")
	}

	_, err = session.StdinPipe.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write to session: %w", err)
	}

	// 更新最后活动时间
	session.LastActive = time.Now()
	session.UpdatedAt = time.Now()

	return nil
}

// ReadFromSession 从会话读取数据
func (s *SSHService) ReadFromSession(sessionID string) (io.Reader, error) {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	if session.SessionConn == nil {
		return nil, fmt.Errorf("session connection is closed")
	}

	if session.StdoutPipe == nil {
		return nil, fmt.Errorf("stdout pipe is not available")
	}

	return session.StdoutPipe, nil
}

// ResizeSession 调整会话窗口大小
func (s *SSHService) ResizeSession(sessionID string, width, height int) error {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if session.SessionConn == nil {
		return fmt.Errorf("session connection is closed")
	}

	err = session.SessionConn.WindowChange(height, width)
	if err != nil {
		return fmt.Errorf("failed to resize session: %w", err)
	}

	return nil
}

// RecordCommand 记录命令执行
func (s *SSHService) RecordCommand(sessionID, command, output string, exitCode int, startTime time.Time, endTime *time.Time) error {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	// 记录命令到审计日志
	go s.auditService.RecordCommandLog(
		sessionID,
		session.UserID,
		"", // 需要从数据库获取用户名
		session.AssetID,
		command,
		output,
		exitCode,
		startTime,
		endTime,
	)

	return nil
}

// createSSHConfig 创建SSH客户端配置
func (s *SSHService) createSSHConfig(credential models.Credential) (*ssh.ClientConfig, error) {
	config := &ssh.ClientConfig{
		User:            credential.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // 注意：生产环境需要验证主机密钥
		Timeout:         time.Duration(config.GlobalConfig.SSH.Timeout) * time.Second,
	}

	if credential.Type == "password" {
		// 解密密码
		password, err := utils.DecryptPassword(credential.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt password: %w", err)
		}
		config.Auth = append(config.Auth, ssh.Password(password))
	} else if credential.Type == "key" {
		// 解析私钥
		signer, err := ssh.ParsePrivateKey([]byte(credential.PrivateKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		config.Auth = append(config.Auth, ssh.PublicKeys(signer))
	}

	return config, nil
}

// generateSessionID 生成会话ID
func (s *SSHService) generateSessionID() string {
	return fmt.Sprintf("ssh-%d-%d", time.Now().Unix(), mathrand.Int63())
}

// recordSessionToDB 记录会话到数据库
func (s *SSHService) recordSessionToDB(session *SSHSession, asset models.Asset, credential models.Credential) error {
	// 这里可以记录会话信息到数据库
	// 为了简化，暂时只记录日志
	log.Printf("Session created: ID=%s, User=%d, Asset=%s, Credential=%s",
		session.ID, session.UserID, asset.Name, credential.Username)
	return nil
}

// Close 关闭SSH会话连接
func (session *SSHSession) Close() {
	session.mu.Lock()
	defer session.mu.Unlock()

	session.Status = "closed"
	session.UpdatedAt = time.Now()

	if session.SessionConn != nil {
		session.SessionConn.Close()
		session.SessionConn = nil
	}

	if session.ClientConn != nil {
		session.ClientConn.Close()
		session.ClientConn = nil
	}
}

// IsActive 检查会话是否活跃
func (session *SSHSession) IsActive() bool {
	session.mu.RLock()
	defer session.mu.RUnlock()

	return session.Status == "active" && session.SessionConn != nil
}

// UpdateActivity 更新活动时间
func (session *SSHSession) UpdateActivity() {
	session.mu.Lock()
	defer session.mu.Unlock()

	session.LastActive = time.Now()
	session.UpdatedAt = time.Now()
}

// GenerateSSHKeyPair 生成SSH密钥对
func (s *SSHService) GenerateSSHKeyPair() (string, string, error) {
	// 生成RSA私钥
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate private key: %w", err)
	}

	// 编码私钥
	privateKeyPEM := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	}
	privateKeyStr := string(pem.EncodeToMemory(privateKeyPEM))

	// 生成公钥
	publicKey, err := ssh.NewPublicKey(&privateKey.PublicKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate public key: %w", err)
	}

	publicKeyStr := string(ssh.MarshalAuthorizedKey(publicKey))

	return privateKeyStr, publicKeyStr, nil
}

// CleanupInactiveSessions 清理不活跃的会话
func (s *SSHService) CleanupInactiveSessions() {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()

	timeout := time.Duration(config.GlobalConfig.Session.Timeout) * time.Second
	cutoff := time.Now().Add(-timeout)

	for id, session := range s.sessions {
		if session.LastActive.Before(cutoff) {
			log.Printf("Cleaning up inactive session: %s", id)

			// 记录会话超时到审计日志
			go s.auditService.RecordSessionEnd(id, "timeout")

			session.Close()
			delete(s.sessions, id)
		}
	}
}

// StartSessionCleanup 启动会话清理任务
func (s *SSHService) StartSessionCleanup(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute) // 每5分钟清理一次
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.CleanupInactiveSessions()
		}
	}
}
