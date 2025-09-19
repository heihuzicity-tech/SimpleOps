import { apiClient } from './apiClient';

export interface AssetGroup {
  id: number;
  name: string;
  description: string;
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  name: string;
  type: 'server' | 'database';
  address: string;
  port: number;
  protocol: string;
  tags: string;
  status: number;
  created_at: string;
  updated_at: string;
  groups?: AssetGroup[];
}

export interface GetAssetsParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  type?: string;
  group_id?: number;
}

export interface GetAssetsResponse {
  success: boolean;
  data: {
    items: Asset[];
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface CreateAssetRequest {
  name: string;
  type: string;
  address: string;
  port: number;
  protocol: string;
  tags: string;
  credential_ids?: number[];
}

export interface TestConnectionRequest {
  asset_id: number;
  credential_id: number;
  test_type: 'ping' | 'ssh' | 'rdp' | 'database';
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
  tested_at?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  data: TestConnectionResult;
}

export const getAssets = async (params: GetAssetsParams = {}) => {
  const response = await apiClient.get<GetAssetsResponse>('/assets', { params });
  return response;
};

export const getAssetById = async (id: number) => {
  const response = await apiClient.get<Asset>(`/assets/${id}`);
  return response;
};

export const createAsset = async (assetData: CreateAssetRequest) => {
  const response = await apiClient.post<Asset>('/assets', assetData);
  return response;
};

export const updateAsset = async (id: number, assetData: Partial<Asset>) => {
  const response = await apiClient.put<Asset>(`/assets/${id}`, assetData);
  return response;
};

export const deleteAsset = async (id: number) => {
  const response = await apiClient.delete(`/assets/${id}`);
  return response;
};

export const batchDeleteAssets = async (ids: number[]) => {
  const response = await apiClient.delete('/assets/batch', { data: { ids } });
  return response;
};

export const testConnection = async (request: TestConnectionRequest) => {
  const response = await apiClient.post<TestConnectionResponse>('/assets/test-connection', request);
  return response;
};

// ======================== 资产分组管理 ========================

export interface AssetGroupCreateRequest {
  name: string;
  description?: string;
}

export interface AssetGroupUpdateRequest {
  name?: string;
  description?: string;
}

export interface GetAssetGroupsParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface GetAssetGroupsResponse {
  success: boolean;
  data: AssetGroup[];
  total: number;
}

// 获取资产分组列表
export const getAssetGroups = async (params?: GetAssetGroupsParams) => {
  const response = await apiClient.get<GetAssetGroupsResponse>('/asset-groups', { params });
  return response;
};

// 创建资产分组
export const createAssetGroup = async (data: AssetGroupCreateRequest) => {
  const response = await apiClient.post('/asset-groups', data);
  return response;
};

// 获取单个资产分组
export const getAssetGroup = async (id: number) => {
  const response = await apiClient.get(`/asset-groups/${id}`);
  return response;
};

// 更新资产分组
export const updateAssetGroup = async (id: number, data: AssetGroupUpdateRequest) => {
  const response = await apiClient.put(`/asset-groups/${id}`, data);
  return response;
};

// 删除资产分组
export const deleteAssetGroup = async (id: number) => {
  const response = await apiClient.delete(`/asset-groups/${id}`);
  return response;
};

// ======================== 新增：包含主机详情的分组管理 ========================

export interface AssetItem {
  id: number;
  name: string;
  address: string;
  status: number;
  os_type: string;
  protocol: string;
}

export interface AssetGroupWithHosts {
  id: number;
  name: string;
  description: string;
  asset_count: number;
  assets: AssetItem[];
  created_at: string;
  updated_at: string;
}

export interface GetAssetGroupsWithHostsParams {
  type?: 'server' | 'database';
}

export interface GetAssetGroupsWithHostsResponse {
  success: boolean;
  data: AssetGroupWithHosts[];
}

// 获取包含主机详情的资产分组列表（用于控制台树形菜单）
export const getAssetGroupsWithHosts = async (params?: GetAssetGroupsWithHostsParams) => {
  const response = await apiClient.get<GetAssetGroupsWithHostsResponse>('/asset-groups/with-hosts', { params });
  return response;
}; 