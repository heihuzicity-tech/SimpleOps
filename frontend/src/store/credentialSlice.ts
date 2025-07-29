import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
// import * as credentialAPI from '../services/credentialAPI';
import { credentialApiService, UpdateCredentialRequest } from '../services/api/CredentialApiService';
import { Credential } from '../types';

interface CredentialState {
  credentials: Credential[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: CredentialState = {
  credentials: [],
  total: 0,
  loading: false,
  error: null,
};

// 内部使用的凭证列表响应格式
interface NormalizedCredentialsResponse {
  credentials: Credential[];
  total: number;
  page: number;
  page_size: number;
}

// 异步actions
export const fetchCredentials = createAsyncThunk(
  'credential/fetchCredentials',
  async (params: { page?: number; page_size?: number; keyword?: string; type?: 'password' | 'key'; asset_id?: number }): Promise<NormalizedCredentialsResponse> => {
    // 使用新的CredentialApiService，它会自动处理响应格式转换
    const data = await credentialApiService.getCredentials(params);
    // Service返回数据处理成功
    
    return {
      credentials: data.items || [],
      total: data.total || 0,
      page: data.page || 1,
      page_size: data.page_size || 10,
    };
  }
);

export const createCredential = createAsyncThunk(
  'credential/createCredential',
  async (credentialData: {
    name: string;
    type: 'password' | 'key';
    username: string;
    password?: string;
    private_key?: string;
    asset_ids: number[];
  }) => {
    const data = await credentialApiService.createCredential(credentialData);
    return data;
  }
);

export const updateCredential = createAsyncThunk(
  'credential/updateCredential',
  async ({ id, credentialData }: { id: number; credentialData: UpdateCredentialRequest }) => {
    const data = await credentialApiService.updateCredential(id, credentialData);
    return data;
  }
);

export const deleteCredential = createAsyncThunk(
  'credential/deleteCredential',
  async (id: number) => {
    await credentialApiService.deleteCredential(id);
    return id;
  }
);

export const batchDeleteCredentials = createAsyncThunk(
  'credential/batchDeleteCredentials',
  async (ids: number[]) => {
    await credentialApiService.batchDeleteCredentials(ids);
    return ids;
  }
);

export const testConnection = createAsyncThunk(
  'credential/testConnection',
  async (testData: { asset_id: number; credential_id: number; test_type: 'ping' | 'ssh' | 'rdp' | 'database' }) => {
    const result = await credentialApiService.testConnection(testData);
    return { credentialId: testData.credential_id, result };
  }
);

const credentialSlice = createSlice({
  name: 'credential',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取凭证列表
      .addCase(fetchCredentials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCredentials.fulfilled, (state, action) => {
        state.loading = false;
        state.credentials = action.payload.credentials || [];
        state.total = action.payload.total || 0;
      })
      .addCase(fetchCredentials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取凭证列表失败';
      })
      // 创建凭证
      .addCase(createCredential.pending, (state) => {
        state.loading = true;
      })
      .addCase(createCredential.fulfilled, (state, action) => {
        state.loading = false;
        if (!state.credentials) {
          state.credentials = [];
        }
        state.credentials.push(action.payload);
        message.success('凭证创建成功');
      })
      .addCase(createCredential.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '创建凭证失败';
        message.error(state.error);
      })
      // 更新凭证
      .addCase(updateCredential.fulfilled, (state, action) => {
        if (!state.credentials) {
          state.credentials = [];
          return;
        }
        const index = state.credentials.findIndex(credential => credential.id === action.payload.id);
        if (index !== -1) {
          state.credentials[index] = action.payload;
        }
        message.success('凭证更新成功');
      })
      .addCase(updateCredential.rejected, (state, action) => {
        state.error = action.error.message || '更新凭证失败';
        message.error(state.error);
      })
      // 删除凭证
      .addCase(deleteCredential.fulfilled, (state, action) => {
        if (!state.credentials) {
          state.credentials = [];
          return;
        }
        state.credentials = state.credentials.filter(credential => credential.id !== action.payload);
        message.success('凭证删除成功');
      })
      .addCase(deleteCredential.rejected, (state, action) => {
        state.error = action.error.message || '删除凭证失败';
        message.error(state.error);
      })
      // 批量删除凭证
      .addCase(batchDeleteCredentials.fulfilled, (state, action) => {
        if (!state.credentials) {
          state.credentials = [];
          return;
        }
        state.credentials = state.credentials.filter(credential => !action.payload.includes(credential.id));
        state.total = Math.max(0, state.total - action.payload.length);
        message.success(`成功删除 ${action.payload.length} 个凭证`);
      })
      .addCase(batchDeleteCredentials.rejected, (state, action) => {
        state.error = action.error.message || '批量删除凭证失败';
        message.error(state.error);
      })
      // 测试连接
      .addCase(testConnection.fulfilled, (state, action) => {
        const { result } = action.payload;
        if (result.success) {
          message.success('连接测试成功');
        } else {
          message.error(`连接测试失败: ${result.message}`);
        }
      })
      .addCase(testConnection.rejected, (state, action) => {
        message.error('连接测试失败: ' + action.error.message);
      });
  },
});

export const { clearError } = credentialSlice.actions;
export default credentialSlice.reducer; 