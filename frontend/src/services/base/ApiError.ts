/**
 * 统一的API错误类
 * 用于处理所有API调用中的错误情况
 */
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

export const isApiError = (error: any): error is ApiError => {
  return error instanceof ApiError;
};