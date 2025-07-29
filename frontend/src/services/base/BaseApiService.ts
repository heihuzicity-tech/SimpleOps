import { AxiosInstance } from 'axios';
import { apiClient } from '../apiClient';
import { PaginatedResult } from '../types/common';

// 重新导出，方便其他模块使用
export type { PaginatedResult } from '../types/common';

export abstract class BaseApiService {
  protected client: AxiosInstance;
  protected endpoint: string;
  
  constructor(endpoint: string, client: AxiosInstance = apiClient) {
    this.endpoint = endpoint;
    this.client = client;
  }
  
  // 通用的GET请求
  protected async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get(url, { params });
    return this.transformResponse(response);
  }
  
  // 通用的POST请求
  protected async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return this.transformResponse(response);
  }
  
  // 通用的PUT请求
  protected async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put(url, data);
    return this.transformResponse(response);
  }
  
  // 通用的DELETE请求
  protected async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete(url);
    return this.transformResponse(response);
  }
  
  // 核心转换逻辑
  private transformResponse(response: any): any {
    // 处理嵌套的data.data结构
    const data = response.data?.data || response.data;
    
    // 如果不是对象，直接返回
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    // 统一分页数据格式
    return this.unifyPaginatedData(data);
  }
  
  // 统一分页数据的字段名
  private unifyPaginatedData(data: any): any {
    // 如果数据中没有任何分页相关的字段，直接返回
    const paginationFields = ['page', 'page_size', 'total', 'total_pages'];
    const hasPaginationField = paginationFields.some(field => data.hasOwnProperty(field));
    
    // 需要转换的字段映射 - 仅用于分页响应的顶级列表字段
    const listFieldMap: Record<string, string> = {
      'users': 'items',
      'roles': 'items',  // 保留roles映射，用于角色列表API
      'logs': 'items',
      'records': 'items',
      'sessions': 'items',
      'assets': 'items',
      'groups': 'items',
      'credentials': 'items',
      // 未来新增模块只需在这里添加映射
    };
    
    // 只有在有分页字段时才进行列表字段转换
    // 这样可以避免误转换单个对象内部的数组字段（如user.roles）
    if (hasPaginationField) {
      // 智能识别并转换
      for (const [oldField, newField] of Object.entries(listFieldMap)) {
        if (data[oldField] !== undefined && Array.isArray(data[oldField])) {
          data[newField] = data[oldField];
          if (oldField !== newField) {
            delete data[oldField];
          }
          break; // 只处理第一个匹配的字段
        }
      }
      
      // 处理嵌套的pagination字段（兼容旧格式）
      if (data.pagination) {
        Object.assign(data, data.pagination);
        delete data.pagination;
      }
    }
    
    return data;
  }
  
  // 供子类使用的辅助方法
  protected buildUrl(path: string): string {
    return `${this.endpoint}${path}`;
  }
}