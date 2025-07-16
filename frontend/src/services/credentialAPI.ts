import { apiClient } from './apiClient';

export interface Credential {
  id: number;
  name: string;
  type: 'password' | 'key';
  username: string;
  assets?: AssetInfo[];
  created_at: string;
  updated_at: string;
}

export interface AssetInfo {
  id: number;
  name: string;
  address: string;
  port: number;
  protocol: string;
}

export interface GetCredentialsParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  type?: 'password' | 'key';
  asset_id?: number;
}

export interface GetCredentialsResponse {
  data: {
    credentials: Credential[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_page: number;
    };
  };
  success: boolean;
}

export interface CreateCredentialRequest {
  name: string;
  type: 'password' | 'key';
  username: string;
  password?: string;
  private_key?: string;
  asset_ids: number[];
}

export interface UpdateCredentialRequest {
  name?: string;
  type?: 'password' | 'key';
  username?: string;
  password?: string;
  private_key?: string;
}

export interface ConnectionTestRequest {
  asset_id: number;
  credential_id: number;
  test_type: 'ping' | 'ssh' | 'rdp' | 'database';
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
  tested_at: string;
}

export const getCredentials = async (params: GetCredentialsParams = {}) => {
  const response = await apiClient.get<GetCredentialsResponse>('/credentials', { params });
  return response;
};

export const getCredentialById = async (id: number) => {
  const response = await apiClient.get<Credential>(`/credentials/${id}`);
  return response;
};

export const createCredential = async (credentialData: CreateCredentialRequest) => {
  const response = await apiClient.post<Credential>('/credentials', credentialData);
  return response;
};

export const updateCredential = async (id: number, credentialData: UpdateCredentialRequest) => {
  const response = await apiClient.put<Credential>(`/credentials/${id}`, credentialData);
  return response;
};

export const deleteCredential = async (id: number) => {
  const response = await apiClient.delete(`/credentials/${id}`);
  return response;
};

export const batchDeleteCredentials = async (ids: number[]) => {
  const response = await apiClient.delete('/credentials/batch', { data: { ids } });
  return response;
};

export const testConnection = async (testData: ConnectionTestRequest) => {
  const response = await apiClient.post<ConnectionTestResponse>('/assets/test-connection', testData);
  return response;
}; 