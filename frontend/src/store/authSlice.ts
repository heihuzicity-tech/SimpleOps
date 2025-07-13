import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { message } from 'antd';
import * as authAPI from '../services/authAPI';

interface User {
  id: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
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
    const response = await authAPI.login(credentials);
    // 后端返回的数据结构: { success: true, data: { access_token, token_type, expires_in } }
    const token = response.data.data.access_token;
    localStorage.setItem('token', token);
    return {
      token: token,
      user: null // 用户信息需要单独获取
    };
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authAPI.logout();
  localStorage.removeItem('token');
});

export const getCurrentUser = createAsyncThunk('auth/getCurrentUser', async () => {
  const response = await authAPI.getCurrentUser();
  return response.data;
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