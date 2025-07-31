import { apiClient } from './apiClient';
// 导入新的AuditApiService
import { auditApiService } from './api/AuditApiService';

// 审计相关的类型定义
export interface LoginLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  user_agent: string;
  method: string;
  status: 'success' | 'failed' | 'logout';
  message: string;
  created_at: string;
}

export interface OperationLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  method: string;
  url: string;
  action: string;
  resource: string;
  resource_id: number;
  session_id?: string; // 添加会话ID字段（可选）
  status: number;
  message: string;
  duration: number;
  created_at: string;
}

export interface SessionRecord {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  asset_name: string;
  asset_address: string;
  credential_id: number;
  protocol: string;
  ip: string;
  status: 'active' | 'closed' | 'timeout';
  start_time: string;
  end_time?: string;
  duration: number;
  record_path: string;
  created_at: string;
  // 超时管理字段
  timeout_minutes?: number;
  last_activity?: string;
  close_reason?: string;
}

export interface CommandLog {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  command: string;
  output: string;
  exit_code: number;
  risk: 'low' | 'medium' | 'high';
  action: string;
  start_time: string;
  end_time?: string;
  duration: number;
  created_at: string;
}

export interface AuditStatistics {
  total_login_logs: number;
  total_operation_logs: number;
  total_session_records: number;
  total_command_logs: number;
  failed_logins: number;
  active_sessions: number;
  dangerous_commands: number;
  today_logins: number;
  today_operations: number;
  today_sessions: number;
  failed_operations: number;
}

// 列表请求参数
export interface ListParams {
  page?: number;
  page_size?: number;
  username?: string;
  start_time?: string;
  end_time?: string;
}

export interface LoginLogListParams extends ListParams {
  status?: 'success' | 'failed' | 'logout';
  ip?: string;
}

export interface OperationLogListParams extends ListParams {
  action?: string;
  resource?: string;
  status?: number;
  ip?: string;
}

export interface SessionRecordListParams extends ListParams {
  asset_name?: string;
  asset_address?: string;
  protocol?: string;
  status?: 'active' | 'closed' | 'timeout';
  ip?: string;
  system_user?: string;
  system_type?: string;
  keyword?: string;
}

export interface CommandLogListParams extends ListParams {
  session_id?: string;
  asset_id?: number;
  command?: string;
  risk?: 'low' | 'medium' | 'high';
}

// API响应格式
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ListResponse<T> {
  logs?: T[];
  records?: T[];
  sessions?: T[];
  total: number;
  page: number;
  page_size: number;
}

// 实时监控相关类型
export interface ActiveSession extends SessionRecord {
  connection_time: number;
  inactive_time: number;
  last_activity: string;
  is_monitored: boolean;
  monitor_count: number;
  can_terminate: boolean;
  unread_warnings: number;
}

export interface TerminateSessionRequest {
  reason: string;
  force: boolean;
}

export interface SessionWarningRequest {
  message: string;
  level: 'info' | 'warning' | 'error';
}

export interface MonitorStatistics {
  active_sessions: number;
  connected_monitors: number;
  total_connections: number;
  terminated_sessions: number;
  sent_warnings: number;
  unread_warnings: number;
}

export interface SessionMonitorLog {
  id: number;
  session_id: string;
  monitor_user_id: number;
  monitor_user: string;
  action_type: string;
  action_data: string;
  reason: string;
  created_at: string;
}

// 审计API服务
export class AuditAPI {
  // 获取登录日志列表
  static async getLoginLogs(params: LoginLogListParams = {}) {
    // 使用新的AuditApiService
    return await auditApiService.getLoginLogs(params);
  }

  // 获取操作日志列表
  static async getOperationLogs(params: OperationLogListParams = {}) {
    return await auditApiService.getOperationLogs(params);
  }

  // 获取单个操作日志详情
  static async getOperationLog(id: number) {
    return await auditApiService.getOperationLog(id);
  }

  // 获取会话记录列表
  static async getSessionRecords(params: SessionRecordListParams = {}) {
    return await auditApiService.getSessionRecords(params);
  }

  // 获取单个会话记录详情
  static async getSessionRecord(id: number) {
    return await auditApiService.getSessionRecord(id);
  }

  // 获取命令日志列表
  static async getCommandLogs(params: CommandLogListParams = {}) {
    return await auditApiService.getCommandLogs(params);
  }

  // 获取单个命令日志详情
  static async getCommandLog(id: number) {
    return await auditApiService.getCommandLog(id);
  }


  // 获取审计统计数据
  static async getAuditStatistics() {
    return await auditApiService.getAuditStatistics();
  }

  // 清理过期审计日志（仅管理员）
  static async cleanupAuditLogs() {
    return await auditApiService.cleanupAuditLogs();
  }

  // ======================== 实时监控API ========================

  // 获取活跃会话列表
  static async getActiveSessions(params: SessionRecordListParams = {}) {
    return await auditApiService.getActiveSessions(params);
  }

  // 终止会话
  static async terminateSession(sessionId: string, data: TerminateSessionRequest) {
    return await auditApiService.terminateSession(sessionId, data);
  }

  // 发送会话警告
  static async sendSessionWarning(sessionId: string, data: SessionWarningRequest) {
    return await auditApiService.sendSessionWarning(sessionId, data);
  }

  // 获取监控统计数据
  static async getMonitorStatistics() {
    return await auditApiService.getMonitorStatistics();
  }

  // 获取会话监控日志
  static async getSessionMonitorLogs(sessionId: string, params: { page?: number; page_size?: number } = {}) {
    return await auditApiService.getSessionMonitorLogs(sessionId, params);
  }

  // 标记警告为已读
  static async markWarningAsRead(warningId: number) {
    return await auditApiService.markWarningAsRead(warningId);
  }

  // 删除单个会话记录
  static async deleteSessionRecord(sessionId: string) {
    return await auditApiService.deleteSessionRecord(sessionId);
  }

  // 批量删除会话记录
  static async batchDeleteSessionRecords(sessionIds: string[], reason: string) {
    return await auditApiService.batchDeleteSessionRecords({ session_ids: sessionIds, reason });
  }

  // 删除单个操作日志
  static async deleteOperationLog(id: number) {
    return await auditApiService.deleteOperationLog(id);
  }

  // 批量删除操作日志
  static async batchDeleteOperationLogs(ids: number[], reason: string) {
    return await auditApiService.batchDeleteOperationLogs({ ids, reason });
  }
}

export default AuditAPI;