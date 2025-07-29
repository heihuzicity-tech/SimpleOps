/**
 * 响应格式适配器
 * 用于统一处理后端API响应格式的差异
 * 支持渐进式迁移，兼容新旧格式
 */

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 适配分页响应格式
 * 将不同的响应格式统一转换为标准格式
 */
export const adaptPaginatedResponse = <T>(response: any): PaginatedResponse<T> => {
  // 如果响应数据不存在，返回空结果
  if (!response || !response.data) {
    return {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0
    };
  }

  const data = response.data;

  // 1. 新统一格式 - 嵌套数据格式 response.data.data.items
  if (data.data && data.data.items !== undefined) {
    const nestedData = data.data;
    return {
      items: nestedData.items || [],
      total: nestedData.total || 0,
      page: nestedData.page || 1,
      page_size: nestedData.page_size || 10,
      total_pages: nestedData.total_pages || Math.ceil((nestedData.total || 0) / (nestedData.page_size || 10))
    };
  }

  // 2. 新统一格式 - 直接数据格式 response.data.items
  if (data.items !== undefined) {
    return {
      items: data.items || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 2. 用户管理模块旧格式 - users 字段
  if (data.users !== undefined) {
    return {
      items: data.users || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 3. 角色管理模块旧格式 - roles 字段
  if (data.roles !== undefined) {
    return {
      items: data.roles || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 4. 命令过滤模块格式 - data 字段
  if (data.data !== undefined && Array.isArray(data.data)) {
    return {
      items: data.data || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 5. 资产管理模块格式 - assets 字段和嵌套的 pagination
  if (data.assets !== undefined) {
    const pagination = data.pagination || {};
    return {
      items: data.assets || [],
      total: pagination.total || data.total || 0,
      page: pagination.page || data.page || 1,
      page_size: pagination.page_size || data.page_size || 10,
      total_pages: pagination.total_page || pagination.total_pages || Math.ceil((pagination.total || 0) / (pagination.page_size || 10))
    };
  }

  // 6. 资产分组模块格式 - groups 字段
  if (data.groups !== undefined) {
    return {
      items: data.groups || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 7. 其他可能的格式 - 尝试查找任何数组字段
  const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
  if (arrayKeys.length > 0) {
    const itemsKey = arrayKeys[0];
    return {
      items: data[itemsKey] || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
      total_pages: data.total_pages || Math.ceil((data.total || 0) / (data.page_size || 10))
    };
  }

  // 默认返回空结果
  return {
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 0
  };
};

/**
 * 适配单项响应格式
 * 确保响应数据的一致性
 */
export const adaptSingleResponse = <T>(response: any): T | null => {
  if (!response || !response.data) {
    return null;
  }

  // 如果是嵌套的 data.data 格式
  if (response.data.data !== undefined && !Array.isArray(response.data.data)) {
    return response.data.data;
  }

  // 否则直接返回 data
  return response.data;
};

/**
 * 检查响应是否成功
 */
export const isSuccessResponse = (response: any): boolean => {
  return response && response.success === true;
};

/**
 * 获取错误信息
 */
export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return '请求失败，请稍后重试';
};