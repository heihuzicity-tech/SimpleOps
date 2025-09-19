// 通用的API响应类型定义

// 分页结果接口（与BaseApiService中的保持一致）
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// API响应包装接口
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 查询参数接口
export interface QueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

// 通用的时间戳字段
export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// 通用的ID字段
export interface WithId {
  id: number;
}

// 错误响应接口
export interface ErrorResponse {
  error: string;
  message: string;
  code?: number;
  details?: any;
}