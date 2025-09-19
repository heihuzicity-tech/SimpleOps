import { useState, useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { testConnection } from '../services/api';
import { Asset, Credential } from '../types';

// 连接状态类型
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

// 连接结果
export interface ConnectionResult {
  success: boolean;
  message: string;
  latency?: number;
  timestamp: number;
  error?: string;
}

// 连接监控配置
export interface ConnectionMonitorConfig {
  enabled: boolean;
  interval: number; // 毫秒
  timeout: number; // 毫秒
  maxRetries: number;
  retryDelay: number; // 毫秒
}

// 连接状态管理
interface ConnectionStatusState {
  status: ConnectionStatus;
  result?: ConnectionResult;
  history: ConnectionResult[];
  isMonitoring: boolean;
  config: ConnectionMonitorConfig;
  retryCount: number;
  lastTestTime?: number;
}

// 连接状态操作
interface ConnectionStatusActions {
  // 基础连接测试
  testConnection: (asset: Asset, credential: Credential) => Promise<boolean>;
  testAssetConnection: (assetId: number, credentialId: number) => Promise<boolean>;
  
  // 状态管理
  setStatus: (status: ConnectionStatus) => void;
  clearHistory: () => void;
  getStatusText: () => string;
  getStatusColor: () => string;
  
  // 连接监控
  startMonitoring: (asset: Asset, credential: Credential) => void;
  stopMonitoring: () => void;
  updateConfig: (config: Partial<ConnectionMonitorConfig>) => void;
  
  // 重连机制
  retry: () => Promise<boolean>;
  canRetry: () => boolean;
  
  // 统计信息
  getSuccessRate: () => number;
  getAverageLatency: () => number;
  getLastSuccessTime: () => number | undefined;
  getLastFailureTime: () => number | undefined;
}

// Hook返回类型
export interface UseConnectionStatusReturn extends ConnectionStatusState, ConnectionStatusActions {}

/**
 * 连接状态管理Hook
 * 提供连接测试、状态监控、自动重连等功能
 */
export const useConnectionStatus = (): UseConnectionStatusReturn => {
  // 状态管理
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [result, setResult] = useState<ConnectionResult | undefined>();
  const [history, setHistory] = useState<ConnectionResult[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastTestTime, setLastTestTime] = useState<number | undefined>();
  const [config, setConfig] = useState<ConnectionMonitorConfig>({
    enabled: false,
    interval: 30000, // 30秒
    timeout: 10000, // 10秒
    maxRetries: 3,
    retryDelay: 5000, // 5秒
  });

  // 引用
  const monitorTimerRef = useRef<NodeJS.Timeout>();
  const retryTimerRef = useRef<NodeJS.Timeout>();
  const currentAssetRef = useRef<Asset | null>(null);
  const currentCredentialRef = useRef<Credential | null>(null);

  // 执行连接测试
  const performConnectionTest = useCallback(async (asset: Asset, credential: Credential): Promise<boolean> => {
    setStatus('connecting');
    setLastTestTime(Date.now());
    
    try {
      const startTime = Date.now();
      const response = await testConnection({
        asset_id: asset.id,
        credential_id: credential.id,
        test_type: asset.protocol || 'ssh'
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      const responseData = response.data || { success: false, message: '', error: '' };
      const testResult: ConnectionResult = {
        success: responseData.success,
        message: responseData.message || '连接测试完成',
        latency,
        timestamp: Date.now(),
        error: responseData.success ? undefined : responseData.error
      };
      
      setResult(testResult);
      setHistory(prev => [testResult, ...prev.slice(0, 99)]); // 保留最近100条记录
      
      if (testResult.success) {
        setStatus('connected');
        setRetryCount(0); // 重置重试计数
      } else {
        setStatus('error');
      }
      
      return testResult.success;
    } catch (error: any) {
      const testResult: ConnectionResult = {
        success: false,
        message: '连接测试失败',
        timestamp: Date.now(),
        error: error.response?.data?.error || error.message
      };
      
      setResult(testResult);
      setHistory(prev => [testResult, ...prev.slice(0, 99)]);
      setStatus('error');
      
      return false;
    }
  }, []);

  // 测试连接（外部调用）
  const testConnectionHandler = useCallback(async (asset: Asset, credential: Credential): Promise<boolean> => {
    currentAssetRef.current = asset;
    currentCredentialRef.current = credential;
    
    const success = await performConnectionTest(asset, credential);
    
    if (!success && config.enabled && retryCount < config.maxRetries) {
      // 自动重试
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        performConnectionTest(asset, credential);
      }, config.retryDelay);
    }
    
    return success;
  }, [performConnectionTest, config, retryCount]);

  // 通过ID测试连接
  const testAssetConnection = useCallback(async (assetId: number, credentialId: number): Promise<boolean> => {
    setStatus('connecting');
    setLastTestTime(Date.now());
    
    try {
      const startTime = Date.now();
      const response = await testConnection({
        asset_id: assetId,
        credential_id: credentialId,
        test_type: 'ssh' // 默认SSH，实际应该从资产信息获取
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      const responseData = response.data || { success: false, message: '', error: '' };
      const testResult: ConnectionResult = {
        success: responseData.success,
        message: responseData.message || '连接测试完成',
        latency,
        timestamp: Date.now(),
        error: responseData.success ? undefined : responseData.error
      };
      
      setResult(testResult);
      setHistory(prev => [testResult, ...prev.slice(0, 99)]);
      
      if (testResult.success) {
        setStatus('connected');
        setRetryCount(0);
      } else {
        setStatus('error');
      }
      
      return testResult.success;
    } catch (error: any) {
      const testResult: ConnectionResult = {
        success: false,
        message: '连接测试失败',
        timestamp: Date.now(),
        error: error.response?.data?.error || error.message
      };
      
      setResult(testResult);
      setHistory(prev => [testResult, ...prev.slice(0, 99)]);
      setStatus('error');
      
      return false;
    }
  }, []);

  // 清除历史记录
  const clearHistory = useCallback(() => {
    setHistory([]);
    setResult(undefined);
    setStatus('idle');
  }, []);

  // 获取状态文本
  const getStatusText = useCallback((): string => {
    switch (status) {
      case 'idle':
        return '未测试';
      case 'connecting':
        return '连接中...';
      case 'connected':
        return '连接成功';
      case 'disconnected':
        return '连接断开';
      case 'error':
        return '连接失败';
      default:
        return '未知状态';
    }
  }, [status]);

  // 获取状态颜色
  const getStatusColor = useCallback((): string => {
    switch (status) {
      case 'idle':
        return '#d9d9d9';
      case 'connecting':
        return '#1890ff';
      case 'connected':
        return '#52c41a';
      case 'disconnected':
        return '#faad14';
      case 'error':
        return '#ff4d4f';
      default:
        return '#d9d9d9';
    }
  }, [status]);

  // 开始监控
  const startMonitoring = useCallback((asset: Asset, credential: Credential) => {
    if (isMonitoring) {
      stopMonitoring();
    }
    
    currentAssetRef.current = asset;
    currentCredentialRef.current = credential;
    setIsMonitoring(true);
    
    // 立即执行一次测试
    performConnectionTest(asset, credential);
    
    // 设置定时器
    if (config.interval > 0) {
      monitorTimerRef.current = setInterval(() => {
        performConnectionTest(asset, credential);
      }, config.interval);
    }
  }, [isMonitoring, config.interval, performConnectionTest]);

  // 停止监控
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    
    if (monitorTimerRef.current) {
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = undefined;
    }
    
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
    
    currentAssetRef.current = null;
    currentCredentialRef.current = null;
  }, []);

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<ConnectionMonitorConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    
    // 如果正在监控且间隔时间改变，重新设置定时器
    if (isMonitoring && newConfig.interval !== undefined && currentAssetRef.current && currentCredentialRef.current) {
      stopMonitoring();
      startMonitoring(currentAssetRef.current, currentCredentialRef.current);
    }
  }, [isMonitoring, stopMonitoring, startMonitoring]);

  // 重试连接
  const retry = useCallback(async (): Promise<boolean> => {
    if (!currentAssetRef.current || !currentCredentialRef.current) {
      message.warning('没有可重试的连接');
      return false;
    }
    
    if (retryCount >= config.maxRetries) {
      message.warning('已达到最大重试次数');
      return false;
    }
    
    setRetryCount(prev => prev + 1);
    return await performConnectionTest(currentAssetRef.current, currentCredentialRef.current);
  }, [performConnectionTest, retryCount, config.maxRetries]);

  // 检查是否可以重试
  const canRetry = useCallback((): boolean => {
    return retryCount < config.maxRetries && 
           currentAssetRef.current !== null && 
           currentCredentialRef.current !== null;
  }, [retryCount, config.maxRetries]);

  // 计算成功率
  const getSuccessRate = useCallback((): number => {
    if (history.length === 0) return 0;
    const successCount = history.filter(r => r.success).length;
    return Math.round((successCount / history.length) * 100);
  }, [history]);

  // 计算平均延迟
  const getAverageLatency = useCallback((): number => {
    const successResults = history.filter(r => r.success && r.latency !== undefined);
    if (successResults.length === 0) return 0;
    
    const totalLatency = successResults.reduce((sum, r) => sum + (r.latency || 0), 0);
    return Math.round(totalLatency / successResults.length);
  }, [history]);

  // 获取最后成功时间
  const getLastSuccessTime = useCallback((): number | undefined => {
    const lastSuccess = history.find(r => r.success);
    return lastSuccess?.timestamp;
  }, [history]);

  // 获取最后失败时间
  const getLastFailureTime = useCallback((): number | undefined => {
    const lastFailure = history.find(r => !r.success);
    return lastFailure?.timestamp;
  }, [history]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (monitorTimerRef.current) {
        clearInterval(monitorTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return {
    // 状态
    status,
    result,
    history,
    isMonitoring,
    config,
    retryCount,
    lastTestTime,
    
    // 操作
    testConnection: testConnectionHandler,
    testAssetConnection,
    setStatus,
    clearHistory,
    getStatusText,
    getStatusColor,
    
    startMonitoring,
    stopMonitoring,
    updateConfig,
    
    retry,
    canRetry,
    
    getSuccessRate,
    getAverageLatency,
    getLastSuccessTime,
    getLastFailureTime,
  };
};