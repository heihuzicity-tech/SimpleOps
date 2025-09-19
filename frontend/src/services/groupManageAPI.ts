import { apiClient } from './apiClient';

// 批量移动资产请求接口
export interface AssetBatchMoveRequest {
  asset_ids: number[];
  target_group_id: number | null; // null 表示移出所有分组
}

// 批量移动资产响应接口
export interface AssetBatchMoveResponse {
  success: boolean;
  message: string;
  data: {
    moved_count: number;
    target_group_id: number | null;
  };
}

/**
 * 批量移动资产到分组（管理员专用）
 */
export const batchMoveAssets = async (request: AssetBatchMoveRequest): Promise<AssetBatchMoveResponse> => {
  const response = await apiClient.post('/admin/assets/batch-move', request);
  return response.data;
};

/**
 * 获取指定分组下的资产列表
 */
export const getAssetsByGroup = async (groupId: number | null, params: {
  page?: number;
  page_size?: number;
  keyword?: string;
}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params.keyword) queryParams.append('keyword', params.keyword);
  
  // 如果是查看未分组资产，使用特殊值0
  if (groupId === null) {
    queryParams.append('group_id', '0');
  } else {
    queryParams.append('group_id', groupId.toString());
  }
  
  const response = await apiClient.get(`/assets/?${queryParams.toString()}`);
  return response.data;
};

/**
 * 获取资产分组统计信息
 */
export const getGroupStatistics = async () => {
  const response = await apiClient.get('/asset-groups/?page=1&page_size=100');
  return response.data;
};