import apiClient from './apiClient';
import { SSHSessionRequest, SSHSessionResponse, SSHSessionInfo } from '../types/ssh';

export const sshAPI = {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '8080'; // 后端WebSocket端口
    const token = localStorage.getItem('token');
    return `${protocol}//${host}:${port}/api/v1/ws/ssh/sessions/${sessionId}/ws?token=${token}`;
  }
};