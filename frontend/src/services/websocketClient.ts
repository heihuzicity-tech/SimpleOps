export interface WSMessage {
  type: string;
  data: any;
  timestamp: string;
  user_id?: number;
  session_id?: string;
}

export type MessageHandler = (message: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private onConnectionChange?: (connected: boolean) => void;
  private heartbeatInterval?: NodeJS.Timeout;
  private isConnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  // 连接WebSocket
  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          reject(new Error('No authentication token found'));
          return;
        }

        // 构建WebSocket URL，包含认证token
        const wsUrl = `${this.url}?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.stopHeartbeat();
          this.onConnectionChange?.(false);
          
          // 如果不是主动关闭，尝试重连
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.onConnectionChange?.(false);
          
          // 检查是否是认证错误
          const token = localStorage.getItem('token');
          if (!token) {
            reject(new Error('No authentication token found'));
          } else {
            // 检查token是否过期
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const isExpired = payload.exp && (Date.now() / 1000) > payload.exp;
              if (isExpired) {
                reject(new Error('Token has expired, please login again'));
              } else {
                reject(new Error('WebSocket connection failed. Please check your authentication and try again.'));
              }
            } catch (tokenError) {
              reject(new Error('Invalid token format'));
            }
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止重连
    this.onConnectionChange?.(false);
  }

  // 发送消息
  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
    }
  }

  // 订阅消息类型
  subscribe(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  // 取消订阅
  unsubscribe(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 设置连接状态变化回调
  onConnectionStateChange(callback: (connected: boolean) => void): void {
    this.onConnectionChange = callback;
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // 处理接收到的消息
  private handleMessage(message: WSMessage): void {
    
    // 处理心跳响应
    if (message.type === 'heartbeat_pong') {
      return;
    }

    // 分发消息给订阅者
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }

    // 分发给通用订阅者
    const allHandlers = this.messageHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in global message handler:', error);
        }
      });
    }
  }

  // 处理重连
  private handleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'heartbeat_ping',
          data: {},
          timestamp: new Date().toISOString(),
        });
      }
    }, 30000); // 30秒心跳间隔
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
}

// 全局WebSocket客户端实例
let globalWSClient: WebSocketClient | null = null;

// 获取全局WebSocket客户端
export const getWebSocketClient = (): WebSocketClient => {
  if (!globalWSClient) {
    let wsUrl: string;
    
    // 优先使用环境变量配置
    if (process.env.REACT_APP_API_URL) {
      // 从API URL构建WebSocket URL
      const apiUrl = process.env.REACT_APP_API_URL;
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const host = apiUrl.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}://${host}/api/v1/ws/monitor`;
    } else {
      // 自动检测（与SSH WebSocket保持一致）
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const isDev = process.env.NODE_ENV === 'development';
      const port = isDev ? '8080' : window.location.port || '80';
      const hostWithPort = port === '80' || port === '443' ? host : `${host}:${port}`;
      wsUrl = `${protocol}//${hostWithPort}/api/v1/ws/monitor`;
    }
    
    globalWSClient = new WebSocketClient(wsUrl);
  }
  return globalWSClient;
};

// 清理全局WebSocket客户端
export const cleanupWebSocketClient = (): void => {
  if (globalWSClient) {
    globalWSClient.disconnect();
    globalWSClient = null;
  }
};

// WebSocket消息类型常量
export const WS_MESSAGE_TYPES = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  SESSION_UPDATE: 'session_update',
  FORCE_TERMINATE: 'force_terminate',
  SYSTEM_ALERT: 'system_alert',
  HEARTBEAT_PING: 'heartbeat_ping',
  HEARTBEAT_PONG: 'heartbeat_pong',
  MONITORING_UPDATE: 'monitoring_update',
  SESSION_WARNING: 'session_warning',
} as const;

export default WebSocketClient;