import { useState, useEffect, useCallback } from 'react';

interface RecentConnection {
  id: number;
  name: string;
  address: string;
  port: number;
  protocol: string;
  os_type: string;
  lastConnected: string;
  connectionCount: number;
}

export const useRecentConnections = () => {
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>([]);
  
  // 从本地存储加载最近连接
  useEffect(() => {
    const saved = localStorage.getItem('recentConnections');
    if (saved) {
      try {
        const connections = JSON.parse(saved);
        setRecentConnections(connections);
      } catch (error) {
        console.error('Failed to parse recent connections:', error);
        localStorage.removeItem('recentConnections');
      }
    }
  }, []);
  
  // 添加最近连接记录
  const addRecentConnection = useCallback((asset: any) => {
    const connection: RecentConnection = {
      id: asset.id,
      name: asset.name,
      address: asset.address,
      port: asset.port,
      protocol: asset.protocol,
      os_type: asset.os_type,
      lastConnected: new Date().toISOString(),
      connectionCount: 1
    };
    
    setRecentConnections(prev => {
      // 检查是否已存在
      const existingIndex = prev.findIndex(conn => conn.id === asset.id);
      
      let newConnections;
      if (existingIndex >= 0) {
        // 更新现有记录
        newConnections = [...prev];
        newConnections[existingIndex] = {
          ...newConnections[existingIndex],
          lastConnected: new Date().toISOString(),
          connectionCount: newConnections[existingIndex].connectionCount + 1
        };
        // 移动到最前面
        const updated = newConnections.splice(existingIndex, 1)[0];
        newConnections.unshift(updated);
      } else {
        // 添加新记录到最前面
        newConnections = [connection, ...prev];
      }
      
      // 只保留最近10条记录
      const limited = newConnections.slice(0, 10);
      
      // 保存到本地存储
      localStorage.setItem('recentConnections', JSON.stringify(limited));
      
      return limited;
    });
  }, []);
  
  // 移除最近连接记录
  const removeRecentConnection = useCallback((assetId: number) => {
    setRecentConnections(prev => {
      const filtered = prev.filter(conn => conn.id !== assetId);
      localStorage.setItem('recentConnections', JSON.stringify(filtered));
      return filtered;
    });
  }, []);
  
  // 清空所有最近连接记录
  const clearRecentConnections = useCallback(() => {
    setRecentConnections([]);
    localStorage.removeItem('recentConnections');
  }, []);
  
  // 检查资产是否在最近连接中
  const isRecentConnection = useCallback((assetId: number): boolean => {
    return recentConnections.some(conn => conn.id === assetId);
  }, [recentConnections]);
  
  // 获取资产的连接次数
  const getConnectionCount = useCallback((assetId: number): number => {
    const connection = recentConnections.find(conn => conn.id === assetId);
    return connection?.connectionCount || 0;
  }, [recentConnections]);
  
  return {
    recentConnections,
    addRecentConnection,
    removeRecentConnection,
    clearRecentConnections,
    isRecentConnection,
    getConnectionCount
  };
};