// 简化的API服务文件，用于支持新增的Hooks编译

import { 
  Asset, 
  AssetGroup, 
  Credential, 
  SSHSession, 
  ActiveSession, 
  CommandLog,
  ConnectionTestRequest,
  ConnectionTestResponse,
  SessionCreateRequest,
  SessionTerminateRequest,
  SessionWarningRequest,
  ApiResponse,
  PaginatedResponse 
} from '../types';

// 模拟的API基础配置
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 基础HTTP客户端（简化实现）
const httpClient = {
  get: async (url: string, params?: any): Promise<ApiResponse> => {
    // 实际实现中这里应该使用axios或fetch
    return Promise.resolve({ code: 200, message: 'success', data: {} });
  },
  
  post: async (url: string, data?: any): Promise<ApiResponse> => {
    return Promise.resolve({ code: 200, message: 'success', data: {} });
  },
  
  put: async (url: string, data?: any): Promise<ApiResponse> => {
    return Promise.resolve({ code: 200, message: 'success', data: {} });
  },
  
  delete: async (url: string): Promise<ApiResponse> => {
    return Promise.resolve({ code: 200, message: 'success', data: {} });
  },
};

// 资产相关API
export const getAssets = async (params?: any): Promise<ApiResponse<PaginatedResponse<Asset>>> => {
  return httpClient.get(`${API_BASE_URL}/assets`, params);
};

export const createAsset = async (asset: Partial<Asset>): Promise<ApiResponse<Asset>> => {
  return httpClient.post(`${API_BASE_URL}/assets`, asset);
};

export const updateAsset = async (id: number, asset: Partial<Asset>): Promise<ApiResponse<Asset>> => {
  return httpClient.put(`${API_BASE_URL}/assets/${id}`, asset);
};

export const deleteAsset = async (id: number): Promise<ApiResponse> => {
  return httpClient.delete(`${API_BASE_URL}/assets/${id}`);
};

export const testConnection = async (request: ConnectionTestRequest): Promise<ApiResponse<ConnectionTestResponse>> => {
  return httpClient.post(`${API_BASE_URL}/assets/test-connection`, request);
};

// 资产分组相关API
export const getAssetGroups = async (params?: any): Promise<ApiResponse<PaginatedResponse<AssetGroup>>> => {
  return httpClient.get(`${API_BASE_URL}/asset-groups`, params);
};

export const createAssetGroup = async (group: Partial<AssetGroup>): Promise<ApiResponse<AssetGroup>> => {
  return httpClient.post(`${API_BASE_URL}/asset-groups`, group);
};

export const updateAssetGroup = async (id: number, group: Partial<AssetGroup>): Promise<ApiResponse<AssetGroup>> => {
  return httpClient.put(`${API_BASE_URL}/asset-groups/${id}`, group);
};

export const deleteAssetGroup = async (id: number): Promise<ApiResponse> => {
  return httpClient.delete(`${API_BASE_URL}/asset-groups/${id}`);
};

// 凭证相关API
export const getCredentials = async (params?: any): Promise<ApiResponse<PaginatedResponse<Credential>>> => {
  return httpClient.get(`${API_BASE_URL}/credentials`, params);
};

export const createCredential = async (credential: Partial<Credential>): Promise<ApiResponse<Credential>> => {
  return httpClient.post(`${API_BASE_URL}/credentials`, credential);
};

export const updateCredential = async (id: number, credential: Partial<Credential>): Promise<ApiResponse<Credential>> => {
  return httpClient.put(`${API_BASE_URL}/credentials/${id}`, credential);
};

export const deleteCredential = async (id: number): Promise<ApiResponse> => {
  return httpClient.delete(`${API_BASE_URL}/credentials/${id}`);
};

// 会话相关API
export const getSessions = async (params?: any): Promise<ApiResponse<PaginatedResponse<SSHSession>>> => {
  return httpClient.get(`${API_BASE_URL}/sessions`, params);
};

export const getActiveSessions = async (params?: any): Promise<ApiResponse<PaginatedResponse<ActiveSession>>> => {
  return httpClient.get(`${API_BASE_URL}/sessions/active`, params);
};

export const createSession = async (request: SessionCreateRequest): Promise<ApiResponse<{ session_id: string }>> => {
  return httpClient.post(`${API_BASE_URL}/sessions`, request);
};

export const closeSession = async (sessionId: string): Promise<ApiResponse> => {
  return httpClient.delete(`${API_BASE_URL}/sessions/${sessionId}`);
};

export const terminateSession = async (sessionId: string, request: SessionTerminateRequest): Promise<ApiResponse> => {
  return httpClient.post(`${API_BASE_URL}/sessions/${sessionId}/terminate`, request);
};

export const getSessionDetails = async (sessionId: string): Promise<ApiResponse<SSHSession>> => {
  return httpClient.get(`${API_BASE_URL}/sessions/${sessionId}`);
};

export const getSessionCommands = async (sessionId: string): Promise<ApiResponse<PaginatedResponse<CommandLog>>> => {
  return httpClient.get(`${API_BASE_URL}/sessions/${sessionId}/commands`);
};

export const sendSessionWarning = async (sessionId: string, request: SessionWarningRequest): Promise<ApiResponse> => {
  return httpClient.post(`${API_BASE_URL}/sessions/${sessionId}/warning`, request);
};

// 导出默认配置
export default {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  testConnection,
  
  getAssetGroups,
  createAssetGroup,
  updateAssetGroup,
  deleteAssetGroup,
  
  getCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  
  getSessions,
  getActiveSessions,
  createSession,
  closeSession,
  terminateSession,
  getSessionDetails,
  getSessionCommands,
  sendSessionWarning,
};