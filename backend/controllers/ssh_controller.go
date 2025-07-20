package controllers

import (
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// SSHController SSH控制器
type SSHController struct {
	sshService *services.SSHService
	upgrader   websocket.Upgrader
}

// WebSocketMessage WebSocket消息结构
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

// TerminalMessage 终端消息
type TerminalMessage struct {
	Type      string `json:"type"`
	Data      string `json:"data"`
	Rows      int    `json:"rows,omitempty"`
	Cols      int    `json:"cols,omitempty"`
	Command   string `json:"command,omitempty"`
	SessionID string `json:"session_id,omitempty"` // 🔧 修复：添加session_id字段
}

// WebSocketConnection WebSocket连接包装
type WebSocketConnection struct {
	conn         *websocket.Conn
	intercepted  *services.InterceptedConn // 录制拦截器
	sessionID    string
	userID       uint
	mu           sync.Mutex
}

// NewSSHController 创建SSH控制器实例
func NewSSHController(sshService *services.SSHService) *SSHController {
	return &SSHController{
		sshService: sshService,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// 在生产环境中应该检查Origin
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}
}

// CreateSession 创建SSH会话
// @Summary      创建SSH会话
// @Description  创建新的SSH会话连接
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body services.SSHSessionRequest true "SSH会话创建请求"
// @Success      201  {object}  map[string]interface{}  "创建成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产或凭证不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions [post]
func (sc *SSHController) CreateSession(c *gin.Context) {
	var request services.SSHSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)

	// 创建SSH会话
	log.Printf("Creating SSH session for user %d to asset %d", user.ID, request.AssetID)
	sessionResp, err := sc.sshService.CreateSession(user.ID, &request)
	if err != nil {
		log.Printf("Failed to create SSH session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create SSH session: " + err.Error(),
		})
		return
	}
	log.Printf("SSH session created successfully: %s", sessionResp.ID)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    sessionResp,
	})
}

// GetSessions 获取用户的SSH会话列表
// @Summary      获取SSH会话列表
// @Description  获取当前用户的所有活跃SSH会话
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions [get]
func (sc *SSHController) GetSessions(c *gin.Context) {
	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)

	// 获取用户的SSH会话
	sessions, err := sc.sshService.GetSessions(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get SSH sessions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    sessions,
	})
}

// CloseSession 关闭SSH会话
// @Summary      关闭SSH会话
// @Description  关闭指定的SSH会话
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Success      200  {object}  map[string]interface{}  "关闭成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "会话不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions/{id} [delete]
func (sc *SSHController) CloseSession(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	// 验证会话是否属于当前用户
	session, err := sc.sshService.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)
	if session.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Access denied",
		})
		return
	}

	// 关闭会话
	err = sc.sshService.CloseSession(sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to close session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Session closed successfully",
	})
}

// HandleWebSocket 处理WebSocket连接
func (sc *SSHController) HandleWebSocket(c *gin.Context) {
	sessionID := c.Param("id")
	log.Printf("WebSocket connection request for session: %s", sessionID)
	
	if sessionID == "" {
		log.Printf("WebSocket connection failed: Session ID is required")
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		log.Printf("WebSocket connection failed: User not found for session %s", sessionID)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)
	log.Printf("WebSocket connection for session %s by user %s", sessionID, user.Username)

	// 验证会话是否存在和属于当前用户
	session, err := sc.sshService.GetSession(sessionID)
	if err != nil {
		log.Printf("WebSocket connection failed: Session %s not found: %v", sessionID, err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found",
		})
		return
	}

	if session.UserID != user.ID {
		log.Printf("WebSocket connection failed: Access denied for session %s, user %d vs %d", sessionID, session.UserID, user.ID)
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Access denied",
		})
		return
	}

	log.Printf("WebSocket session validation passed for session %s", sessionID)

	// 升级HTTP连接到WebSocket
	log.Printf("Attempting to upgrade WebSocket connection for session %s", sessionID)
	wsConn, err := sc.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket for session %s: %v", sessionID, err)
		return
	}
	
	log.Printf("WebSocket upgraded successfully for session %s", sessionID)

	// 🎬 集成录制拦截器
	var interceptedConn *services.InterceptedConn
	if services.GlobalRecordingService != nil {
		interceptedConn = services.GlobalRecordingService.InterceptWebSocketConnection(wsConn, sessionID)
		log.Printf("录制拦截器已集成到WebSocket连接，会话ID: %s", sessionID)
	} else {
		// 如果录制服务不可用，使用原始连接
		interceptedConn = &services.InterceptedConn{Conn: wsConn}
		log.Printf("录制服务不可用，使用原始WebSocket连接，会话ID: %s", sessionID)
	}

	// 创建WebSocket连接包装
	wsWrapper := &WebSocketConnection{
		conn:        wsConn,            // 原始连接用于WebSocket通信
		intercepted: interceptedConn,   // 拦截器用于录制
		sessionID:   sessionID,
		userID:      user.ID,
	}

	// 处理WebSocket连接
	sc.handleWebSocketConnection(wsWrapper)
}

// handleWebSocketConnection 处理WebSocket连接
func (sc *SSHController) handleWebSocketConnection(wsConn *WebSocketConnection) {
	// 注册到全局WebSocket服务，以便接收管理消息
	var wsClient *services.Client
	if services.GlobalWebSocketService != nil {
		// 获取用户信息用于注册
		var user models.User
		if err := utils.GetDB().Where("id = ?", wsConn.userID).First(&user).Error; err == nil {
			// 创建WebSocket客户端
			wsClient = &services.Client{
				ID:         fmt.Sprintf("ssh-%s", wsConn.sessionID),
				UserID:     wsConn.userID,
				Username:   user.Username,
				Role:       "ssh_terminal",
				Connection: wsConn.conn,
				Send:       make(chan []byte, 256),
				Manager:    nil, // 将在注册时设置
				LastPong:   time.Now(),
			}
			
			// 注册到WebSocket服务
			services.GlobalWebSocketService.RegisterSSHClient(wsClient)
			log.Printf("SSH WebSocket client registered for session %s, user %s", wsConn.sessionID, user.Username)
			
			// 启动管理消息处理协程
			go sc.handleManagementMessages(wsClient, wsConn)
		}
	}

	defer func() {
		// 注销WebSocket客户端
		if wsClient != nil && services.GlobalWebSocketService != nil {
			services.GlobalWebSocketService.UnregisterSSHClient(wsClient)
			close(wsClient.Send)
			log.Printf("SSH WebSocket client unregistered for session %s", wsConn.sessionID)
		}
		
		wsConn.conn.Close()
		// ✅ 修复：WebSocket断开时优雅清理SSH会话，添加延迟避免过快清理
		log.Printf("WebSocket disconnected for session %s, scheduling SSH session cleanup", wsConn.sessionID)
		
		// 🚀 立即同步清理所有数据源中的会话状态
		log.Printf("WebSocket disconnected for session %s, synchronizing cleanup across all data sources", wsConn.sessionID)
		
		// 同步处理，确保立即生效
		if err := sc.sshService.CloseSessionWithReason(wsConn.sessionID, "用户关闭标签页"); err != nil {
			log.Printf("Failed to cleanup SSH session %s: %v", wsConn.sessionID, err)
			
			// 如果CloseSessionWithReason失败，则强制同步数据库状态
			sc.sshService.SyncSessionStatusToDB(wsConn.sessionID, "closed", "用户关闭标签页(强制清理)")
		} else {
			log.Printf("Successfully cleaned up SSH session %s on WebSocket disconnect", wsConn.sessionID)
		}
		
		// 🔧 修复：精确通知相关用户，避免全局广播误杀
		if services.GlobalWebSocketService != nil {
			// 获取会话信息来进行精确通知
			var sessionRecord models.SessionRecord
			if err := utils.GetDB().Where("session_id = ?", wsConn.sessionID).First(&sessionRecord).Error; err == nil {
				// 创建会话结束消息
				endMsg := services.WSMessage{
					Type: services.SessionEnd,
					Data: map[string]interface{}{
						"session_id": wsConn.sessionID,
						"status":     "closed",
						"end_time":   time.Now(),
						"reason":     "user_disconnect",
					},
					Timestamp: time.Now(),
					SessionID: wsConn.sessionID,
				}
				
				// 只向会话所属用户发送消息，不进行全局广播
				services.GlobalWebSocketService.SendMessageToUser(sessionRecord.UserID, endMsg)
				log.Printf("Sent precise session end notification to user %d for session %s", sessionRecord.UserID, wsConn.sessionID)
			} else {
				log.Printf("Warning: Could not find session record for %s, skipping WebSocket notification", wsConn.sessionID)
			}
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 启动数据传输goroutine
	go sc.handleSSHOutput(ctx, wsConn)
	go sc.handleWebSocketInput(ctx, wsConn)

	// 等待连接结束
	<-ctx.Done()
}

// handleManagementMessages 处理来自WebSocket服务的管理消息
func (sc *SSHController) handleManagementMessages(wsClient *services.Client, wsConn *WebSocketConnection) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Management message handler panic: %v", r)
		}
	}()

	for {
		select {
		case data, ok := <-wsClient.Send:
			if !ok {
				log.Printf("Management message channel closed for session %s", wsConn.sessionID)
				return
			}
			
			// 解析管理消息
			var wsMessage services.WSMessage
			if err := json.Unmarshal(data, &wsMessage); err != nil {
				log.Printf("Failed to unmarshal management message: %v", err)
				continue
			}
			
			log.Printf("Received management message for session %s: %s", wsConn.sessionID, wsMessage.Type)
			
			// 处理不同类型的管理消息
			switch wsMessage.Type {
			case services.ForceTerminate:
				sc.handleForceTerminate(wsConn, wsMessage)
			case services.SessionWarning:
				sc.handleSessionWarning(wsConn, wsMessage)
			case services.SystemAlert:
				sc.handleSystemAlert(wsConn, wsMessage)
			default:
				log.Printf("Unknown management message type: %s", wsMessage.Type)
			}
		}
	}
}

// handleForceTerminate 处理强制终止消息
func (sc *SSHController) handleForceTerminate(wsConn *WebSocketConnection, wsMessage services.WSMessage) {
	log.Printf("Processing force terminate for session %s", wsConn.sessionID)
	
	// 🔧 修复：检查session_id是否匹配，避免误杀其他终端
	var targetSessionID string
	var reason string = "会话已被管理员强制终止"
	var adminUser string = "未知管理员"
	
	if wsMessage.Data != nil {
		if dataMap, ok := wsMessage.Data.(map[string]interface{}); ok {
			if sessionId, ok := dataMap["session_id"].(string); ok {
				targetSessionID = sessionId
			}
			if r, ok := dataMap["reason"].(string); ok {
				reason = r
			}
			if admin, ok := dataMap["admin_user"].(string); ok {
				adminUser = admin
			}
		}
	}
	
	// 检查session_id是否匹配
	if targetSessionID != "" && targetSessionID != wsConn.sessionID {
		log.Printf("Force terminate message for session %s ignored by session %s (不匹配)", targetSessionID, wsConn.sessionID)
		return
	}
	
	log.Printf("Force terminate message validated for session %s", wsConn.sessionID)
	
	// 转换为终端消息格式
	terminalMessage := TerminalMessage{
		Type:      "force_terminate",
		Data:      reason,
		Command:   adminUser,
		SessionID: wsConn.sessionID, // 🔧 修复：包含session_id以便前端验证
	}
	
	// 发送强制终止消息到前端
	wsConn.mu.Lock()
	err := wsConn.conn.WriteJSON(terminalMessage)
	wsConn.mu.Unlock()
	
	if err != nil {
		log.Printf("Failed to send force terminate message: %v", err)
	} else {
		log.Printf("Force terminate message sent to session %s", wsConn.sessionID)
	}
	
	// 给前端一点时间处理消息，然后关闭连接
	time.Sleep(1 * time.Second)
	wsConn.conn.Close()
}

// handleSessionWarning 处理会话警告消息
func (sc *SSHController) handleSessionWarning(wsConn *WebSocketConnection, wsMessage services.WSMessage) {
	terminalMessage := TerminalMessage{
		Type: "warning",
		Data: "管理员警告",
	}
	
	if wsMessage.Data != nil {
		if dataMap, ok := wsMessage.Data.(map[string]interface{}); ok {
			if message, ok := dataMap["message"].(string); ok {
				terminalMessage.Data = message
			}
		}
	}
	
	wsConn.mu.Lock()
	err := wsConn.conn.WriteJSON(terminalMessage)
	wsConn.mu.Unlock()
	
	if err != nil {
		log.Printf("Failed to send warning message: %v", err)
	}
}

// handleSystemAlert 处理系统告警消息  
func (sc *SSHController) handleSystemAlert(wsConn *WebSocketConnection, wsMessage services.WSMessage) {
	terminalMessage := TerminalMessage{
		Type: "alert",
		Data: "系统通知",
	}
	
	if wsMessage.Data != nil {
		if dataMap, ok := wsMessage.Data.(map[string]interface{}); ok {
			if message, ok := dataMap["message"].(string); ok {
				terminalMessage.Data = message
			}
		}
	}
	
	wsConn.mu.Lock()
	err := wsConn.conn.WriteJSON(terminalMessage)
	wsConn.mu.Unlock()
	
	if err != nil {
		log.Printf("Failed to send alert message: %v", err)
	}
}

// handleSSHOutput 处理SSH输出到WebSocket
func (sc *SSHController) handleSSHOutput(ctx context.Context, wsConn *WebSocketConnection) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("SSH output handler panic: %v", r)
		}
	}()

	// 获取SSH会话的输出流
	reader, err := sc.sshService.ReadFromSession(wsConn.sessionID)
	if err != nil {
		log.Printf("Failed to get SSH output reader for session %s: %v", wsConn.sessionID, err)
		return
	}

	log.Printf("SSH output handler started for session %s", wsConn.sessionID)
	buffer := make([]byte, 1024)
	
	// 使用goroutine进行异步读取
	dataChan := make(chan []byte, 10)
	errorChan := make(chan error, 1)
	
	go func() {
		defer close(dataChan)
		defer close(errorChan)
		
		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := reader.Read(buffer)
				if err != nil {
					if err != io.EOF {
						errorChan <- err
					}
					return
				}
				
				if n > 0 {
					// 创建数据副本
					data := make([]byte, n)
					copy(data, buffer[:n])
					
					select {
					case dataChan <- data:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()
	
	for {
		select {
		case <-ctx.Done():
			log.Printf("SSH output handler stopped for session %s", wsConn.sessionID)
			return
			
		case data, ok := <-dataChan:
			if !ok {
				log.Printf("SSH output channel closed for session %s", wsConn.sessionID)
				return
			}
			
			outputData := string(data)
			log.Printf("SSH output received for session %s: %d bytes", wsConn.sessionID, len(data))
			
			message := TerminalMessage{
				Type: "output",
				Data: outputData,
			}

			// 🎬 记录输出数据到录制服务
			if services.GlobalRecordingService != nil {
				if recorder, exists := services.GlobalRecordingService.GetRecorder(wsConn.sessionID); exists {
					outputRecord := &services.WSRecord{
						Timestamp: time.Now(),
						Type:      "output",
						Data:      data,
						Size:      len(data),
					}
					recorder.WriteRecord(outputRecord)
					log.Printf("录制输出数据: 会话=%s, 大小=%d", wsConn.sessionID, len(data))
				}
			}

			// 发送给SSH WebSocket客户端
			wsConn.mu.Lock()
			err := wsConn.conn.WriteJSON(message)
			wsConn.mu.Unlock()

			if err != nil {
				log.Printf("Failed to write to WebSocket for session %s: %v", wsConn.sessionID, err)
				return
			}
			
			log.Printf("SSH output sent to WebSocket for session %s", wsConn.sessionID)
			
			// 🔧 新增：广播终端数据给监控WebSocket客户端
			if services.GlobalWebSocketService != nil {
				// 创建监控消息
				monitorMsg := services.WSMessage{
					Type: "terminal_output",
					Data: map[string]interface{}{
						"session_id": wsConn.sessionID,
						"output":     outputData,
						"timestamp":  time.Now(),
					},
					Timestamp: time.Now(),
					SessionID: wsConn.sessionID,
				}
				
				// 广播给所有具有monitor权限的客户端
				sc.broadcastToMonitorClients(monitorMsg)
				log.Printf("Terminal output broadcasted to monitor clients for session %s", wsConn.sessionID)
			}
			
		case err := <-errorChan:
			log.Printf("Failed to read SSH output for session %s: %v", wsConn.sessionID, err)
			return
		}
	}
}

// handleWebSocketInput 处理WebSocket输入到SSH
func (sc *SSHController) handleWebSocketInput(ctx context.Context, wsConn *WebSocketConnection) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("WebSocket input handler panic: %v", r)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			var message TerminalMessage
			err := wsConn.conn.ReadJSON(&message)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				return
			}

			switch message.Type {
			case "input":
				// 🎬 记录输入数据到录制服务
				if services.GlobalRecordingService != nil {
					// 直接调用录制服务记录输入数据
					if recorder, exists := services.GlobalRecordingService.GetRecorder(wsConn.sessionID); exists {
						inputRecord := &services.WSRecord{
							Timestamp: time.Now(),
							Type:      "input",
							Data:      []byte(message.Data),
							Size:      len(message.Data),
						}
						recorder.WriteRecord(inputRecord)
						log.Printf("录制输入数据: 会话=%s, 大小=%d", wsConn.sessionID, len(message.Data))
					}
				}
				
				// 处理用户输入
				err = sc.sshService.WriteToSession(wsConn.sessionID, []byte(message.Data))
				if err != nil {
					log.Printf("Failed to write to SSH session: %v", err)
					return
				}

			case "resize":
				// 处理窗口大小调整
				if message.Rows > 0 && message.Cols > 0 {
					err = sc.sshService.ResizeSession(wsConn.sessionID, message.Cols, message.Rows)
					if err != nil {
						log.Printf("Failed to resize session: %v", err)
					}
				}

			case "ping":
				// 处理心跳
				pongMessage := TerminalMessage{
					Type: "pong",
					Data: "pong",
				}

				wsConn.mu.Lock()
				err = wsConn.conn.WriteJSON(pongMessage)
				wsConn.mu.Unlock()

				if err != nil {
					log.Printf("Failed to send pong: %v", err)
					return
				}
			}
		}
	}
}

// ResizeSession 调整会话窗口大小
// @Summary      调整SSH会话窗口大小
// @Description  调整指定SSH会话的终端窗口大小
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Param        request body  map[string]int true "窗口大小参数"
// @Success      200  {object}  map[string]interface{}  "调整成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "会话不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions/{id}/resize [post]
func (sc *SSHController) ResizeSession(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	var request struct {
		Width  int `json:"width" binding:"required,min=1"`
		Height int `json:"height" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 验证会话是否存在和属于当前用户
	session, err := sc.sshService.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)
	if session.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Access denied",
		})
		return
	}

	// 调整窗口大小
	err = sc.sshService.ResizeSession(sessionID, request.Width, request.Height)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to resize session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Session resized successfully",
	})
}

// GenerateKeyPair 生成SSH密钥对
// @Summary      生成SSH密钥对
// @Description  生成新的SSH公钥和私钥对
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "生成成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/keypair [post]
func (sc *SSHController) GenerateKeyPair(c *gin.Context) {
	// 生成SSH密钥对
	privateKey, publicKey, err := sc.sshService.GenerateSSHKeyPair()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate SSH key pair",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"private_key": privateKey,
			"public_key":  publicKey,
		},
	})
}

// GetSessionInfo 获取会话详细信息
// @Summary      获取SSH会话详细信息
// @Description  获取指定SSH会话的详细信息
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "会话ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      404  {object}  map[string]interface{}  "会话不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions/{id} [get]
func (sc *SSHController) GetSessionInfo(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Session ID is required",
		})
		return
	}

	// 验证会话是否存在
	session, err := sc.sshService.GetSession(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found",
		})
		return
	}

	// 获取当前用户
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)
	if session.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Access denied",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":          session.ID,
			"status":      session.Status,
			"created_at":  session.CreatedAt,
			"updated_at":  session.UpdatedAt,
			"last_active": session.LastActive,
			"is_active":   session.IsActive(),
		},
	})
}

// HealthCheckSessions 健康检查所有SSH会话
// @Summary      健康检查SSH会话
// @Description  检查并清理不活跃的SSH会话
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "检查完成"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions/health-check [post]
func (sc *SSHController) HealthCheckSessions(c *gin.Context) {
	// 执行健康检查
	activeCount := sc.sshService.HealthCheckSessions()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Health check completed",
		"data": gin.H{
			"active_sessions": activeCount,
		},
	})
}

// ForceCleanupSessions 强制清理所有会话
// @Summary      强制清理所有SSH会话
// @Description  强制关闭所有活跃的SSH会话并同步数据库状态
// @Tags         SSH管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "清理完成"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /ssh/sessions/force-cleanup [post]
func (sc *SSHController) ForceCleanupSessions(c *gin.Context) {
	// 检查管理员权限
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found",
		})
		return
	}

	user := userInterface.(*models.User)
	if !user.HasRole("admin") {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Permission denied",
		})
		return
	}

	// 执行强制清理
	if err := sc.sshService.ForceCleanupAllSessions(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to cleanup sessions: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "All sessions have been forcefully cleaned up",
	})
}

// broadcastToMonitorClients 广播消息给所有监控客户端
func (sc *SSHController) broadcastToMonitorClients(message services.WSMessage) {
	if services.GlobalWebSocketService == nil {
		return
	}
	
	// 获取所有连接的监控客户端
	manager := services.GlobalWebSocketService.GetManager()
	if manager == nil {
		return
	}
	
	manager.Mutex.RLock()
	defer manager.Mutex.RUnlock()
	
	// 序列化消息
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal monitor message: %v", err)
		return
	}
	
	// 遍历所有客户端，发送给监控权限的客户端
	for _, client := range manager.Clients {
		// 检查客户端是否有监控权限（非SSH终端客户端）
		if client.Role != "ssh_terminal" {
			select {
			case client.Send <- data:
				log.Printf("Terminal output sent to monitor client %s", client.ID)
			default:
				log.Printf("Monitor client %s send buffer full, skipping", client.ID)
			}
		}
	}
}
