import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
import * as credentialAPI from '../services/credentialAPI';

interface Credential {
  id: number;
  name: string;
  type: 'password' | 'key';
  username: string;
  assets?: Array<{
    id: number;
    name: string;
    address: string;
    port: number;
    protocol: string;
  }>;
  created_at: string;
  updated_at: string;
}

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
    const response = await credentialAPI.getCredentials(params);
    // 适配后端返回的数据结构
    if (response.data && response.data.data) {
      return {
        credentials: response.data.data.credentials || [],
        total: response.data.data.pagination?.total || 0,
        page: response.data.data.pagination?.page || 1,
        page_size: response.data.data.pagination?.page_size || 10,
      };
    }
    // 如果是其他格式，返回默认值
    return {
      credentials: [],
      total: 0,
      page: 1,
      page_size: 10,
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
    const response = await credentialAPI.createCredential(credentialData);
    return response.data;
  }
);

export const updateCredential = createAsyncThunk(
  'credential/updateCredential',
  async ({ id, credentialData }: { id: number; credentialData: Partial<Credential> }) => {
    const response = await credentialAPI.updateCredential(id, credentialData);
    return response.data;
  }
);

export const deleteCredential = createAsyncThunk(
  'credential/deleteCredential',
  async (id: number) => {
    await credentialAPI.deleteCredential(id);
    return id;
  }
);

export const testConnection = createAsyncThunk(
  'credential/testConnection',
  async (testData: { asset_id: number; credential_id: number; test_type: 'ping' | 'ssh' | 'rdp' | 'database' }) => {
    const response = await credentialAPI.testConnection(testData);
    return { credentialId: testData.credential_id, result: response.data };
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