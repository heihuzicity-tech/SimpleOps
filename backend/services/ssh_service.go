package services

import (
	"bastion/config"
	"bastion/models"
	"bastion/utils"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	mathrand "math/rand"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
	"github.com/sirupsen/logrus"
)

// SSHService SSH服务
type SSHService struct {
	db              *gorm.DB
	auditService    *AuditService
	recordingService *RecordingService
	sessions        map[string]*SSHSession // 内存中的SSH连接
	sessionsMu      sync.RWMutex
	redisSession    *RedisSessionService // Redis会话管理
}

// SSHSession SSH会话
type SSHSession struct {
	ID           string              `json:"id"`
	UserID       uint                `json:"user_id"`
	AssetID      uint                `json:"asset_id"`
	CredentialID uint                `json:"credential_id"`
	ClientConn   *ssh.Client         `json:"-"`
	SessionConn  *ssh.Session        `json:"-"`
	StdoutPipe   io.Reader           `json:"-"`
	StdinPipe    io.WriteCloser      `json:"-"`
	Status       string              `json:"status"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
	LastActive   time.Time           `json:"last_active"`
	Commands     []SSHCommand        `json:"commands,omitempty"`
	recorder     *SessionRecorder    `json:"-"` // 会话录制器
	mu           sync.RWMutex        `json:"-"`
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
	redisSessionService := NewRedisSessionService()
	if redisSessionService != nil {
		// 启动 Redis 会话清理任务
		redisSessionService.StartSessionCleanupTask()
	}
	
	// 验证录制服务状态
	if GlobalRecordingService == nil {
		logrus.Warn("SSH服务创建时，GlobalRecordingService 为 nil")
	} else {
		logrus.Info("SSH服务创建时，GlobalRecordingService 已正确初始化")
	}
	
	return &SSHService{
		db:              db,
		auditService:    NewAuditService(db),
		recordingService: GlobalRecordingService,
		sessions:        make(map[string]*SSHSession),
		redisSession:    redisSessionService,
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
	log.Printf("Attempting to connect to SSH server at %s", address)
	clientConn, err := ssh.Dial("tcp", address, sshConfig)
	if err != nil {
		log.Printf("Failed to connect to SSH server at %s: %v", address, err)
		return nil, fmt.Errorf("failed to connect to SSH server: %w", err)
	}
	log.Printf("Successfully connected to SSH server at %s", address)

	// 创建会话
	sessionConn, err := clientConn.NewSession()
	if err != nil {
		clientConn.Close()
		return nil, fmt.Errorf("failed to create SSH session: %w", err)
	}

	// 生成会话ID
	sessionID := s.generateSessionID()
	
	// 设置终端模式 - 必须在获取管道之前设置
	width := request.Width
	height := request.Height
	if width <= 0 {
		width = 80
	}
	if height <= 0 {
		height = 24
	}
	
	log.Printf("Requesting PTY for session %s with size %dx%d", sessionID, width, height)
	if err := sessionConn.RequestPty("xterm-256color", height, width, ssh.TerminalModes{
		ssh.ECHO:          1,     // 启用回显
		ssh.TTY_OP_ISPEED: 14400, // 输入速度
		ssh.TTY_OP_OSPEED: 14400, // 输出速度
		ssh.ICRNL:         1,     // 将回车转换为换行
		ssh.OPOST:         1,     // 启用输出处理
		ssh.ONLCR:         1,     // 将换行转换为回车换行
		ssh.IUTF8:         1,     // UTF-8 输入
	}); err != nil {
		sessionConn.Close()
		clientConn.Close()
		return nil, fmt.Errorf("failed to request pty: %w", err)
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

	// 启动shell
	log.Printf("Starting shell for session %s", sessionID)
	if err := sessionConn.Shell(); err != nil {
		session.Close()
		return nil, fmt.Errorf("failed to start shell: %w", err)
	}

	// ✅ 修复：减少初始化命令，只发送一个回车符
	go func() {
		time.Sleep(300 * time.Millisecond) // 等待shell启动
		log.Printf("Sending initial command to shell for session %s", sessionID)
		
		// 只发送一个换行符激活shell提示符
		if _, err := stdin.Write([]byte("\n")); err != nil {
			log.Printf("Failed to send initial newline to shell: %v", err)
		} else {
			log.Printf("Initial newline sent successfully to session %s", sessionID)
		}
	}()

	// 启动会话监控goroutine，检测SSH会话自然结束
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("SSH session monitor panic for %s: %v", sessionID, r)
			}
		}()
		
		// 等待SSH会话结束
		if err := sessionConn.Wait(); err != nil {
			log.Printf("SSH session %s ended with error: %v", sessionID, err)
			s.CloseSessionWithReason(sessionID, "SSH会话异常结束")
		} else {
			log.Printf("SSH session %s ended normally (user exit/logout)", sessionID)
			s.CloseSessionWithReason(sessionID, "用户正常退出")
		}
	}()

	// 保存会话到内存
	s.sessionsMu.Lock()
	s.sessions[sessionID] = session
	s.sessionsMu.Unlock()

	// 保存会话到 Redis
	if s.redisSession != nil {
		redisData := &RedisSessionData{
			SessionID:    sessionID,
			UserID:       userID,
			Username:     user.Username,
			AssetID:      request.AssetID,
			AssetName:    asset.Name,
			AssetAddress: fmt.Sprintf("%s:%d", asset.Address, asset.Port),
			CredentialID: request.CredentialID,
			Protocol:     "ssh",
			TTL:          config.GlobalConfig.Session.Timeout,
		}
		if err := s.redisSession.CreateSession(redisData); err != nil {
			logrus.WithError(err).Error("Failed to store session in Redis")
		}
	}

	// 🎬 启动会话录制（如果启用）
	if s.recordingService != nil {
		logrus.WithField("session_id", sessionID).Info("准备启动会话录制")
		if recorder, err := s.recordingService.StartRecording(sessionID, userID, request.AssetID, width, height); err != nil {
			logrus.WithError(err).WithField("session_id", sessionID).Error("启动会话录制失败")
		} else {
			logrus.WithFields(logrus.Fields{
				"session_id": sessionID,
				"user_id":    userID,
				"asset_id":   request.AssetID,
			}).Info("会话录制已启动")
			
			// 将录制器存储到会话中以便后续使用
			session.recorder = recorder
		}
	} else {
		logrus.WithField("session_id", sessionID).Warn("录制服务未初始化，跳过录制")
	}

	// 记录会话开始到审计日志（统一使用审计服务）
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

// GetSessionsFromRedis 从 Redis 获取用户的所有活跃会话
func (s *SSHService) GetSessionsFromRedis(userID uint) ([]*SSHSessionResponse, error) {
	if s.redisSession == nil {
		return s.GetSessions(userID)
	}

	redisSessions, err := s.redisSession.GetActiveSessionsByUser(userID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get sessions from Redis")
		return s.GetSessions(userID) // 备选方案
	}

	var sessions []*SSHSessionResponse
	for _, redisSession := range redisSessions {
		sessions = append(sessions, &SSHSessionResponse{
			ID:         redisSession.SessionID,
			Status:     redisSession.Status,
			AssetName:  redisSession.AssetName,
			AssetAddr:  redisSession.AssetAddress,
			Username:   redisSession.Username,
			CreatedAt:  redisSession.StartTime,
			LastActive: redisSession.LastActive,
		})
	}

	return sessions, nil
}

// GetSessions 获取用户的所有活跃会话 (内存版本)
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
	return s.CloseSessionWithReason(sessionID, "API调用关闭")
}

// CloseSessionWithReason 带原因的关闭SSH会话
func (s *SSHService) CloseSessionWithReason(sessionID string, reason string) error {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		// 即使内存中没有会话，也要尝试清理Redis和数据库
		logrus.WithField("session_id", sessionID).Warn("内存中未找到会话，但仍尝试清理Redis和数据库")
		s.cleanupSessionFromAllSources(sessionID)
		return fmt.Errorf("session not found in memory")
	}

	// 统一清理所有数据源中的会话
	s.cleanupSessionFromAllSources(sessionID)

	// 获取用户信息
	var user models.User
	if err := s.db.Where("id = ?", session.UserID).First(&user).Error; err == nil {
		// 记录会话结束到审计日志，包含关闭原因
		go s.auditService.RecordSessionEnd(sessionID, reason)

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

// cleanupSessionFromAllSources 统一清理所有数据源中的会话
func (s *SSHService) cleanupSessionFromAllSources(sessionID string) {
	now := time.Now()
	
	// 🎬 停止会话录制
	if s.recordingService != nil {
		logrus.WithField("session_id", sessionID).Info("准备停止会话录制")
		if err := s.recordingService.StopRecording(sessionID); err != nil {
			logrus.WithError(err).WithField("session_id", sessionID).Error("停止会话录制失败")
		} else {
			logrus.WithField("session_id", sessionID).Info("会话录制已停止")
		}
	} else {
		logrus.WithField("session_id", sessionID).Warn("录制服务未初始化，跳过录制停止")
	}
	
	// 1. 从Redis中删除会话
	if s.redisSession != nil {
		if err := s.redisSession.CloseSession(sessionID, "closed"); err != nil {
			logrus.WithError(err).WithField("session_id", sessionID).Error("Failed to close session in Redis")
		} else {
			logrus.WithField("session_id", sessionID).Info("成功从Redis中清理会话")
		}
	}

	// 2. 更新数据库中的会话状态
	updates := map[string]interface{}{
		"status":     "closed",
		"end_time":   now,
		"updated_at": now,
	}
	if err := s.db.Model(&models.SessionRecord{}).Where("session_id = ?", sessionID).Updates(updates).Error; err != nil {
		logrus.WithError(err).WithField("session_id", sessionID).Error("Failed to update session status in database")
	} else {
		logrus.WithField("session_id", sessionID).Info("成功在数据库中更新会话状态")
		
		// 🔧 修复：移除全局广播，改为精确通知相关用户
		// 获取会话的用户信息来进行精确通知
		var sessionRecord models.SessionRecord
		if err := s.db.Where("session_id = ?", sessionID).First(&sessionRecord).Error; err == nil {
			if GlobalWebSocketService != nil {
				// 只向会话所属用户发送结束通知
				endMsg := WSMessage{
					Type:      SessionEnd,
					Data:      map[string]interface{}{
						"session_id": sessionID,
						"status":     "closed",
						"end_time":   now,
						"reason":     "session_cleanup",
					},
					Timestamp: now,
					SessionID: sessionID,
				}
				
				// 精确发送给会话所属用户，不进行全局广播
				GlobalWebSocketService.SendMessageToUser(sessionRecord.UserID, endMsg)
				
				logrus.WithFields(logrus.Fields{
					"session_id": sessionID,
					"user_id":    sessionRecord.UserID,
				}).Info("已向会话用户发送结束通知")
			}
		}
	}
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
		Timeout:         30 * time.Second, // ✅ 修复：设置合理的连接超时时间
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
	// 创建会话记录
	sessionRecord := &models.SessionRecord{
		SessionID:    session.ID,
		UserID:       session.UserID,
		AssetID:      session.AssetID,
		AssetName:    asset.Name,
		AssetAddress: fmt.Sprintf("%s:%d", asset.Address, asset.Port),
		CredentialID: session.CredentialID,
		Protocol:     "ssh",
		IP:           "127.0.0.1", // 这里需要从上下文中获取真实 IP
		Status:       "active",
		StartTime:    session.CreatedAt,
		IsTerminated: nil, // 设置为 nil 表示未被终止
		CreatedAt:    session.CreatedAt,
		UpdatedAt:    session.CreatedAt,
	}

	// 获取用户名
	var user models.User
	if err := s.db.Where("id = ?", session.UserID).First(&user).Error; err == nil {
		sessionRecord.Username = user.Username
	}

	// 保存到数据库
	return s.db.Create(sessionRecord).Error
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

	if session.Status != "active" || session.SessionConn == nil {
		return false
	}

	// ✅ 增强：检查SSH连接是否真实可用
	return session.IsConnectionAlive()
}

// IsConnectionAlive 检查SSH连接是否真实存活
func (session *SSHSession) IsConnectionAlive() bool {
	if session.ClientConn == nil || session.SessionConn == nil {
		return false
	}

	// ✅ 修复：使用更轻量的方式检查连接状态
	// 尝试发送一个简单的keepalive请求来检测连接状态
	// 如果连接已断开，这会返回错误
	_, _, err := session.ClientConn.SendRequest("keepalive@openssh.com", false, nil)
	if err != nil {
		log.Printf("SSH connection check failed for session %s: %v", session.ID, err)
		return false
	}
	return true
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
		shouldCleanup := false
		cleanupReason := ""

		// 检查超时 - 增加容错时间
		if session.LastActive.Before(cutoff) {
			shouldCleanup = true
			cleanupReason = "timeout"
		}

		// ✅ 修复：只有在会话真正超时时才检查连接状态，避免过度清理
		if shouldCleanup && !session.IsConnectionAlive() {
			log.Printf("Cleaning up session %s: reason=%s, last_active=%v", 
				id, cleanupReason, session.LastActive)

			// 更新数据库中的会话状态
			now := time.Now()
			updates := map[string]interface{}{
				"status":     cleanupReason,
				"end_time":   now,
				"updated_at": now,
			}
			if err := s.db.Model(&models.SessionRecord{}).Where("session_id = ?", id).Updates(updates).Error; err != nil {
				logrus.WithError(err).Errorf("Failed to update session %s status in database", id)
			}

			// 记录会话结束到审计日志
			go s.auditService.RecordSessionEnd(id, cleanupReason)

			session.Close()
			delete(s.sessions, id)
		} else if !shouldCleanup {
			// 会话仍然活跃，更新活动时间
			session.UpdateActivity()
		}
	}
}

// StartSessionCleanup 启动会话清理任务
// 注意：此功能已禁用，统一由 UnifiedSessionService 处理
func (s *SSHService) StartSessionCleanup(ctx context.Context) {
	log.Printf("SSH session cleanup 已禁用，统一由 UnifiedSessionService 处理")
	// 不再启动独立的清理任务，避免竞态条件
	<-ctx.Done()
}

// HealthCheckSessions 立即健康检查所有会话
func (s *SSHService) HealthCheckSessions() int {
	s.sessionsMu.RLock()
	sessionCount := len(s.sessions)
	s.sessionsMu.RUnlock()

	log.Printf("Starting health check for %d sessions", sessionCount)
	
	// 触发立即清理
	s.CleanupInactiveSessions()

	s.sessionsMu.RLock()
	activeCount := len(s.sessions)
	s.sessionsMu.RUnlock()

	cleanedCount := sessionCount - activeCount
	if cleanedCount > 0 {
		log.Printf("Health check completed: cleaned %d inactive sessions, %d remaining", 
			cleanedCount, activeCount)
	}

	return activeCount
}

// SyncSessionStatusToDB 强制同步会话状态到数据库
func (s *SSHService) SyncSessionStatusToDB(sessionID, status, reason string) {
	now := time.Now()
	updates := map[string]interface{}{
		"status":     status,
		"end_time":   now,
		"updated_at": now,
	}
	
	if err := s.db.Model(&models.SessionRecord{}).Where("session_id = ?", sessionID).Updates(updates).Error; err != nil {
		log.Printf("Failed to sync session %s status to database: %v", sessionID, err)
	} else {
		log.Printf("Successfully synced session %s status '%s' to database", sessionID, status)
		
		// 🚀 立即广播状态变更，确保监控界面实时更新
		if GlobalWebSocketService != nil && status == "closed" {
			endMsg := WSMessage{
				Type:      SessionEnd,
				Data:      map[string]interface{}{
					"session_id": sessionID,
					"status":     status,
					"end_time":   now,
					"reason":     reason,
				},
				Timestamp: now,
				SessionID: sessionID,
			}
			
			data, _ := json.Marshal(endMsg)
			GlobalWebSocketService.manager.broadcast <- data
			
			log.Printf("Broadcasted session end event for %s", sessionID)
		}
	}
}

// ForceCleanupAllSessions 强制清理所有会话和数据库状态
func (s *SSHService) ForceCleanupAllSessions() error {
	s.sessionsMu.Lock()
	defer s.sessionsMu.Unlock()

	memorySessionCount := len(s.sessions)
	log.Printf("Force cleaning up all %d memory sessions", memorySessionCount)

	// 清理内存中的会话
	for id, session := range s.sessions {
		log.Printf("Force closing session %s", id)
		session.Close()
		delete(s.sessions, id)
	}

	// 清理 Redis 中的会话
	redisCleanedCount := 0
	if s.redisSession != nil {
		count, err := s.redisSession.ForceCleanupAllSessions()
		if err != nil {
			logrus.WithError(err).Error("Failed to cleanup Redis sessions")
		} else {
			redisCleanedCount = count
		}
	}

	// 更新数据库中所有活跃会话的状态
	now := time.Now()
	updates := map[string]interface{}{
		"status":     "closed",
		"end_time":   now,
		"updated_at": now,
	}

	result := s.db.Model(&models.SessionRecord{}).Where("status = ?", "active").Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("failed to update database session status: %w", result.Error)
	}

	log.Printf("Force cleanup completed: cleaned %d memory sessions, %d Redis sessions, updated %d database records", 
		memorySessionCount, redisCleanedCount, result.RowsAffected)

	return nil
}
