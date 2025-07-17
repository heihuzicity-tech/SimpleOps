// 测试数据工具函数
import ConnectionHistoryService from '../services/workspace/connectionHistory';

// 添加测试连接历史记录
export const addTestConnectionHistory = () => {
  // 清空现有记录
  ConnectionHistoryService.clearHistory();
  
  // 添加测试数据
  const testConnections = [
    {
      assetId: 1,
      assetName: 'web-server-01',
      assetAddress: '192.168.1.100',
      credentialId: 1,
      username: 'root',
      connectedAt: new Date(Date.now() - 1000 * 60 * 5), // 5分钟前
      duration: 120,
      status: 'success' as const
    },
    {
      assetId: 2,
      assetName: 'db-master',
      assetAddress: '192.168.1.101',
      credentialId: 2,
      username: 'mysql',
      connectedAt: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
      duration: 300,
      status: 'success' as const
    },
    {
      assetId: 3,
      assetName: 'app-server-02',
      assetAddress: '192.168.1.102',
      credentialId: 3,
      username: 'ubuntu',
      connectedAt: new Date(Date.now() - 1000 * 60 * 60), // 1小时前
      duration: 600,
      status: 'success' as const
    },
    {
      assetId: 4,
      assetName: 'redis-cluster',
      assetAddress: '192.168.1.103',
      credentialId: 4,
      username: 'redis',
      connectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2小时前
      duration: 0,
      status: 'failed' as const
    },
    {
      assetId: 5,
      assetName: 'nginx-proxy',
      assetAddress: '192.168.1.104',
      credentialId: 5,
      username: 'nginx',
      connectedAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6小时前
      duration: 450,
      status: 'success' as const
    }
  ];

  testConnections.forEach(conn => {
    ConnectionHistoryService.addConnectionHistory(conn);
  });

  console.log('测试连接历史记录已添加');
};

// 获取测试连接统计
export const getTestConnectionStats = () => {
  return ConnectionHistoryService.getConnectionStats();
};

// 清空测试数据
export const clearTestData = () => {
  ConnectionHistoryService.clearHistory();
  console.log('测试数据已清空');
};