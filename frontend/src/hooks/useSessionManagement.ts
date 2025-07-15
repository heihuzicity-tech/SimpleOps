import { useState, useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { 
  getSessions, 
  getActiveSessions,
  createSession, 
  closeSession,
  terminateSession,
  getSessionDetails,
  getSessionCommands,
  sendSessionWarning
} from '../services/api';
import { SSHSession, ActiveSession, CommandLog } from '../types';

// 会话查询参数
interface SessionQueryParams {
  page?: number;
  pageSize?: number;
  username?: string;
  assetName?: string;
  protocol?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

// 会话管理状态
interface SessionManagementState {
  sessions: SSHSession[];
  activeSessions: ActiveSession[];
  loading: boolean;
  activeLoading: boolean;
  total: number;
  activeTotal: number;
  currentPage: number;
  pageSize: number;
  selectedSession?: SSHSession;
  selectedSessions: SSHSession[];
  sessionCommands: Map<string, CommandLog[]>;
  autoRefresh: boolean;
  refreshInterval: number;
}

// 会话管理操作
interface SessionManagementActions {
  // 会话生命周期管理
  fetchSessions: (params?: SessionQueryParams) => Promise<void>;
  fetchActiveSessions: (params?: SessionQueryParams) => Promise<void>;
  createNewSession: (assetId: number, credentialId: number) => Promise<string | null>;
  closeExistingSession: (sessionId: string) => Promise<boolean>;
  terminateExistingSession: (sessionId: string, reason: string) => Promise<boolean>;
  
  // 会话详情和命令
  fetchSessionDetails: (sessionId: string) => Promise<SSHSession | null>;
  fetchSessionCommands: (sessionId: string) => Promise<CommandLog[]>;
  
  // 批量操作
  batchCloseSessions: (sessionIds: string[]) => Promise<boolean>;
  batchTerminateSessions: (sessionIds: string[], reason: string) => Promise<boolean>;
  closeUserSessions: (userId: number) => Promise<boolean>;
  closeAssetSessions: (assetId: number) => Promise<boolean>;
  
  // 会话监控
  sendWarningToSession: (sessionId: string, message: string, level?: string) => Promise<boolean>;
  getSessionUptime: (session: SSHSession) => number;
  getSessionInactiveTime: (session: ActiveSession) => number;
  
  // 选择操作
  selectSession: (session: SSHSession) => void;
  selectAllSessions: (selected: boolean) => void;
  isSessionSelected: (sessionId: string) => boolean;
  clearSelection: () => void;
  
  // 分页和刷新
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  refresh: () => Promise<void>;
  
  // 终端管理
  openTerminal: (sessionId: string) => void;
  isTerminalOpen: (sessionId: string) => boolean;
  getOpenTerminals: () => string[];
}

// 会话管理Hook返回类型
export interface UseSessionManagementReturn extends SessionManagementState, SessionManagementActions {}

/**
 * 会话管理统一Hook
 * 提供会话的生命周期管理、批量操作、监控和终端管理等功能
 */
export const useSessionManagement = (): UseSessionManagementReturn => {
  // 状态管理
  const [sessions, setSessions] = useState<SSHSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSession, setSelectedSession] = useState<SSHSession | undefined>();
  const [selectedSessions, setSelectedSessions] = useState<SSHSession[]>([]);
  const [sessionCommands, setSessionCommands] = useState<Map<string, CommandLog[]>>(new Map());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5秒刷新
  const [openTerminals, setOpenTerminals] = useState<Set<string>>(new Set());
  
  // 自动刷新定时器
  const refreshTimerRef = useRef<NodeJS.Timeout>();

  // 获取会话列表
  const fetchSessions = useCallback(async (params?: SessionQueryParams) => {
    setLoading(true);
    try {
      const queryParams = {
        page: params?.page || currentPage,
        page_size: params?.pageSize || pageSize,
        username: params?.username,
        asset_name: params?.assetName,
        protocol: params?.protocol,
        status: params?.status,
        start_time: params?.startTime,
        end_time: params?.endTime,
      };

      const response = await getSessions(queryParams);
      if (response.data) {
        setSessions(response.data.items || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      message.error('获取会话列表失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  // 获取活跃会话列表
  const fetchActiveSessions = useCallback(async (params?: SessionQueryParams) => {
    setActiveLoading(true);
    try {
      const queryParams = {
        page: params?.page || 1,
        page_size: params?.pageSize || 100, // 活跃会话通常数量较少
        username: params?.username,
        asset_name: params?.assetName,
        protocol: params?.protocol,
      };

      const response = await getActiveSessions(queryParams);
      if (response.data) {
        setActiveSessions(response.data.items || []);
        setActiveTotal(response.data.total || 0);
      }
    } catch (error: any) {
      // 活跃会话刷新失败不显示错误，避免干扰用户
      console.error('获取活跃会话失败:', error);
    } finally {
      setActiveLoading(false);
    }
  }, []);

  // 创建新会话
  const createNewSession = useCallback(async (assetId: number, credentialId: number): Promise<string | null> => {
    try {
      const response = await createSession({
        asset_id: assetId,
        credential_id: credentialId,
      });
      
      if (response.data && response.data.session_id) {
        message.success('会话创建成功');
        await refresh();
        return response.data.session_id;
      }
      
      message.error('会话创建失败：返回数据异常');
      return null;
    } catch (error: any) {
      message.error('创建会话失败: ' + (error.response?.data?.error || error.message));
      return null;
    }
  }, []);

  // 关闭会话
  const closeExistingSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      await closeSession(sessionId);
      message.success('会话已关闭');
      await refresh();
      return true;
    } catch (error: any) {
      message.error('关闭会话失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, []);

  // 终止会话
  const terminateExistingSession = useCallback(async (sessionId: string, reason: string): Promise<boolean> => {
    try {
      await terminateSession(sessionId, { reason });
      message.success('会话已强制终止');
      await refresh();
      return true;
    } catch (error: any) {
      message.error('终止会话失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, []);

  // 获取会话详情
  const fetchSessionDetails = useCallback(async (sessionId: string): Promise<SSHSession | null> => {
    try {
      const response = await getSessionDetails(sessionId);
      return response.data || null;
    } catch (error: any) {
      message.error('获取会话详情失败: ' + (error.message || '未知错误'));
      return null;
    }
  }, []);

  // 获取会话命令记录
  const fetchSessionCommands = useCallback(async (sessionId: string): Promise<CommandLog[]> => {
    try {
      const response = await getSessionCommands(sessionId);
      const commands = response.data?.items || [];
      setSessionCommands(prev => new Map(prev).set(sessionId, commands));
      return commands;
    } catch (error: any) {
      message.error('获取命令记录失败: ' + (error.message || '未知错误'));
      return [];
    }
  }, []);

  // 批量关闭会话
  const batchCloseSessions = useCallback(async (sessionIds: string[]): Promise<boolean> => {
    try {
      const closePromises = sessionIds.map(id => closeSession(id));
      await Promise.all(closePromises);
      message.success(`成功关闭 ${sessionIds.length} 个会话`);
      clearSelection();
      await refresh();
      return true;
    } catch (error: any) {
      message.error('批量关闭失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, []);

  // 批量终止会话
  const batchTerminateSessions = useCallback(async (sessionIds: string[], reason: string): Promise<boolean> => {
    try {
      const terminatePromises = sessionIds.map(id => terminateSession(id, { reason }));
      await Promise.all(terminatePromises);
      message.success(`成功终止 ${sessionIds.length} 个会话`);
      clearSelection();
      await refresh();
      return true;
    } catch (error: any) {
      message.error('批量终止失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, []);

  // 关闭用户所有会话
  const closeUserSessions = useCallback(async (userId: number): Promise<boolean> => {
    try {
      // 找出该用户的所有活跃会话
      const userSessions = activeSessions.filter(s => s.user_id === userId);
      if (userSessions.length === 0) {
        message.info('该用户没有活跃的会话');
        return true;
      }
      
      const sessionIds = userSessions.map(s => s.session_id);
      return await batchCloseSessions(sessionIds);
    } catch (error: any) {
      message.error('关闭用户会话失败: ' + (error.message || '未知错误'));
      return false;
    }
  }, [activeSessions, batchCloseSessions]);

  // 关闭资产所有会话
  const closeAssetSessions = useCallback(async (assetId: number): Promise<boolean> => {
    try {
      // 找出该资产的所有活跃会话
      const assetSessions = activeSessions.filter(s => s.asset_id === assetId);
      if (assetSessions.length === 0) {
        message.info('该资产没有活跃的会话');
        return true;
      }
      
      const sessionIds = assetSessions.map(s => s.session_id);
      return await batchCloseSessions(sessionIds);
    } catch (error: any) {
      message.error('关闭资产会话失败: ' + (error.message || '未知错误'));
      return false;
    }
  }, [activeSessions, batchCloseSessions]);

  // 发送警告到会话
  const sendWarningToSession = useCallback(async (sessionId: string, warningMessage: string, level: string = 'warning'): Promise<boolean> => {
    try {
      await sendSessionWarning(sessionId, { message: warningMessage, level });
      message.success('警告已发送');
      return true;
    } catch (error: any) {
      message.error('发送警告失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, []);

  // 计算会话运行时间（秒）
  const getSessionUptime = useCallback((session: SSHSession): number => {
    const startTime = new Date(session.start_time).getTime();
    const endTime = session.end_time ? new Date(session.end_time).getTime() : Date.now();
    return Math.floor((endTime - startTime) / 1000);
  }, []);

  // 计算会话非活跃时间（秒）
  const getSessionInactiveTime = useCallback((session: ActiveSession): number => {
    if (!session.last_activity) return 0;
    const lastActivity = new Date(session.last_activity).getTime();
    return Math.floor((Date.now() - lastActivity) / 1000);
  }, []);

  // 选择会话
  const selectSession = useCallback((session: SSHSession) => {
    setSelectedSession(session);
    setSelectedSessions(prev => {
      const exists = prev.some(s => s.session_id === session.session_id);
      if (exists) {
        return prev.filter(s => s.session_id !== session.session_id);
      } else {
        return [...prev, session];
      }
    });
  }, []);

  // 全选/取消全选
  const selectAllSessions = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedSessions(sessions);
    } else {
      setSelectedSessions([]);
    }
  }, [sessions]);

  // 检查会话是否被选中
  const isSessionSelected = useCallback((sessionId: string): boolean => {
    return selectedSessions.some(s => s.session_id === sessionId);
  }, [selectedSessions]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedSessions([]);
    setSelectedSession(undefined);
  }, []);

  // 打开终端
  const openTerminal = useCallback((sessionId: string) => {
    setOpenTerminals(prev => new Set(prev).add(sessionId));
  }, []);

  // 检查终端是否打开
  const isTerminalOpen = useCallback((sessionId: string): boolean => {
    return openTerminals.has(sessionId);
  }, [openTerminals]);

  // 获取所有打开的终端
  const getOpenTerminals = useCallback((): string[] => {
    return Array.from(openTerminals);
  }, [openTerminals]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSessions(),
      fetchActiveSessions()
    ]);
  }, [fetchSessions, fetchActiveSessions]);

  // 设置自动刷新
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        fetchActiveSessions();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchActiveSessions]);

  // 监听查询参数变化
  useEffect(() => {
    fetchSessions();
  }, [currentPage, pageSize, fetchSessions]);

  // 初始化加载
  useEffect(() => {
    refresh();
  }, []);

  return {
    // 状态
    sessions,
    activeSessions,
    loading,
    activeLoading,
    total,
    activeTotal,
    currentPage,
    pageSize,
    selectedSession,
    selectedSessions,
    sessionCommands,
    autoRefresh,
    refreshInterval,
    
    // 操作
    fetchSessions,
    fetchActiveSessions,
    createNewSession,
    closeExistingSession,
    terminateExistingSession,
    
    fetchSessionDetails,
    fetchSessionCommands,
    
    batchCloseSessions,
    batchTerminateSessions,
    closeUserSessions,
    closeAssetSessions,
    
    sendWarningToSession,
    getSessionUptime,
    getSessionInactiveTime,
    
    selectSession,
    selectAllSessions,
    isSessionSelected,
    clearSelection,
    
    setCurrentPage,
    setPageSize,
    setAutoRefresh,
    setRefreshInterval,
    refresh,
    
    openTerminal,
    isTerminalOpen,
    getOpenTerminals,
  };
};