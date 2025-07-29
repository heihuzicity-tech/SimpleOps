import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { message } from 'antd';
// 迁移到新的AuthApiService
// import * as authAPI from '../services/authAPI';
import { authApiService } from '../services/api/AuthApiService';

interface User {
  id: number;
  username: string;
  email: string;
  roles: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  permissions: string[];  // 保持必需，默认为空数组
  last_login?: string;    // 添加这个字段以匹配UserProfile
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  user: null,
  loading: false,
  error: null,
};

// 异步actions
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }) => {
    const response = await authApiService.login(credentials);
    // AuthApiService已经处理了响应格式，直接访问data
    const token = response.data.access_token;
    localStorage.setItem('token', token);
    
    // 立即获取用户信息
    const userResponse = await authApiService.getCurrentUser();
    
    return {
      token: token,
      user: {
        ...userResponse.data,
        permissions: userResponse.data.permissions || []
      }
    };
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApiService.logout();
  localStorage.removeItem('token');
});

export const getCurrentUser = createAsyncThunk('auth/getCurrentUser', async () => {
  const response = await authApiService.getCurrentUser();
  // AuthApiService已经处理了响应格式，直接返回data
  // 确保permissions字段存在（如果后端没有返回，默认为空数组）
  return {
    ...response.data,
    permissions: response.data.permissions || []
  };
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 登录
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        message.success('登录成功');
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '登录失败';
        message.error(state.error);
      })
      // 登出
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.user = null;
        message.success('已安全退出');
      })
      // 获取当前用户
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取用户信息失败';
        // 如果token无效，清除登录状态
        if (action.error.message?.includes('401')) {
          state.token = null;
          state.user = null;
          localStorage.removeItem('token');
        }
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer; 