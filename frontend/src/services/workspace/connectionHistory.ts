import { ConnectionHistory } from '../../types/workspace';

const STORAGE_KEY = 'bastion_connection_history';
const MAX_HISTORY_ITEMS = 50;

export class ConnectionHistoryService {
  // 添加连接历史记录
  static addConnectionHistory(connectionInfo: {
    assetId: number;
    assetName: string;
    assetAddress: string;
    credentialId: number;
    username: string;
    protocol: string;
    connectedAt: Date;
    duration?: number;
    status: 'success' | 'failed' | 'timeout';
  }): void {
    try {
      const history = this.getConnectionHistory();
      
      // 检查是否已存在相同的连接记录（最近1小时内）
      const recentRecord = history.find(item => 
        item.assetId === connectionInfo.assetId &&
        item.credentialId === connectionInfo.credentialId &&
        (new Date().getTime() - new Date(item.connectedAt).getTime()) < 3600000 // 1小时
      );

      if (recentRecord) {
        // 更新现有记录
        recentRecord.connectedAt = connectionInfo.connectedAt;
        recentRecord.duration = connectionInfo.duration || 0;
        recentRecord.status = connectionInfo.status;
      } else {
        // 添加新记录
        const newRecord: ConnectionHistory = {
          id: `${Date.now()}-${connectionInfo.assetId}-${connectionInfo.credentialId}`,
          assetId: connectionInfo.assetId,
          assetName: connectionInfo.assetName,
          assetAddress: connectionInfo.assetAddress,
          credentialId: connectionInfo.credentialId,
          username: connectionInfo.username,
          protocol: connectionInfo.protocol,
          connectedAt: connectionInfo.connectedAt,
          duration: connectionInfo.duration || 0,
          status: connectionInfo.status
        };

        history.unshift(newRecord);
      }

      // 限制历史记录数量
      if (history.length > MAX_HISTORY_ITEMS) {
        history.splice(MAX_HISTORY_ITEMS);
      }

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('保存连接历史记录失败:', error);
    }
  }

  // 获取连接历史记录
  static getConnectionHistory(): ConnectionHistory[] {
    try {
      const historyData = localStorage.getItem(STORAGE_KEY);
      if (!historyData) return [];

      const history = JSON.parse(historyData);
      
      // 验证和清理数据
      return history.filter((item: any) => {
        return item.id && 
               item.assetId && 
               item.assetName && 
               item.credentialId && 
               item.username &&
               item.connectedAt;
      }).map((item: any) => ({
        ...item,
        connectedAt: new Date(item.connectedAt)
      }));
    } catch (error) {
      console.error('加载连接历史记录失败:', error);
      return [];
    }
  }

  // 获取最近的连接记录
  static getRecentConnections(limit: number = 10): ConnectionHistory[] {
    const history = this.getConnectionHistory();
    return history.slice(0, limit);
  }

  // 获取特定资产的历史记录
  static getAssetHistory(assetId: number): ConnectionHistory[] {
    const history = this.getConnectionHistory();
    return history.filter(item => item.assetId === assetId);
  }

  // 获取特定用户的历史记录
  static getUserHistory(username: string): ConnectionHistory[] {
    const history = this.getConnectionHistory();
    return history.filter(item => item.username === username);
  }

  // 清空历史记录
  static clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // 删除特定记录
  static removeHistoryItem(id: string): void {
    try {
      const history = this.getConnectionHistory();
      const filteredHistory = history.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('删除历史记录失败:', error);
    }
  }

  // 更新连接状态
  static updateConnectionStatus(id: string, status: 'success' | 'failed' | 'timeout', duration?: number): void {
    try {
      const history = this.getConnectionHistory();
      const record = history.find(item => item.id === id);
      
      if (record) {
        record.status = status;
        if (duration !== undefined) {
          record.duration = duration;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('更新连接状态失败:', error);
    }
  }

  // 获取连接统计信息
  static getConnectionStats(): {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    timeoutConnections: number;
    averageDuration: number;
    mostUsedAssets: { assetName: string; count: number }[];
  } {
    const history = this.getConnectionHistory();
    
    const stats = {
      totalConnections: history.length,
      successfulConnections: history.filter(item => item.status === 'success').length,
      failedConnections: history.filter(item => item.status === 'failed').length,
      timeoutConnections: history.filter(item => item.status === 'timeout').length,
      averageDuration: 0,
      mostUsedAssets: [] as { assetName: string; count: number }[]
    };

    // 计算平均连接时长
    const successfulConnections = history.filter(item => item.status === 'success' && item.duration && item.duration > 0);
    if (successfulConnections.length > 0) {
      stats.averageDuration = successfulConnections.reduce((sum, item) => sum + (item.duration || 0), 0) / successfulConnections.length;
    }

    // 统计最常用的资产
    const assetCounts = history.reduce((acc, item) => {
      acc[item.assetName] = (acc[item.assetName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    stats.mostUsedAssets = Object.entries(assetCounts)
      .map(([assetName, count]) => ({ assetName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  // 检查是否有重复连接
  static hasRecentConnection(assetId: number, credentialId: number, withinMinutes: number = 5): boolean {
    const history = this.getConnectionHistory();
    const cutoffTime = new Date().getTime() - (withinMinutes * 60 * 1000);
    
    return history.some(item => 
      item.assetId === assetId &&
      item.credentialId === credentialId &&
      new Date(item.connectedAt).getTime() > cutoffTime
    );
  }
}

export default ConnectionHistoryService;