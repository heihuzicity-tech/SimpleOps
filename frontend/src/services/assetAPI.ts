import { apiClient } from './apiClient';

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
}

export interface GetAssetsParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  type?: string;
}

export interface GetAssetsResponse {
  data: {
    assets: Asset[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_page: number;
    };
  };
  success: boolean;
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

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latency?: number;
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

export const testConnection = async (id: number) => {
  const response = await apiClient.post<TestConnectionResponse>(`/assets/${id}/test-connection`);
  return response;
};

export const getAssetGroups = async () => {
  const response = await apiClient.get('/assets/groups');
  return response;
}; 