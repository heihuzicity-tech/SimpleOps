// 审计相关的类型定义

import type { Timestamps, WithId } from './common';

// 登录日志
export interface LoginLog extends WithId, Omit<Timestamps, 'updated_at'> {
  user_id: number;
  username: string;
  ip: string;
  user_agent: string;
  method: string;
  status: 'success' | 'failed' | 'logout';
  message: string;
}

// 操作日志
export interface OperationLog extends WithId, Omit<Timestamps, 'updated_at'> {
  user_id: number;
  username: string;
  ip: string;
  method: string;
  url: string;
  action: string;
  resource: string;
  resource_id: number;
  session_id?: string;
  status: number;
  message: string;
  duration: number;
}

// 会话记录
export interface SessionRecord extends WithId, Timestamps {
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
  timeout_minutes?: number;
  last_activity?: string;
  close_reason?: string;
}

// 命令日志
export interface CommandLog extends WithId, Omit<Timestamps, 'updated_at'> {
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
}

// 审计统计
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

// 活跃会话
export interface ActiveSession extends SessionRecord {
  connection_time: number;
  inactive_time: number;
  last_activity: string;
  is_monitored: boolean;
  monitor_count: number;
  can_terminate: boolean;
  unread_warnings: number;
}

// 会话监控日志
export interface SessionMonitorLog extends WithId, Omit<Timestamps, 'updated_at'> {
  session_id: string;
  monitor_user_id: number;
  monitor_user: string;
  action_type: string;
  action_data: string;
  reason: string;
}

// 监控统计
export interface MonitorStatistics {
  active_sessions: number;
  connected_monitors: number;
  total_connections: number;
  terminated_sessions: number;
  sent_warnings: number;
  unread_warnings: number;
}

// 请求参数类型
export interface BaseListParams {
  page?: number;
  page_size?: number;
  username?: string;
  start_time?: string;
  end_time?: string;
}

export interface LoginLogListParams extends BaseListParams {
  status?: 'success' | 'failed' | 'logout';
  ip?: string;
}

export interface OperationLogListParams extends BaseListParams {
  action?: string;
  resource?: string;
  status?: number;
  ip?: string;
}

export interface SessionRecordListParams extends BaseListParams {
  asset_name?: string;
  asset_address?: string;
  protocol?: string;
  status?: 'active' | 'closed' | 'timeout';
  ip?: string;
  system_user?: string;
  system_type?: string;
  keyword?: string;
}

export interface CommandLogListParams extends BaseListParams {
  session_id?: string;
  asset_id?: number;
  command?: string;
  risk?: 'low' | 'medium' | 'high';
}

// 操作请求类型
export interface TerminateSessionRequest {
  reason: string;
  force: boolean;
}

export interface SessionWarningRequest {
  message: string;
  level: 'info' | 'warning' | 'error';
}

export interface BatchDeleteRequest {
  ids?: number[];
  session_ids?: string[];
  reason: string;
}