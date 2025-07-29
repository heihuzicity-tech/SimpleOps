import { BaseApiService, PaginatedResult } from '../base/BaseApiService';
import { Credential } from '../../types';

export interface GetCredentialsParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  type?: 'password' | 'key';
  asset_id?: number;
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
  asset_ids?: number[];
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

export class CredentialApiService extends BaseApiService {
  private assetApiPath = '/assets';
  
  constructor() {
    super('/credentials');
  }

  // 获取凭证列表
  async getCredentials(params: GetCredentialsParams = {}): Promise<PaginatedResult<Credential>> {
    return this.get<PaginatedResult<Credential>>('', params);
  }

  // 获取单个凭证
  async getCredentialById(id: number): Promise<Credential> {
    return this.get<Credential>(`/${id}`);
  }

  // 创建凭证
  async createCredential(data: CreateCredentialRequest): Promise<Credential> {
    return this.post<Credential>('', data);
  }

  // 更新凭证
  async updateCredential(id: number, data: UpdateCredentialRequest): Promise<Credential> {
    return this.put<Credential>(`/${id}`, data);
  }

  // 删除凭证
  async deleteCredential(id: number): Promise<void> {
    return this.delete(`/${id}`);
  }

  // 批量删除凭证
  async batchDeleteCredentials(ids: number[]): Promise<void> {
    // 使用基类的delete方法，现在支持config参数
    return this.delete('/batch', { data: { ids } });
  }

  // 测试连接
  async testConnection(testData: ConnectionTestRequest): Promise<ConnectionTestResponse> {
    // 测试连接API在assets路径下，使用完整路径调用
    const originalEndpoint = this.endpoint;
    this.endpoint = this.assetApiPath;
    try {
      return await this.post<ConnectionTestResponse>('/test-connection', testData);
    } finally {
      this.endpoint = originalEndpoint;
    }
  }
}

// 导出单例实例
export const credentialApiService = new CredentialApiService();

// 导出兼容旧API的函数（保持向后兼容）
export const getCredentials = (params?: GetCredentialsParams) => {
  return {
    data: credentialApiService.getCredentials(params)
  };
};

export const getCredentialById = (id: number) => {
  return {
    data: credentialApiService.getCredentialById(id)
  };
};

export const createCredential = (credentialData: CreateCredentialRequest) => {
  return {
    data: credentialApiService.createCredential(credentialData)
  };
};

export const updateCredential = (id: number, credentialData: UpdateCredentialRequest) => {
  return {
    data: credentialApiService.updateCredential(id, credentialData)
  };
};

export const deleteCredential = (id: number) => {
  return credentialApiService.deleteCredential(id);
};

export const batchDeleteCredentials = (ids: number[]) => {
  return credentialApiService.batchDeleteCredentials(ids);
};

export const testConnection = (testData: ConnectionTestRequest) => {
  return {
    data: credentialApiService.testConnection(testData)
  };
};