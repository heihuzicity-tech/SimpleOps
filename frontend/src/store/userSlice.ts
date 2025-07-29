import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
// 迁移到新的UserApiService
// import * as userAPI from '../services/userAPI';
// import { adaptPaginatedResponse } from '../services/responseAdapter';
import { userApiService } from '../services/api/UserApiService';

interface User {
  id: number;
  username: string;
  email: string;
  roles: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface UserState {
  users: User[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  total: 0,
  loading: false,
  error: null,
};

// 异步actions
export const fetchUsers = createAsyncThunk(
  'user/fetchUsers',
  async (params: { page?: number; page_size?: number; keyword?: string }) => {
    // 使用新的UserApiService，不再需要adaptPaginatedResponse
    const response = await userApiService.getUsers(params);
    return {
      users: response.data.items,  // UserApiService已经返回统一格式
      total: response.data.total,
      page: response.data.page,
      page_size: response.data.page_size,
      total_pages: response.data.total_pages
    };
  }
);

export const createUser = createAsyncThunk(
  'user/createUser',
  async (userData: {
    username: string;
    email: string;
    password: string;
    role_ids: number[];
  }) => {
    const response = await userApiService.createUser(userData);
    return response.data;  // UserApiService返回的data字段就是User对象
  }
);

export const updateUser = createAsyncThunk(
  'user/updateUser',
  async ({ id, userData }: { id: number; userData: Partial<User> }) => {
    const response = await userApiService.updateUser(id, userData);
    return response.data;  // UserApiService返回的data字段就是User对象
  }
);

export const deleteUser = createAsyncThunk(
  'user/deleteUser',
  async (id: number) => {
    await userApiService.deleteUser(id);
    return id;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取用户列表
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.total = action.payload.total;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取用户列表失败';
      })
      // 创建用户
      .addCase(createUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users.push(action.payload);
        message.success('用户创建成功');
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '创建用户失败';
        message.error(state.error);
      })
      // 更新用户
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        message.success('用户更新成功');
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.error = action.error.message || '更新用户失败';
        message.error(state.error);
      })
      // 删除用户
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter(user => user.id !== action.payload);
        message.success('用户删除成功');
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.error.message || '删除用户失败';
        message.error(state.error);
      });
  },
});

export const { clearError } = userSlice.actions;
export default userSlice.reducer; 