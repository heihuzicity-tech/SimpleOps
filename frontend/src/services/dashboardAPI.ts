import { apiClient } from './apiClient';

// 仪表盘API服务
class DashboardAPI {
  // 获取完整仪表盘数据
  static async getCompleteDashboard() {
    const response = await apiClient.get('/dashboard');
    return response.data.data;
  }

  // 获取仪表盘统计数据
  static async getDashboardStats() {
    const response = await apiClient.get('/dashboard/stats');
    return response.data.data;
  }

  // 获取最近登录记录
  static async getRecentLogins(limit: number = 10) {
    const response = await apiClient.get('/dashboard/recent-logins', {
      params: { limit }
    });
    return response.data.data;
  }

  // 获取主机分组分布
  static async getHostDistribution() {
    const response = await apiClient.get('/dashboard/host-distribution');
    return response.data.data;
  }

  // 获取活跃趋势数据
  static async getActivityTrends(days: number = 7) {
    const response = await apiClient.get('/dashboard/activity-trends', {
      params: { days }
    });
    return response.data.data;
  }

  // 获取审计统计摘要
  static async getAuditSummary() {
    const response = await apiClient.get('/dashboard/audit-summary');
    return response.data.data;
  }

  // 获取快速访问列表
  static async getQuickAccess(limit: number = 5) {
    const response = await apiClient.get('/dashboard/quick-access', {
      params: { limit }
    });
    return response.data.data;
  }
}

export default DashboardAPI;