import { useState, useEffect, useCallback, useRef } from 'react';
import { sshAPI } from '../services/sshAPI';
import { message } from 'antd';

export interface SessionTimeoutConfig {
  sessionId: string;
  timeoutMinutes: number;
  lastActivity: Date;
  timeoutAt: Date;
  isWarned: boolean;
}

export interface SessionTimeoutStatus {
  sessionId: string;
  isActive: boolean;
  timeoutMinutes: number;
  minutesRemaining: number;
  lastActivity: Date;
  timeoutAt: Date;
}

export interface UseSessionTimeoutOptions {
  sessionId: string;
  onTimeoutWarning?: (minutesLeft: number) => void;
  onTimeout?: () => void;
  onError?: (error: string) => void;
  autoRefresh?: boolean; // 是否自动刷新状态
  refreshInterval?: number; // 自动刷新间隔（毫秒）
}

export const useSessionTimeout = (options: UseSessionTimeoutOptions) => {
  const {
    sessionId,
    onTimeoutWarning,
    onTimeout,
    onError,
    autoRefresh = true,
    refreshInterval = 30000 // 默认30秒刷新一次
  } = options;

  const [config, setConfig] = useState<SessionTimeoutConfig | null>(null);
  const [status, setStatus] = useState<SessionTimeoutStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWarningRef = useRef<number>(0);

  // 清理错误状态
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 处理API错误
  const handleError = useCallback((err: any, operation: string) => {
    const errorMessage = err?.response?.data?.message || err?.message || `${operation}失败`;
    setError(errorMessage);
    onError?.(errorMessage);
    console.error(`Session timeout ${operation} error:`, err);
  }, [onError]);

  // 设置会话超时
  const setSessionTimeout = useCallback(async (timeoutMinutes: number): Promise<boolean> => {
    setLoading(true);
    clearError();
    
    try {
      await sshAPI.setSessionTimeout(sessionId, timeoutMinutes);
      message.success(`会话超时已设置为${timeoutMinutes}分钟`);
      
      // 立即刷新配置
      await fetchConfig();
      return true;
    } catch (err: any) {
      handleError(err, '设置超时');
      return false;
    } finally {
      setLoading(false);
    }
  }, [sessionId, handleError, clearError]);

  // 更新会话超时
  const updateSessionTimeout = useCallback(async (timeoutMinutes: number): Promise<boolean> => {
    setLoading(true);
    clearError();
    
    try {
      await sshAPI.updateSessionTimeout(sessionId, timeoutMinutes);
      message.success(`会话超时已更新为${timeoutMinutes}分钟`);
      
      // 立即刷新配置
      await fetchConfig();
      return true;
    } catch (err: any) {
      handleError(err, '更新超时');
      return false;
    } finally {
      setLoading(false);
    }
  }, [sessionId, handleError, clearError]);

  // 取消会话超时
  const removeSessionTimeout = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    clearError();
    
    try {
      await sshAPI.removeSessionTimeout(sessionId);
      message.success('会话超时已取消');
      setConfig(null);
      setStatus(null);
      return true;
    } catch (err: any) {
      handleError(err, '取消超时');
      return false;
    } finally {
      setLoading(false);
    }
  }, [sessionId, handleError, clearError]);

  // 延长会话时间
  const extendSession = useCallback(async (additionalMinutes?: number): Promise<boolean> => {
    setLoading(true);
    clearError();
    
    try {
      await sshAPI.extendSession(sessionId, additionalMinutes);
      const extendTime = additionalMinutes || 30;
      message.success(`会话已延长${extendTime}分钟`);
      
      // 立即刷新状态
      await fetchStatus();
      return true;
    } catch (err: any) {
      handleError(err, '延长会话');
      return false;
    } finally {
      setLoading(false);
    }
  }, [sessionId, handleError, clearError]);

  // 更新会话活动时间
  const updateActivity = useCallback(async (): Promise<boolean> => {
    try {
      await sshAPI.updateSessionActivity(sessionId);
      
      // 静默更新状态，不显示消息
      if (autoRefresh) {
        await fetchStatus();
      }
      return true;
    } catch (err: any) {
      // 活动更新失败不显示错误消息，只记录日志
      console.warn('Update session activity failed:', err);
      return false;
    }
  }, [sessionId, autoRefresh]);

  // 获取超时配置
  const fetchConfig = useCallback(async () => {
    try {
      const data = await sshAPI.getSessionTimeout(sessionId);
      setConfig({
        sessionId: data.session_id,
        timeoutMinutes: data.timeout_minutes,
        lastActivity: new Date(data.last_activity),
        timeoutAt: new Date(data.timeout_at),
        isWarned: data.is_warned
      });
    } catch (err: any) {
      // 配置不存在时不报错
      if (err?.response?.status !== 404) {
        handleError(err, '获取配置');
      }
    }
  }, [sessionId, handleError]);

  // 获取会话状态
  const fetchStatus = useCallback(async () => {
    try {
      const data = await sshAPI.getSessionStatus(sessionId);
      const newStatus: SessionTimeoutStatus = {
        sessionId: data.session_id,
        isActive: data.is_active,
        timeoutMinutes: data.timeout_minutes,
        minutesRemaining: data.minutes_remaining,
        lastActivity: new Date(data.last_activity),
        timeoutAt: new Date(data.timeout_at)
      };
      
      setStatus(newStatus);

      // 检查是否需要发出超时警告
      if (newStatus.isActive && newStatus.minutesRemaining <= 5 && newStatus.minutesRemaining > 0) {
        const now = Date.now();
        const timeSinceLastWarning = now - lastWarningRef.current;
        
        // 每分钟最多警告一次
        if (timeSinceLastWarning > 60000) {
          lastWarningRef.current = now;
          onTimeoutWarning?.(newStatus.minutesRemaining);
        }
      }

      // 检查是否已超时
      if (!newStatus.isActive && newStatus.minutesRemaining <= 0) {
        onTimeout?.();
      }

    } catch (err: any) {
      // 会话不存在时不报错
      if (err?.response?.status !== 404) {
        handleError(err, '获取状态');
      }
    }
  }, [sessionId, handleError, onTimeoutWarning, onTimeout]);

  // 格式化剩余时间显示
  const formatRemainingTime = useCallback((minutes: number): string => {
    if (minutes <= 0) return '已超时';
    if (minutes < 60) return `${minutes}分钟`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) return `${hours}小时`;
    return `${hours}小时${remainingMinutes}分钟`;
  }, []);

  // 初始化和自动刷新
  useEffect(() => {
    if (!sessionId) return;

    // 初始加载
    fetchConfig();
    fetchStatus();

    // 设置自动刷新
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchStatus();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [sessionId, autoRefresh, refreshInterval, fetchConfig, fetchStatus]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    // 状态
    config,
    status,
    loading,
    error,
    
    // 操作方法
    setSessionTimeout,
    updateSessionTimeout,
    removeSessionTimeout,
    extendSession,
    updateActivity,
    
    // 工具方法
    fetchConfig,
    fetchStatus,
    formatRemainingTime,
    clearError,
    
    // 计算属性
    hasTimeout: !!config,
    isExpiring: status ? status.minutesRemaining <= 10 && status.minutesRemaining > 0 : false,
    isExpired: status ? status.minutesRemaining <= 0 : false,
    remainingMinutes: status?.minutesRemaining || 0
  };
};