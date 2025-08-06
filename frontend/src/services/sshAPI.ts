import apiClient from './apiClient';
import { SSHSessionRequest, SSHSessionResponse, SSHSessionInfo } from '../types/ssh';

export const sshAPI = {
  // 创建SSH连接 (用于工作台)
  async createConnection(params: {
    host_id: number;
    credential_id: number;
    protocol: string;
    port: number;
  }): Promise<{ session_id: string; [key: string]: any }> {
    const response = await apiClient.post('/ssh/connections', {
      asset_id: params.host_id,
      credential_id: params.credential_id,
      protocol: params.protocol,
      port: params.port
    });
    return response.data.data;
  },

  // 关闭SSH连接 (用于工作台)
  async closeConnection(sessionId: string): Promise<void> {
    await apiClient.delete(`/ssh/connections/${sessionId}`);
  },

  // 创建SSH会话
  async createSession(params: SSHSessionRequest): Promise<SSHSessionResponse> {
    const response = await apiClient.post('/ssh/sessions', params);
    return response.data.data;
  },

  // 获取会话列表
  async getSessions(): Promise<SSHSessionResponse[]> {
    const response = await apiClient.get('/ssh/sessions');
    return response.data.data || [];
  },

  // 获取会话详细信息
  async getSessionInfo(id: string): Promise<SSHSessionInfo> {
    const response = await apiClient.get(`/ssh/sessions/${id}`);
    return response.data.data;
  },

  // 关闭会话
  async closeSession(id: string): Promise<void> {
    await apiClient.delete(`/ssh/sessions/${id}`);
  },

  // 调整终端大小
  async resizeSession(id: string, width: number, height: number): Promise<void> {
    await apiClient.post(`/ssh/sessions/${id}/resize`, {
      width,
      height
    });
  },

  // 获取WebSocket连接URL
  getWebSocketURL(sessionId: string): string {
    const token = localStorage.getItem('token');
    let wsUrl: string;
    
    // 优先使用环境变量配置
    if (process.env.REACT_APP_API_URL) {
      // 从API URL构建WebSocket URL
      const apiUrl = process.env.REACT_APP_API_URL;
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const host = apiUrl.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}://${host}/api/v1/ws/ssh/sessions/${sessionId}/ws`;
    } else {
      // 自动检测
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const isDev = process.env.NODE_ENV === 'development';
      const port = isDev ? '8080' : window.location.port || '80';
      const hostWithPort = port === '80' || port === '443' ? host : `${host}:${port}`;
      wsUrl = `${protocol}//${hostWithPort}/api/v1/ws/ssh/sessions/${sessionId}/ws`;
    }
    
    return `${wsUrl}?token=${token}`;
  },

  // ===== 超时管理API =====
  
  // 设置会话超时
  async setSessionTimeout(sessionId: string, timeoutMinutes: number): Promise<void> {
    await apiClient.post(`/ssh/sessions/${sessionId}/timeout`, {
      timeout_minutes: timeoutMinutes
    });
  },

  // 获取会话超时配置
  async getSessionTimeout(sessionId: string): Promise<{
    session_id: string;
    timeout_minutes: number;
    last_activity: string;
    timeout_at: string;
    is_warned: boolean;
  }> {
    const response = await apiClient.get(`/ssh/sessions/${sessionId}/timeout`);
    return response.data.data;
  },

  // 更新会话超时配置
  async updateSessionTimeout(sessionId: string, timeoutMinutes: number): Promise<void> {
    await apiClient.put(`/ssh/sessions/${sessionId}/timeout`, {
      timeout_minutes: timeoutMinutes
    });
  },

  // 取消会话超时
  async removeSessionTimeout(sessionId: string): Promise<void> {
    await apiClient.delete(`/ssh/sessions/${sessionId}/timeout`);
  },

  // 延长会话时间
  async extendSession(sessionId: string, additionalMinutes?: number): Promise<void> {
    await apiClient.post(`/ssh/sessions/${sessionId}/extend`, {
      additional_minutes: additionalMinutes
    });
  },

  // 更新会话活动时间
  async updateSessionActivity(sessionId: string): Promise<void> {
    await apiClient.post(`/ssh/sessions/${sessionId}/activity`);
  },

  // 获取会话状态（包含剩余时间）
  async getSessionStatus(sessionId: string): Promise<{
    session_id: string;
    is_active: boolean;
    timeout_minutes: number;
    minutes_remaining: number;
    last_activity: string;
    timeout_at: string;
  }> {
    const response = await apiClient.get(`/ssh/sessions/${sessionId}/status`);
    return response.data.data;
  },

  // 获取超时统计信息
  async getTimeoutStats(): Promise<{
    total_sessions: number;
    active_sessions: number;
    expiring_soon: number;
    expired_today: number;
  }> {
    const response = await apiClient.get('/ssh/sessions/timeout-stats');
    return response.data.data;
  }
};