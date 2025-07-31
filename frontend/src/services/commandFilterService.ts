import {
  Command,
  CommandGroup,
  CommandPolicy,
  CommandInterceptLog,
  CommandFilter,
  CommandListRequest,
  CommandCreateRequest,
  CommandUpdateRequest,
  CommandGroupListRequest,
  CommandGroupCreateRequest,
  CommandGroupUpdateRequest,
  PolicyListRequest,
  PolicyCreateRequest,
  PolicyUpdateRequest,
  PolicyBindUsersRequest,
  PolicyBindCommandsRequest,
  InterceptLogListRequest,
  CommandFilterListRequest,
  CommandFilterCreateRequest,
  CommandFilterUpdateRequest,
  CommandFilterPaginatedResponse,
  ApiResponse,
} from '../types';
import { apiClient } from './apiClient';

const BASE_URL = '/command-filter';

// 命令管理 API
export const commandAPI = {
  // 获取命令列表
  getCommands: async (params: CommandListRequest): Promise<ApiResponse<CommandFilterPaginatedResponse<Command>>> => {
    const response = await apiClient.get(`${BASE_URL}/commands`, { params });
    return response.data;
  },

  // 创建命令
  createCommand: async (data: CommandCreateRequest): Promise<ApiResponse<Command>> => {
    const response = await apiClient.post(`${BASE_URL}/commands`, data);
    return response.data;
  },

  // 更新命令
  updateCommand: async (id: number, data: CommandUpdateRequest): Promise<ApiResponse<Command>> => {
    const response = await apiClient.put(`${BASE_URL}/commands/${id}`, data);
    return response.data;
  },

  // 删除命令
  deleteCommand: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`${BASE_URL}/commands/${id}`);
    return response.data;
  },
};

// 命令组管理 API
export const commandGroupAPI = {
  // 获取命令组列表
  getCommandGroups: async (params: CommandGroupListRequest): Promise<ApiResponse<CommandFilterPaginatedResponse<CommandGroup>>> => {
    const response = await apiClient.get(`${BASE_URL}/groups`, { params });
    return response.data;
  },

  // 创建命令组
  createCommandGroup: async (data: CommandGroupCreateRequest): Promise<ApiResponse<CommandGroup>> => {
    const response = await apiClient.post(`${BASE_URL}/groups`, data);
    return response.data;
  },

  // 更新命令组
  updateCommandGroup: async (id: number, data: CommandGroupUpdateRequest): Promise<ApiResponse<CommandGroup>> => {
    const response = await apiClient.put(`${BASE_URL}/groups/${id}`, data);
    return response.data;
  },

  // 删除命令组
  deleteCommandGroup: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`${BASE_URL}/groups/${id}`);
    return response.data;
  },
};

// 策略管理 API
export const policyAPI = {
  // 获取策略列表
  getPolicies: async (params: PolicyListRequest): Promise<ApiResponse<CommandFilterPaginatedResponse<CommandPolicy>>> => {
    const response = await apiClient.get(`${BASE_URL}/policies`, { params });
    return response.data;
  },

  // 创建策略
  createPolicy: async (data: PolicyCreateRequest): Promise<ApiResponse<CommandPolicy>> => {
    const response = await apiClient.post(`${BASE_URL}/policies`, data);
    return response.data;
  },

  // 更新策略
  updatePolicy: async (id: number, data: PolicyUpdateRequest): Promise<ApiResponse<CommandPolicy>> => {
    const response = await apiClient.put(`${BASE_URL}/policies/${id}`, data);
    return response.data;
  },

  // 删除策略
  deletePolicy: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`${BASE_URL}/policies/${id}`);
    return response.data;
  },

  // 绑定用户到策略
  bindUsers: async (id: number, data: PolicyBindUsersRequest): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`${BASE_URL}/policies/${id}/bind-users`, data);
    return response.data;
  },

  // 绑定命令/命令组到策略
  bindCommands: async (id: number, data: PolicyBindCommandsRequest): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`${BASE_URL}/policies/${id}/bind-commands`, data);
    return response.data;
  },
};

// 拦截日志 API
export const interceptLogAPI = {
  // 获取拦截日志列表
  getInterceptLogs: async (params: InterceptLogListRequest): Promise<ApiResponse<CommandFilterPaginatedResponse<CommandInterceptLog>>> => {
    const response = await apiClient.get(`${BASE_URL}/intercept-logs`, { params });
    return response.data;
  },

  // 获取日志统计信息
  getLogStatistics: async (): Promise<ApiResponse<{
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  }>> => {
    const response = await apiClient.get(`${BASE_URL}/intercept-logs/statistics`);
    return response.data;
  },
};

// 命令过滤规则 API
export const filterAPI = {
  // 获取过滤规则列表
  getFilters: async (params: CommandFilterListRequest): Promise<ApiResponse<CommandFilterPaginatedResponse<CommandFilter>>> => {
    const response = await apiClient.get(`${BASE_URL}/filters`, { params });
    return response.data;
  },

  // 获取过滤规则详情
  getFilter: async (id: number): Promise<ApiResponse<CommandFilter>> => {
    const response = await apiClient.get(`${BASE_URL}/filters/${id}`);
    return response.data;
  },

  // 创建过滤规则
  createFilter: async (data: CommandFilterCreateRequest): Promise<ApiResponse<CommandFilter>> => {
    const response = await apiClient.post(`${BASE_URL}/filters`, data);
    return response.data;
  },

  // 更新过滤规则
  updateFilter: async (id: number, data: CommandFilterUpdateRequest): Promise<ApiResponse<CommandFilter>> => {
    const response = await apiClient.put(`${BASE_URL}/filters/${id}`, data);
    return response.data;
  },

  // 删除过滤规则
  deleteFilter: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`${BASE_URL}/filters/${id}`);
    return response.data;
  },

  // 启用/禁用过滤规则
  toggleFilter: async (id: number): Promise<ApiResponse<CommandFilter>> => {
    const response = await apiClient.patch(`${BASE_URL}/filters/${id}/toggle`);
    return response.data;
  },
};

// 统一导出
export const commandFilterService = {
  command: commandAPI,
  commandGroup: commandGroupAPI,
  policy: policyAPI,
  interceptLog: interceptLogAPI,
  filter: filterAPI,
};

export default commandFilterService;