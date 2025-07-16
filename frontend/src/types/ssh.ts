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
  session_id: string;
  asset_name: string;
  asset_address: string;
  username: string;
  port?: number;
  protocol: string;
  status: string;
  created_at: string;
  updated_at?: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  command_count?: number;
  bytes_transferred?: number;
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