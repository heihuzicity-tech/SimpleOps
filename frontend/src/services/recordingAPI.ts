import { apiClient } from './apiClient';

// 录制列表请求参数
export interface RecordingListRequest {
  page?: number;
  page_size?: number;
  session_id?: string;
  user_id?: number;
  asset_id?: number;
  status?: 'recording' | 'completed' | 'failed';
  format?: 'asciicast' | 'json' | 'mp4';
  start_time?: string;
  end_time?: string;
}

// 录制记录响应
export interface RecordingResponse {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  asset_name: string;
  start_time: string;
  end_time?: string;
  duration: number;
  file_path: string;
  file_size: number;
  compressed_size: number;
  format: string;
  terminal_width: number;
  terminal_height: number;
  compression_ratio: number;
  record_count: number;
  status: string;
  created_at: string;
  can_download: boolean;
  can_view: boolean;
  can_delete: boolean;
}

// 分页结果
export interface RecordingListResponse {
  items: RecordingResponse[];
  total: number;
  page: number;
  page_size: number;
}

// 活跃录制响应
export interface ActiveRecordingResponse {
  active_recordings: Record<string, {
    session_id: string;
    user_id: number;
    asset_id: number;
    start_time: string;
    status: string;
  }>;
  total_count: number;
}

// 批量操作响应
export interface BatchOperationResponse {
  task_id: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: BatchOperationResult[];
  download_url?: string; // 批量下载时返回
  message?: string;
}

// 批量操作结果
export interface BatchOperationResult {
  recording_id: number;
  success: boolean;
  error?: string;
  message?: string;
}

// 录屏API服务
export class RecordingAPI {
  /**
   * 获取录制列表
   */
  static async getRecordingList(params: RecordingListRequest): Promise<RecordingListResponse> {
    const response = await apiClient.get('/recording/list', { params });
    return response.data.data;
  }

  /**
   * 获取录制详情
   */
  static async getRecordingDetail(id: number): Promise<RecordingResponse> {
    const response = await apiClient.get(`/recording/${id}`);
    return response.data.data;
  }

  /**
   * 下载录制文件
   */
  static async downloadRecording(id: number): Promise<Blob> {
    const response = await apiClient.get(`/recording/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * 删除录制记录
   */
  static async deleteRecording(id: number): Promise<void> {
    await apiClient.delete(`/recording/${id}`);
  }

  /**
   * 获取活跃录制
   */
  static async getActiveRecordings(): Promise<ActiveRecordingResponse> {
    const response = await apiClient.get('/recording/active');
    return response.data.data;
  }

  /**
   * 获取录制文件内容（用于播放）
   */
  static async getRecordingFile(id: number): Promise<string> {
    const response = await apiClient.get(`/recording/${id}/download`, {
      responseType: 'text',
      params: { format: 'json' },
      headers: { 'X-Player-Request': 'true' },
    });
    return response.data;
  }

  /**
   * 批量删除录制记录
   */
  static async batchDeleteRecordings(recordingIds: number[], reason: string): Promise<BatchOperationResponse> {
    const response = await apiClient.post('/recording/batch/delete', {
      recording_ids: recordingIds,
      operation: 'delete',
      reason,
    });
    return response.data.data;
  }

  /**
   * 批量下载录制文件
   */
  static async batchDownloadRecordings(recordingIds: number[]): Promise<BatchOperationResponse> {
    const response = await apiClient.post('/recording/batch/download', {
      recording_ids: recordingIds,
      operation: 'download',
    });
    return response.data.data;
  }

  /**
   * 批量归档录制记录
   */
  static async batchArchiveRecordings(recordingIds: number[], reason: string): Promise<BatchOperationResponse> {
    const response = await apiClient.post('/recording/batch/archive', {
      recording_ids: recordingIds,
      operation: 'archive',
      reason,
    });
    return response.data.data;
  }

  /**
   * 获取批量操作状态
   */
  static async getBatchOperationStatus(taskId: string): Promise<BatchOperationResponse> {
    const response = await apiClient.get(`/recording/batch/status/${taskId}`);
    return response.data.data;
  }
}

export default RecordingAPI;