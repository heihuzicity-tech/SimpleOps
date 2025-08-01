package services

import (
	"bastion/config"
	"bastion/models"
	"bastion/utils"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// MessageType WebSocket消息类型
type MessageType string

const (
	SessionStart        MessageType = "session_start"
	SessionEnd          MessageType = "session_end"
	SessionUpdate       MessageType = "session_update"
	ForceTerminate      MessageType = "force_terminate"
	SystemAlert         MessageType = "system_alert"
	HeartbeatPing       MessageType = "heartbeat_ping"
	HeartbeatPong       MessageType = "heartbeat_pong"
	MonitoringUpdate    MessageType = "monitoring_update"
	SessionWarning      MessageType = "session_warning"
	SessionTimeout      MessageType = "session_timeout" // 🆕 会话超时消息
)

// WSMessage WebSocket消息结构
type WSMessage struct {
	Type      MessageType `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	UserID    uint        `json:"user_id,omitempty"`
	SessionID string      `json:"session_id,omitempty"`
}

// Client WebSocket客户端
type Client struct {
	ID         string
	UserID     uint
	Username   string
	Role       string
	Connection *websocket.Conn
	Send       chan []byte
	Manager    *ConnectionManager
	LastPong   time.Time
}

// ConnectionManager WebSocket连接管理器
type ConnectionManager struct {
	Clients    map[string]*Client  // clientID -> Client (导出用于监控)
	UserClients map[uint][]*Client // userID -> []*Client (导出用于监控)
	Mutex      sync.RWMutex        // 读写锁 (导出用于监控)
	broadcast  chan []byte         // 广播消息通道
	register   chan *Client        // 注册新连接
	unregister chan *Client        // 注销连接
	upgrader   websocket.Upgrader  // WebSocket升级器
}

// WebSocketService WebSocket服务
type WebSocketService struct {
	manager *ConnectionManager
}

// NewWebSocketService 创建WebSocket服务实例
func NewWebSocketService() *WebSocketService {
	manager := &ConnectionManager{
		Clients:     make(map[string]*Client),
		UserClients: make(map[uint][]*Client),
		broadcast:   make(chan []byte),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  8192,  // 增大到8KB，适应高频输入
			WriteBufferSize: 8192,  // 增大到8KB，适应大量输出
			CheckOrigin: func(r *http.Request) bool {
				// 允许跨域连接（生产环境需要严格验证）
				return true
			},
			// 启用压缩以减少网络传输
			EnableCompression: true,
		},
	}

	return &WebSocketService{
		manager: manager,
	}
}

// Start 启动WebSocket服务
func (ws *WebSocketService) Start() {
	go ws.manager.run()
	logrus.Info("WebSocket服务已启动")
}

// HandleWebSocket 处理WebSocket连接
func (ws *WebSocketService) HandleWebSocket(c *gin.Context) {
	// 验证用户权限
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户未认证"})
		return
	}

	user := userInterface.(*models.User)
	
	// 检查监控权限
	if !user.HasPermission("audit:monitor") {
		c.JSON(http.StatusForbidden, gin.H{"error": "没有监控权限"})
		return
	}

	// 升级HTTP连接为WebSocket
	conn, err := ws.manager.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Error("WebSocket升级失败")
		return
	}

	// 创建客户端
	client := &Client{
		ID:         utils.GenerateID(),
		UserID:     user.ID,
		Username:   user.Username,
		Role:       "admin", // 简化处理，实际应从user.Roles获取
		Connection: conn,
		Send:       make(chan []byte, config.GlobalConfig.WebSocket.MessageBufferSize),
		Manager:    ws.manager,
		LastPong:   time.Now(),
	}

	// 注册客户端
	ws.manager.register <- client

	// 启动客户端处理协程
	go client.writePump()
	go client.readPump()

	logrus.WithFields(logrus.Fields{
		"client_id": client.ID,
		"user_id":   client.UserID,
		"username":  client.Username,
	}).Info("WebSocket客户端已连接")
}

// 连接管理器运行
func (cm *ConnectionManager) run() {
	ticker := time.NewTicker(time.Duration(config.GlobalConfig.WebSocket.HeartbeatInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-cm.register:
			cm.registerClient(client)

		case client := <-cm.unregister:
			cm.unregisterClient(client)

		case message := <-cm.broadcast:
			cm.broadcastMessage(message)

		case <-ticker.C:
			cm.heartbeat()
		}
	}
}

// 注册客户端
func (cm *ConnectionManager) registerClient(client *Client) {
	cm.Mutex.Lock()
	defer cm.Mutex.Unlock()

	cm.Clients[client.ID] = client
	
	// 添加到用户客户端映射
	if _, ok := cm.UserClients[client.UserID]; !ok {
		cm.UserClients[client.UserID] = make([]*Client, 0)
	}
	cm.UserClients[client.UserID] = append(cm.UserClients[client.UserID], client)

	logrus.WithFields(logrus.Fields{
		"client_id":     client.ID,
		"total_clients": len(cm.Clients),
	}).Info("客户端已注册")

	// 🔧 修复：移除冗余的欢迎消息，避免重复提示
	// welcomeMsg := WSMessage{
	// 	Type:      SystemAlert,
	// 	Data:      map[string]string{"message": "连接成功，开始监控"},
	// 	Timestamp: time.Now(),
	// }
	// client.SendMessage(welcomeMsg)

	// 发送当前活跃会话信息
	go cm.sendActiveSessionsToClient(client)
}

// 注销客户端
func (cm *ConnectionManager) unregisterClient(client *Client) {
	cm.Mutex.Lock()
	defer cm.Mutex.Unlock()

	if _, ok := cm.Clients[client.ID]; ok {
		delete(cm.Clients, client.ID)
		close(client.Send)

		// 从用户客户端映射中移除
		if userClients, ok := cm.UserClients[client.UserID]; ok {
			for i, c := range userClients {
				if c.ID == client.ID {
					cm.UserClients[client.UserID] = append(userClients[:i], userClients[i+1:]...)
					break
				}
			}
			// 如果该用户没有其他客户端，删除映射
			if len(cm.UserClients[client.UserID]) == 0 {
				delete(cm.UserClients, client.UserID)
			}
		}

		logrus.WithFields(logrus.Fields{
			"client_id":     client.ID,
			"total_clients": len(cm.Clients),
		}).Info("客户端已注销")
	}
}

// 广播消息
func (cm *ConnectionManager) broadcastMessage(message []byte) {
	cm.Mutex.RLock()
	defer cm.Mutex.RUnlock()

	for clientID, client := range cm.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(cm.Clients, clientID)
		}
	}
}

// 心跳检测
func (cm *ConnectionManager) heartbeat() {
	cm.Mutex.RLock()
	defer cm.Mutex.RUnlock()

	now := time.Now()
	heartbeatTimeout := time.Duration(config.GlobalConfig.WebSocket.HeartbeatInterval*2) * time.Second

	for _, client := range cm.Clients {
		// 发送心跳ping
		pingMsg := WSMessage{
			Type:      HeartbeatPing,
			Timestamp: now,
		}
		client.SendMessage(pingMsg)

		// 检查客户端是否超时
		if now.Sub(client.LastPong) > heartbeatTimeout {
			logrus.WithField("client_id", client.ID).Warn("客户端心跳超时，断开连接")
			client.Connection.Close()
		}
	}
}

// 发送活跃会话信息给客户端
func (cm *ConnectionManager) sendActiveSessionsToClient(client *Client) {
	// 获取活跃会话数据
	db := utils.GetDB()
	var sessions []models.SessionRecord
	
	// 使用与MonitorService一致的查询条件
	cutoffTime := time.Now().Add(-2 * time.Minute)
	err := db.Where(
		"status = ? AND (is_terminated IS NULL OR is_terminated = ?) AND end_time IS NULL AND start_time >= ?",
		"active", false, cutoffTime,
	).Find(&sessions).Error
	if err != nil {
		logrus.WithError(err).Error("获取活跃会话失败")
		return
	}

	// 发送监控更新消息
	updateMsg := WSMessage{
		Type: MonitoringUpdate,
		Data: map[string]interface{}{
			"active_sessions": sessions,
			"total_count":     len(sessions),
		},
		Timestamp: time.Now(),
	}
	client.SendMessage(updateMsg)
}

// 客户端方法

// SendMessage 发送消息
func (c *Client) SendMessage(message WSMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		logrus.WithError(err).Error("消息序列化失败")
		return
	}

	select {
	case c.Send <- data:
	default:
		close(c.Send)
	}
}

// readPump 读取消息
func (c *Client) readPump() {
	defer func() {
		c.Manager.unregister <- c
		c.Connection.Close()
	}()

	// 设置读取超时
	c.Connection.SetReadDeadline(time.Now().Add(time.Duration(config.GlobalConfig.WebSocket.ReadTimeout) * time.Second))
	c.Connection.SetPongHandler(func(string) error {
		c.LastPong = time.Now()
		c.Connection.SetReadDeadline(time.Now().Add(time.Duration(config.GlobalConfig.WebSocket.ReadTimeout) * time.Second))
		return nil
	})

	for {
		_, message, err := c.Connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logrus.WithError(err).Error("WebSocket读取错误")
			}
			break
		}

		// 处理接收到的消息
		c.handleMessage(message)
	}
}

// writePump 写入消息
func (c *Client) writePump() {
	ticker := time.NewTicker(time.Duration(config.GlobalConfig.WebSocket.HeartbeatInterval) * time.Second)
	defer func() {
		ticker.Stop()
		c.Connection.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Connection.SetWriteDeadline(time.Now().Add(time.Duration(config.GlobalConfig.WebSocket.WriteTimeout) * time.Second))
			if !ok {
				c.Connection.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Connection.WriteMessage(websocket.TextMessage, message); err != nil {
				logrus.WithError(err).Error("WebSocket写入错误")
				return
			}

		case <-ticker.C:
			c.Connection.SetWriteDeadline(time.Now().Add(time.Duration(config.GlobalConfig.WebSocket.WriteTimeout) * time.Second))
			if err := c.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理接收到的消息
func (c *Client) handleMessage(message []byte) {
	var wsMsg WSMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		logrus.WithError(err).Error("消息反序列化失败")
		return
	}

	switch wsMsg.Type {
	case HeartbeatPong:
		c.LastPong = time.Now()
		
	default:
		logrus.WithField("message_type", wsMsg.Type).Debug("收到未知消息类型")
	}
}

// BroadcastSessionUpdate 广播会话更新 - 已废弃，避免全局广播误杀
// Deprecated: 使用SendSessionUpdateToUser或SendSessionUpdateToAdmins代替
func (ws *WebSocketService) BroadcastSessionUpdate(sessionRecord *models.SessionRecord, updateType MessageType) {
	logrus.WithFields(logrus.Fields{
		"session_id": sessionRecord.SessionID,
		"user_id":    sessionRecord.UserID,
		"update_type": updateType,
	}).Warn("BroadcastSessionUpdate已废弃，改为精确通知避免误杀")
	
	// 改为精确通知会话所属用户
	ws.SendSessionUpdateToUser(sessionRecord, updateType)
}

// SendSessionUpdateToUser 向会话所属用户发送更新
func (ws *WebSocketService) SendSessionUpdateToUser(sessionRecord *models.SessionRecord, updateType MessageType) {
	message := WSMessage{
		Type:      updateType,
		Data:      sessionRecord.ToResponse(),
		Timestamp: time.Now(),
		SessionID: sessionRecord.SessionID,
	}

	// 精确发送给会话所属用户
	ws.SendMessageToUser(sessionRecord.UserID, message)
	
	logrus.WithFields(logrus.Fields{
		"session_id": sessionRecord.SessionID,
		"user_id":    sessionRecord.UserID,
		"update_type": updateType,
	}).Info("已向会话用户发送精确更新")
}

// SendMessageToUser 发送消息给指定用户
func (ws *WebSocketService) SendMessageToUser(userID uint, message WSMessage) {
	ws.manager.Mutex.RLock()
	defer ws.manager.Mutex.RUnlock()

	if clients, ok := ws.manager.UserClients[userID]; ok {
		data, err := json.Marshal(message)
		if err != nil {
			logrus.WithError(err).Error("消息序列化失败")
			return
		}

		for _, client := range clients {
			select {
			case client.Send <- data:
			default:
				logrus.WithField("client_id", client.ID).Warn("客户端发送缓冲区满")
			}
		}
	}
}

// GetConnectedClients 获取连接客户端数量
func (ws *WebSocketService) GetConnectedClients() int {
	ws.manager.Mutex.RLock()
	defer ws.manager.Mutex.RUnlock()
	return len(ws.manager.Clients)
}

// GetManager 获取连接管理器（用于终端数据广播）
func (ws *WebSocketService) GetManager() *ConnectionManager {
	return ws.manager
}

// 全局WebSocket服务实例
var GlobalWebSocketService *WebSocketService
var GlobalSessionTimeoutService *SessionTimeoutService

// RegisterSSHClient 注册SSH客户端到WebSocket服务
func (ws *WebSocketService) RegisterSSHClient(client *Client) {
	if ws.manager != nil {
		client.Manager = ws.manager
		ws.manager.register <- client
		logrus.WithFields(logrus.Fields{
			"client_id": client.ID,
			"user_id":   client.UserID,
			"role":      client.Role,
		}).Info("SSH客户端已注册到WebSocket服务")
	}
}

// UnregisterSSHClient 从WebSocket服务注销SSH客户端
func (ws *WebSocketService) UnregisterSSHClient(client *Client) {
	if ws.manager != nil {
		ws.manager.unregister <- client
		logrus.WithFields(logrus.Fields{
			"client_id": client.ID,
			"user_id":   client.UserID,
			"role":      client.Role,
		}).Info("SSH客户端已从WebSocket服务注销")
	}
}

// InitWebSocketService 初始化WebSocket服务
func InitWebSocketService() {
	if config.GlobalConfig.WebSocket.Enable {
		GlobalWebSocketService = NewWebSocketService()
		GlobalWebSocketService.Start()
	}
}