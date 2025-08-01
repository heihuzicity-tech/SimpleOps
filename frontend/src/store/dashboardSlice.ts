import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import DashboardAPI from '../services/dashboardAPI';

// 定义仪表盘相关的类型
export interface DashboardStats {
  hosts: {
    total: number;
    online: number;
    groups: number;
  };
  sessions: {
    active: number;
    total: number;
  };
  users: {
    total: number;
    online: number;
    today_logins: number;
  };
  credentials: {
    passwords: number;
    ssh_keys: number;
  };
}

export interface RecentLogin {
  id: number;
  username: string;
  asset_name: string;
  asset_address: string;
  credential_name: string;
  login_time: string;
  duration: number;
  status: string;
  session_id: string;
}

export interface HostDistribution {
  group_name: string;
  count: number;
  percent: number;
}

export interface ActivityTrend {
  date: string;
  sessions: number;
  logins: number;
  commands: number;
}

export interface AuditSummary {
  login_logs: number;
  operation_logs: number;
  command_records: number;
  danger_commands: number;
}

export interface QuickAccessHost {
  id: number;
  name: string;
  address: string;
  credential_id: number;
  username: string;
  os: string;
  last_access?: string;
  access_count: number;
}

export interface DashboardData {
  stats: DashboardStats | null;
  recent_logins: RecentLogin[];
  host_distribution: HostDistribution[];
  activity_trends: ActivityTrend[];
  audit_summary: AuditSummary | null;
  quick_access: QuickAccessHost[];
  last_updated: string;
}

// 定义状态接口
export interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastFetchTime: number | null;
  autoRefreshEnabled: boolean;
  refreshInterval: number; // 刷新间隔（秒）
}

// 初始状态
const initialState: DashboardState = {
  data: null,
  loading: false,
  error: null,
  lastFetchTime: null,
  autoRefreshEnabled: false, // 禁用自动刷新
  refreshInterval: 30, // 默认30秒刷新
};

// 异步操作：获取完整仪表盘数据
export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchData',
  async () => {
    const response = await DashboardAPI.getCompleteDashboard();
    return response;
  }
);

// 异步操作：获取统计数据
export const fetchDashboardStats = createAsyncThunk(
  'dashboard/fetchStats',
  async () => {
    const response = await DashboardAPI.getDashboardStats();
    return response;
  }
);

// 异步操作：获取最近登录
export const fetchRecentLogins = createAsyncThunk(
  'dashboard/fetchRecentLogins',
  async (limit: number = 10) => {
    const response = await DashboardAPI.getRecentLogins(limit);
    return response;
  }
);

// 异步操作：获取主机分布
export const fetchHostDistribution = createAsyncThunk(
  'dashboard/fetchHostDistribution',
  async () => {
    const response = await DashboardAPI.getHostDistribution();
    return response;
  }
);

// 异步操作：获取活跃趋势
export const fetchActivityTrends = createAsyncThunk(
  'dashboard/fetchActivityTrends',
  async (days: number = 7) => {
    const response = await DashboardAPI.getActivityTrends(days);
    return response;
  }
);

// 异步操作：获取审计摘要
export const fetchAuditSummary = createAsyncThunk(
  'dashboard/fetchAuditSummary',
  async () => {
    const response = await DashboardAPI.getAuditSummary();
    return response;
  }
);

// 异步操作：获取快速访问列表
export const fetchQuickAccess = createAsyncThunk(
  'dashboard/fetchQuickAccess',
  async (limit: number = 5) => {
    const response = await DashboardAPI.getQuickAccess(limit);
    return response;
  }
);

// 创建 slice
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // 设置自动刷新状态
    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.autoRefreshEnabled = action.payload;
    },
    // 设置刷新间隔
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    // 清空错误
    clearError: (state) => {
      state.error = null;
    },
    // 重置状态
    resetDashboard: (state) => {
      state.data = null;
      state.loading = false;
      state.error = null;
      state.lastFetchTime = null;
    },
  },
  extraReducers: (builder) => {
    // 处理获取完整仪表盘数据
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastFetchTime = Date.now();
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取仪表盘数据失败';
      });

    // 处理获取统计数据
    builder
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        if (state.data) {
          state.data.stats = action.payload;
        } else {
          state.data = {
            stats: action.payload,
            recent_logins: [],
            host_distribution: [],
            activity_trends: [],
            audit_summary: null,
            quick_access: [],
            last_updated: new Date().toISOString(),
          };
        }
        state.lastFetchTime = Date.now();
      });

    // 处理获取最近登录
    builder
      .addCase(fetchRecentLogins.fulfilled, (state, action) => {
        if (state.data) {
          state.data.recent_logins = action.payload;
        }
      });

    // 处理获取主机分布
    builder
      .addCase(fetchHostDistribution.fulfilled, (state, action) => {
        if (state.data) {
          state.data.host_distribution = action.payload;
        }
      });

    // 处理获取活跃趋势
    builder
      .addCase(fetchActivityTrends.fulfilled, (state, action) => {
        if (state.data) {
          state.data.activity_trends = action.payload;
        }
      });

    // 处理获取审计摘要
    builder
      .addCase(fetchAuditSummary.fulfilled, (state, action) => {
        if (state.data) {
          state.data.audit_summary = action.payload;
        }
      });

    // 处理获取快速访问
    builder
      .addCase(fetchQuickAccess.fulfilled, (state, action) => {
        if (state.data) {
          state.data.quick_access = action.payload;
        }
      });
  },
});

// 导出 actions
export const {
  setAutoRefresh,
  setRefreshInterval,
  clearError,
  resetDashboard,
} = dashboardSlice.actions;

// 导出 reducer
export default dashboardSlice.reducer;