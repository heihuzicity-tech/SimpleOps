// SSH会话类型定义
export interface SSHSessionRequest {
  asset_id: number;
  credential_id: number;
  protocol: string;
  width?: number;
  height?: number;
}

export interface SSHSessionResponse {
  id: string;
  status: 'connecting' | 'active' | 'closed' | 'error';
  asset_name: string;
  asset_addr: string;
  username: string;
  created_at: string;
  last_active: string;
}

export interface SSHSessionInfo {
  id: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  commandCount?: number;
  bytesTransferred?: number;
}

// WebSocket消息类型
export interface WSMessage {
  type: 'input' | 'output' | 'resize' | 'ping' | 'pong' | 'error';
  data?: string;
  rows?: number;
  cols?: number;
  error?: string;
}

// 终端配置
export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  theme: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
}

// 连接状态
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';