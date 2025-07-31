// 基础类型定义

// 用户类型
export interface User {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  status: number;
  created_at: string;
  updated_at: string;
  roles?: Role[];
}

// 角色类型
export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: string[];
  created_at: string;
  updated_at: string;
}

// 资产类型
export interface Asset {
  id: number;
  name: string;
  type: string;
  os_type?: string;
  address: string;
  port: number;
  protocol: string;
  tags?: string;
  status: number;
  created_at: string;
  updated_at: string;
  credentials?: Credential[];
  groups?: AssetGroup[];
  connection_status?: string;
}

// 凭证类型
export interface Credential {
  id: number;
  name: string;
  type: string;
  username: string;
  password?: string;
  private_key?: string;
  created_at: string;
  updated_at: string;
  assets?: Asset[];
}

// 资产分组类型
export interface AssetGroup {
  id: number;
  name: string;
  description?: string;
  asset_count?: number;
  created_at: string;
  updated_at: string;
  assets?: Asset[];
}

// SSH会话类型
export interface SSHSession {
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
  status: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  record_path?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  asset?: Asset;
  credential?: Credential;
}

// 活跃会话类型
export interface ActiveSession extends SSHSession {
  connection_time: number;
  inactive_time: number;
  last_activity: string;
  is_monitored: boolean;
  monitor_count: number;
  can_terminate: boolean;
  unread_warnings: number;
}

// 命令日志类型
export interface CommandLog {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  command: string;
  output?: string;
  exit_code?: number;
  risk: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  created_at: string;
}

// 审计日志类型
export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  method: string;
  url: string;
  action: string;
  resource?: string;
  resource_id?: number;
  status: number;
  message?: string;
  request_data?: string;
  response_data?: string;
  duration: number;
  created_at: string;
}

// 登录日志类型
export interface LoginLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  user_agent: string;
  method: string;
  status: string;
  message?: string;
  created_at: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

// 分页响应类型
export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 连接测试请求类型
export interface ConnectionTestRequest {
  asset_id: number;
  credential_id: number;
  test_type: string;
}

// 连接测试响应类型
export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
  tested_at: string;
}

// 会话创建请求类型
export interface SessionCreateRequest {
  asset_id: number;
  credential_id: number;
}

// 会话终止请求类型
export interface SessionTerminateRequest {
  reason: string;
}

// 会话警告请求类型
export interface SessionWarningRequest {
  message: string;
  level: string;
}

// 表单验证规则类型
export interface ValidationRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  type?: 'string' | 'number' | 'email' | 'url' | 'array';
  validator?: (rule: any, value: any) => Promise<void>;
}

// 菜单项类型
export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
  permission?: string;
}

// 权限类型
export interface Permission {
  id: number;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  session_id?: string;  // 添加session_id字段
  user_id?: number;     // 添加user_id字段
}

// 通知类型
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// 状态常量
export const AssetStatus = {
  ENABLED: 1,
  DISABLED: 0,
} as const;

export const UserStatus = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;

export const SessionStatus = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  TIMEOUT: 'timeout',
  TERMINATED: 'terminated',
} as const;

export const CredentialType = {
  PASSWORD: 'password',
  KEY: 'key',
  CERT: 'cert',
} as const;

export const AssetType = {
  SERVER: 'server',
  DATABASE: 'database',
  NETWORK: 'network',
  STORAGE: 'storage',
} as const;

export const ProtocolType = {
  SSH: 'ssh',
  RDP: 'rdp',
  VNC: 'vnc',
  MYSQL: 'mysql',
  POSTGRESQL: 'postgresql',
  TELNET: 'telnet',
} as const;

export const CommandRisk = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

// 命令过滤特殊的分页响应类型（后端返回格式不同）
export interface CommandFilterPaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages?: number;
}

// 命令策略相关类型
export interface Command {
  id: number;
  name: string;
  type: 'exact' | 'regex';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CommandGroup {
  id: number;
  name: string;
  description?: string;
  remark?: string;
  is_preset?: boolean;
  command_count?: number;
  created_at: string;
  updated_at: string;
  commands?: Command[];
  items?: CommandGroupItem[];
}

export interface CommandPolicy {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  user_count?: number;
  command_count?: number;
  created_at: string;
  updated_at: string;
  users?: UserBasicInfo[];
  commands?: PolicyCommand[];
}

export interface UserBasicInfo {
  id: number;
  username: string;
  email?: string;
}

export interface PolicyCommand {
  id: number;
  type: 'command' | 'command_group';
  command?: CommandResponse;
  command_group?: CommandGroupResponse;
}

export interface CommandResponse {
  id: number;
  name: string;
  type: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CommandGroupResponse {
  id: number;
  name: string;
  description?: string;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommandInterceptLog {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  asset_name?: string;
  asset_addr?: string;
  command: string;
  policy_id: number;
  policy_name: string;
  policy_type: string;
  intercept_time: string;
  alert_level?: string;
  alert_sent: boolean;
}

// 命令策略相关请求类型
export interface CommandListRequest {
  page?: number;
  page_size?: number;
  name?: string;
  type?: string;
}

export interface CommandCreateRequest {
  name: string;
  type: 'exact' | 'regex';
  description?: string;
}

export interface CommandUpdateRequest {
  name?: string;
  type?: 'exact' | 'regex';
  description?: string;
}

export interface CommandGroupListRequest {
  page?: number;
  page_size?: number;
  name?: string;
  is_preset?: boolean;
}

export interface CommandGroupCreateRequest {
  name: string;
  description?: string;
  command_ids?: number[];
  remark?: string;
  items?: CommandGroupItem[];
}

export interface CommandGroupUpdateRequest {
  name?: string;
  description?: string;
  command_ids?: number[];
  remark?: string;
  items?: CommandGroupItem[];
}

export interface CommandGroupItem {
  id?: number;
  command_group_id?: number;
  type: 'command' | 'regex';
  content: string;
  ignore_case: boolean;
  sort_order?: number;
}

export interface PolicyListRequest {
  page?: number;
  page_size?: number;
  name?: string;
  enabled?: boolean;
}

export interface PolicyCreateRequest {
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
}

export interface PolicyUpdateRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
}

export interface PolicyBindUsersRequest {
  user_ids: number[];
}

export interface PolicyBindCommandsRequest {
  command_ids: number[];
  command_group_ids: number[];
}

export interface InterceptLogListRequest {
  page?: number;
  page_size?: number;
  session_id?: string;
  user_id?: number;
  asset_id?: number;
  policy_id?: number;
  start_time?: string;
  end_time?: string;
}

export const CommandType = {
  EXACT: 'exact',
  REGEX: 'regex',
} as const;

// 命令过滤相关类型
export interface CommandFilter {
  id: number;
  name: string;
  priority: number;
  enabled: boolean;
  user_type: 'all' | 'specific' | 'attribute';
  asset_type: 'all' | 'specific' | 'attribute';
  account_type: 'all' | 'specific';
  account_names?: string;
  command_group_id: number;
  action: 'deny' | 'allow' | 'alert' | 'prompt_alert';
  remark?: string;
  user_ids?: number[];
  asset_ids?: number[];
  attributes?: FilterAttribute[];
  command_group?: CommandGroup;
  created_at: string;
  updated_at: string;
}

export interface FilterAttribute {
  id: number;
  filter_id: number;
  target_type: 'user' | 'asset';
  name: string;
  value: string;
}

// 命令过滤请求类型
export interface CommandFilterListRequest {
  page?: number;
  page_size?: number;
  name?: string;
  enabled?: boolean;
}

export interface CommandFilterCreateRequest {
  name: string;
  priority: number;
  enabled: boolean;
  user_type: 'all' | 'specific' | 'attribute';
  asset_type: 'all' | 'specific' | 'attribute';
  account_type: 'all' | 'specific';
  account_names?: string;
  command_group_id: number;
  action: 'deny' | 'allow' | 'alert' | 'prompt_alert';
  remark?: string;
  user_ids?: number[];
  asset_ids?: number[];
  attributes?: FilterAttribute[];
}

export interface CommandFilterUpdateRequest {
  name?: string;
  priority?: number;
  enabled?: boolean;
  user_type?: 'all' | 'specific' | 'attribute';
  asset_type?: 'all' | 'specific' | 'attribute';
  account_type?: 'all' | 'specific';
  account_names?: string;
  command_group_id?: number;
  action?: 'deny' | 'allow' | 'alert' | 'prompt_alert';
  remark?: string;
  user_ids?: number[];
  asset_ids?: number[];
  attributes?: FilterAttribute[];
}

export const FilterAction = {
  DENY: 'deny',
  ALLOW: 'allow',
  ALERT: 'alert',
  PROMPT_ALERT: 'prompt_alert',
} as const;