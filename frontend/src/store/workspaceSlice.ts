import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import { WorkspaceState, TabInfo } from '../types/workspace';
import { Asset, Credential } from '../types';
import ConnectionHistoryService from '../services/workspace/connectionHistory';
import { sshAPI } from '../services/sshAPI';

// 定义工作台连接状态类型
type WorkspaceConnectionStatus = TabInfo['connectionStatus'];

// 异步操作：创建SSH连接
export const createSSHConnection = createAsyncThunk(
  'workspace/createSSHConnection',
  async (params: {
    asset: Asset;
    credential: Credential;
    tabId: string;
  }, { rejectWithValue }) => {
    try {
      const { asset, credential, tabId } = params;
      
      // 调用SSH连接API
      const response = await sshAPI.createConnection({
        host_id: asset.id,
        credential_id: credential.id,
        protocol: asset.protocol || 'ssh',
        port: asset.port || 22
      });

      // 记录连接历史
      ConnectionHistoryService.addConnectionHistory({
        assetId: asset.id,
        assetName: asset.name,
        assetAddress: asset.address,
        credentialId: credential.id,
        username: credential.username,
        protocol: asset.protocol || 'ssh',
        connectedAt: new Date(),
        status: 'success'
      });

      return {
        tabId,
        sessionId: response.session_id,
        sessionData: response
      };
    } catch (error: any) {
      return rejectWithValue({
        tabId: params.tabId,
        error: error.response?.data?.message || error.message || '连接失败'
      });
    }
  }
);

// 异步操作：关闭SSH连接
export const closeSSHConnection = createAsyncThunk(
  'workspace/closeSSHConnection',
  async (params: {
    sessionId: string;
    tabId: string;
  }, { rejectWithValue }) => {
    try {
      await sshAPI.closeConnection(params.sessionId);
      return params.tabId;
    } catch (error: any) {
      return rejectWithValue({
        tabId: params.tabId,
        error: error.response?.data?.message || error.message || '关闭连接失败'
      });
    }
  }
);

// 异步操作：关闭标签页（包含会话清理）
export const closeTabWithCleanup = createAsyncThunk(
  'workspace/closeTabWithCleanup',
  async (params: {
    tabId: string;
    sessionId?: string;
    force?: boolean; // 是否强制关闭（忽略API错误）
  }, { dispatch, getState, rejectWithValue }) => {
    try {
      const { tabId, sessionId, force = false } = params;
      
      // 开始清理标签页
      
      // 如果有会话ID，先尝试清理服务端会话
      if (sessionId) {
        try {
          await sshAPI.closeConnection(sessionId);
          // 服务端会话清理成功
        } catch (error: any) {
          
          // 如果不是强制关闭，则抛出错误
          if (!force) {
            throw error;
          }
        }
      }

      // 无论API是否成功，都要从Redux状态中移除标签页
      dispatch(closeTab(tabId));
      
      return { tabId, sessionId };
    } catch (error: any) {
      console.error('closeTabWithCleanup: 关闭标签页失败', error);
      return rejectWithValue({
        tabId: params.tabId,
        error: error.response?.data?.message || error.message || '关闭标签页失败'
      });
    }
  }
);

// 初始状态
const initialState: WorkspaceState = {
  tabs: [],
  activeTabId: '',
  sidebarWidth: 280,
  sidebarCollapsed: false,
  layout: 'horizontal',
  loading: false,
  error: null
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    // 创建新标签页
    createNewTab: (state, action: PayloadAction<{
      asset: Asset;
      credential: Credential;
      title?: string;
    }>) => {
      const { asset, credential, title } = action.payload;
      
      // 检查是否已有相同资产的连接
      const existingTab = state.tabs.find(tab => 
        tab.assetInfo.id === asset.id && 
        tab.credentialInfo.id === credential.id
      );
      
      if (existingTab) {
        state.activeTabId = existingTab.id;
        return;
      }

      const newTab: TabInfo = {
        id: nanoid(),
        title: title || `${asset.name}@${credential.username}`,
        type: 'ssh',
        assetInfo: {
          id: asset.id,
          name: asset.name,
          address: asset.address,
          port: asset.port || 22,
          protocol: asset.protocol || 'ssh',
          os_type: asset.os_type
        },
        credentialInfo: {
          id: credential.id,
          username: credential.username,
          type: credential.type,
          name: credential.name
        },
        closable: true,
        modified: false,
        connectionStatus: 'idle',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
    },

    // 切换活跃标签页
    setActiveTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) {
        state.activeTabId = tabId;
        tab.lastActivity = new Date();
      }
    },

    // 关闭标签页（同步操作，异步清理由组件层处理）
    closeTab: (state, action: PayloadAction<string>) => {
      const tabId = action.payload;
      const tabIndex = state.tabs.findIndex(tab => tab.id === tabId);
      
      if (tabIndex === -1) return;

      // 获取要关闭的标签页信息，用于后续清理
      const tabToClose = state.tabs[tabIndex];

      state.tabs.splice(tabIndex, 1);

      // 如果关闭的是当前活跃标签页，切换到其他标签页
      if (state.activeTabId === tabId) {
        if (state.tabs.length > 0) {
          const newActiveIndex = Math.max(0, tabIndex - 1);
          state.activeTabId = state.tabs[newActiveIndex]?.id || '';
        } else {
          state.activeTabId = '';
        }
      }
    },

    // 关闭所有标签页
    closeAllTabs: (state) => {
      state.tabs = [];
      state.activeTabId = '';
    },

    // 更新标签页标题
    updateTabTitle: (state, action: PayloadAction<{
      tabId: string;
      title: string;
    }>) => {
      const { tabId, title } = action.payload;
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.title = title;
        tab.modified = true;
        tab.lastActivity = new Date();
      }
    },

    // 更新连接状态
    updateConnectionStatus: (state, action: PayloadAction<{
      tabId: string;
      status: WorkspaceConnectionStatus;
      sessionId?: string;
      error?: string;
    }>) => {
      const { tabId, status, sessionId, error } = action.payload;
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.connectionStatus = status;
        if (sessionId) {
          tab.sessionId = sessionId;
        }
        if (error) {
          tab.error = error;
        }
        tab.lastActivity = new Date();
      }
    },

    // 设置侧边栏状态
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    // 设置侧边栏宽度
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(400, action.payload));
    },

    // 切换布局模式
    setLayout: (state, action: PayloadAction<'horizontal' | 'vertical'>) => {
      state.layout = action.payload;
    },

    // 设置加载状态
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // 设置错误信息
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    },

    // 重新排序标签页
    reorderTabs: (state, action: PayloadAction<{
      fromIndex: number;
      toIndex: number;
    }>) => {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;

      const [movedTab] = state.tabs.splice(fromIndex, 1);
      state.tabs.splice(toIndex, 0, movedTab);
    },

    // 复制标签页
    duplicateTab: (state, action: PayloadAction<string>) => {
      const originalTabId = action.payload;
      const originalTab = state.tabs.find(t => t.id === originalTabId);
      
      if (!originalTab) return;

      const newTab: TabInfo = {
        ...originalTab,
        id: nanoid(),
        title: `${originalTab.title} (副本)`,
        connectionStatus: 'idle',
        sessionId: undefined,
        error: undefined,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      const originalIndex = state.tabs.findIndex(t => t.id === originalTabId);
      state.tabs.splice(originalIndex + 1, 0, newTab);
      state.activeTabId = newTab.id;
    }
  },

  extraReducers: (builder) => {
    // 创建SSH连接
    builder
      .addCase(createSSHConnection.pending, (state, action) => {
        const { tabId } = action.meta.arg;
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.connectionStatus = 'connecting';
          tab.error = undefined;
        }
        state.loading = true;
      })
      .addCase(createSSHConnection.fulfilled, (state, action) => {
        const { tabId, sessionId } = action.payload;
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.connectionStatus = 'connected';
          tab.sessionId = sessionId;
          tab.error = undefined;
          tab.lastActivity = new Date();
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(createSSHConnection.rejected, (state, action) => {
        const payload = action.payload as { tabId: string; error: string };
        const tab = state.tabs.find(t => t.id === payload.tabId);
        if (tab) {
          tab.connectionStatus = 'error';
          tab.error = payload.error;
        }
        state.loading = false;
        state.error = payload.error;
      });

    // 关闭SSH连接
    builder
      .addCase(closeSSHConnection.pending, (state, action) => {
        const { tabId } = action.meta.arg;
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.connectionStatus = 'disconnecting';
        }
      })
      .addCase(closeSSHConnection.fulfilled, (state, action) => {
        const tabId = action.payload;
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.connectionStatus = 'disconnected';
          tab.sessionId = undefined;
        }
      })
      .addCase(closeSSHConnection.rejected, (state, action) => {
        const payload = action.payload as { tabId: string; error: string };
        const tab = state.tabs.find(t => t.id === payload.tabId);
        if (tab) {
          tab.connectionStatus = 'error';
          tab.error = payload.error;
        }
        state.error = payload.error;
      });

    // 关闭标签页（包含会话清理）
    builder
      .addCase(closeTabWithCleanup.pending, (state, action) => {
        const { tabId } = action.meta.arg;
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) {
          tab.connectionStatus = 'disconnecting';
        }
        state.loading = true;
      })
      .addCase(closeTabWithCleanup.fulfilled, (state, action) => {
        const { tabId } = action.payload;
        state.loading = false;
        state.error = null;
        // 注意：实际的标签页移除是在action内部通过dispatch(closeTab)完成的
      })
      .addCase(closeTabWithCleanup.rejected, (state, action) => {
        const payload = action.payload as { tabId: string; error: string };
        
        const tab = state.tabs.find(t => t.id === payload.tabId);
        if (tab) {
          tab.connectionStatus = 'error';
          tab.error = payload.error;
        }
        state.loading = false;
        state.error = payload.error;
      });
  }
});

export const {
  createNewTab,
  setActiveTab,
  closeTab,
  closeAllTabs,
  updateTabTitle,
  updateConnectionStatus,
  setSidebarCollapsed,
  setSidebarWidth,
  setLayout,
  setLoading,
  setError,
  clearError,
  reorderTabs,
  duplicateTab
} = workspaceSlice.actions;

// 异步actions已在定义时导出

export default workspaceSlice.reducer;