# BaseApiService架构升级 - 技术设计文档

## 设计概述
本设计文档详细说明了BaseApiService架构的技术实现方案。通过创建统一的API服务基类，将分散在各处的响应格式适配逻辑集中管理，实现真正的请求响应统一处理，为前端API调用提供稳定、可扩展的基础架构。

## 现有代码分析

### 相关模块
- **responseAdapter.ts**: 当前的响应格式适配器，包含大量条件判断
- **apiClient.ts**: axios实例配置，提供基础HTTP客户端
- **各业务API文件**: 如credentialAPI.ts、auditAPI.ts等，直接使用apiClient
- **Redux slices**: 调用API并处理响应数据

### 依赖分析
- **axios**: HTTP客户端库
- **@reduxjs/toolkit**: 状态管理
- **TypeScript**: 类型系统

## 架构设计

### 整体架构
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Redux Slices   │────▶│  API Services    │────▶│  BaseApiService │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                            │
                                                            ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  responseAdapter │◀────│    apiClient    │
                        └──────────────────┘     └─────────────────┘
```

### 模块职责
- **BaseApiService**: 封装所有通用逻辑，包括请求发送、响应转换、错误处理
- **具体ApiService**: 继承BaseApiService，定义具体的API方法
- **responseAdapter**: 保留但简化，仅在BaseApiService内部使用
- **Redux Slices**: 调用ApiService方法，不再关心响应格式

## 核心组件设计

### BaseApiService基类（改进版）
```typescript
// src/services/base/BaseApiService.ts
import { AxiosInstance, AxiosResponse } from 'axios';
import { apiClient } from '../apiClient';
import { PaginatedResult } from '../types/common';
import { ApiError } from './ApiError';

export abstract class BaseApiService {
  protected client: AxiosInstance;
  protected endpoint: string;

  constructor(endpoint: string, client: AxiosInstance = apiClient) {
    this.endpoint = endpoint;
    this.client = client;
  }

  // 通用的GET请求
  protected async get<T>(url: string, params?: any): Promise<T> {
    try {
      const response = await this.client.get(url, { params });
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 通用的POST请求
  protected async post<T>(url: string, data?: any): Promise<T> {
    try {
      const response = await this.client.post(url, data);
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 通用的PUT请求
  protected async put<T>(url: string, data?: any): Promise<T> {
    try {
      const response = await this.client.put(url, data);
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 通用的DELETE请求（支持请求体）
  protected async delete<T>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.client.delete(url, config);
      return this.handleResponse<T>(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 统一的响应处理
  private handleResponse<T>(response: AxiosResponse): T {
    // 处理统一的响应包装格式
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      // 后端统一格式: { success: boolean, data?: T, error?: string }
      if (response.data.success === false) {
        throw new ApiError(
          response.data.error || 'Request failed',
          response.data.code,
          response.status,
          response.data.details
        );
      }
      // 提取实际数据
      const data = response.data.data;
      return this.transformData(data);
    }
    
    // 兼容旧格式或直接返回数据的情况
    return this.transformData(response.data);
  }

  // 数据转换逻辑
  private transformData(data: any): any {
    // 如果不是对象，直接返回
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    // 统一分页数据格式
    return this.unifyPaginatedData(data);
  }

  // 统一分页数据的字段名
  private unifyPaginatedData(data: any): any {
    // 检测是否为分页数据
    const paginationFields = ['page', 'page_size', 'total', 'total_pages'];
    const hasPaginationField = paginationFields.some(field => data.hasOwnProperty(field));
    
    if (hasPaginationField) {
      // 需要转换的字段映射
      const listFieldMap: Record<string, string> = {
        'users': 'items',
        'roles': 'items',
        'logs': 'items',
        'credentials': 'items',
        'assets': 'items',
        // 添加其他需要转换的字段
      };
      
      // 智能识别并转换
      for (const [oldField, newField] of Object.entries(listFieldMap)) {
        if (data[oldField] !== undefined && Array.isArray(data[oldField])) {
          data[newField] = data[oldField];
          if (oldField !== newField) {
            delete data[oldField];
          }
          break;
        }
      }
      
      // 处理嵌套的pagination字段
      if (data.pagination) {
        Object.assign(data, data.pagination);
        delete data.pagination;
      }
    }
    
    return data;
  }

  // 统一的错误处理
  private handleError(error: any): ApiError {
    // 开发环境下输出详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${this.constructor.name}] API Error:`, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        error: error
      });
    }
    
    return ApiError.fromResponse(error);
  }
  
  // 供子类使用的辅助方法
  protected buildUrl(path: string): string {
    return `${this.endpoint}${path}`;
  }
}
```

### ApiError错误类
```typescript
// src/services/base/ApiError.ts
export class ApiError extends Error {
  public code?: string;
  public status?: number;
  public details?: any;

  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /**
   * 从axios错误响应创建ApiError
   */
  static fromResponse(error: any): ApiError {
    if (error.response?.data) {
      const data = error.response.data;
      return new ApiError(
        data.error || data.message || 'Request failed',
        data.code,
        error.response.status,
        data.details
      );
    }
    
    if (error.request) {
      return new ApiError('Network error', 'NETWORK_ERROR');
    }
    
    return new ApiError(error.message || 'Unknown error', 'UNKNOWN_ERROR');
  }
}
```

### CredentialApiService实现示例
```typescript
// src/services/api/CredentialApiService.ts
import { BaseApiService, PaginatedResponse } from '../base/BaseApiService';
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

export class CredentialApiService extends BaseApiService {
  constructor() {
    super('/credentials');
  }

  // 获取凭证列表
  async getCredentials(params: GetCredentialsParams = {}): Promise<PaginatedResponse<Credential>> {
    return this.getPaginated<Credential>('', { params });
  }

  // 获取单个凭证
  async getCredentialById(id: number): Promise<Credential> {
    return this.getOne<Credential>(`/${id}`);
  }

  // 创建凭证
  async createCredential(data: CreateCredentialRequest): Promise<Credential> {
    return this.post<Credential>('', data);
  }

  // 更新凭证
  async updateCredential(id: number, data: Partial<CreateCredentialRequest>): Promise<Credential> {
    return this.put<Credential>(`/${id}`, data);
  }

  // 删除凭证
  async deleteCredential(id: number): Promise<void> {
    return this.delete(`/${id}`);
  }

  // 批量删除凭证
  async batchDeleteCredentials(ids: number[]): Promise<void> {
    return this.delete('/batch', { data: { ids } });
  }
}

// 导出单例实例
export const credentialApiService = new CredentialApiService();
```

### Redux集成改造
```typescript
// src/store/credentialSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { credentialApiService } from '../services/api/CredentialApiService';

// 获取凭证列表
export const fetchCredentials = createAsyncThunk(
  'credential/fetchCredentials',
  async (params: GetCredentialsParams) => {
    // 直接使用Service返回的标准化数据
    const response = await credentialApiService.getCredentials(params);
    return {
      credentials: response.items,
      total: response.total,
      page: response.page,
      page_size: response.page_size,
    };
  }
);
```

## 数据模型设计

### 核心类型定义
```typescript
// src/services/base/types.ts
export interface BaseEntity {
  id: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface SortParams {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

## 文件修改计划

### 新建文件
- `src/services/base/BaseApiService.ts` - 基类实现
- `src/services/base/types.ts` - 基础类型定义
- `src/services/api/CredentialApiService.ts` - 凭证管理Service
- `src/services/api/AuditApiService.ts` - 审计日志Service
- `src/services/api/index.ts` - 统一导出

### 修改文件
- `src/store/credentialSlice.ts` - 使用CredentialApiService
- `src/store/auditSlice.ts` - 使用AuditApiService
- `src/services/responseAdapter.ts` - 优化并保留核心逻辑

### 后续迁移文件
- `src/services/api/UserApiService.ts`
- `src/services/api/RoleApiService.ts`
- `src/services/api/AssetApiService.ts`

## 错误处理策略
- 网络错误：在BaseApiService中统一捕获并记录
- 业务错误：返回标准错误格式，由Redux层处理
- 格式错误：在适配器中处理，提供默认值

## 性能优化考虑
- 响应数据按需转换，避免深拷贝
- 开发环境开启调试日志，生产环境自动关闭
- 预留缓存接口，支持未来添加请求缓存

## 测试策略
### 单元测试
- BaseApiService的核心方法测试
- 响应格式适配器的各种场景测试
- 各ApiService的方法测试

### 集成测试
- Redux集成测试
- 端到端的API调用测试

## 迁移计划
### 第一阶段（1-2天）
1. 实现BaseApiService基类
2. 迁移凭证管理模块作为示例
3. 验证功能正常

### 第二阶段（2-3天）
1. 迁移审计日志、SSH会话等问题模块
2. 优化responseAdapter
3. 完善错误处理

### 第三阶段（3-5天）
1. 迁移剩余模块
2. 移除冗余代码
3. 完善文档和测试

## 风险缓解措施
- 保持原有API文件，逐步废弃
- 每个模块独立迁移，降低风险
- 充分的日志和错误追踪
- 完整的回滚方案