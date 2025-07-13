import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
import * as assetAPI from '../services/assetAPI';

interface Asset {
  id: number;
  name: string;
  type: 'server' | 'database' | 'network';
  host: string;
  port: number;
  description: string;
  status: 'active' | 'inactive';
  group: string;
  created_at: string;
  updated_at: string;
}

interface AssetState {
  assets: Asset[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: AssetState = {
  assets: [],
  total: 0,
  loading: false,
  error: null,
};

// 异步actions
export const fetchAssets = createAsyncThunk(
  'asset/fetchAssets',
  async (params: { page?: number; limit?: number; keyword?: string; type?: string }) => {
    const response = await assetAPI.getAssets(params);
    return response.data;
  }
);

export const createAsset = createAsyncThunk(
  'asset/createAsset',
  async (assetData: {
    name: string;
    type: string;
    host: string;
    port: number;
    description: string;
    group: string;
  }) => {
    const response = await assetAPI.createAsset(assetData);
    return response.data;
  }
);

export const updateAsset = createAsyncThunk(
  'asset/updateAsset',
  async ({ id, assetData }: { id: number; assetData: Partial<Asset> }) => {
    const response = await assetAPI.updateAsset(id, assetData);
    return response.data;
  }
);

export const deleteAsset = createAsyncThunk(
  'asset/deleteAsset',
  async (id: number) => {
    await assetAPI.deleteAsset(id);
    return id;
  }
);

export const testConnection = createAsyncThunk(
  'asset/testConnection',
  async (id: number) => {
    const response = await assetAPI.testConnection(id);
    return { id, result: response.data };
  }
);

const assetSlice = createSlice({
  name: 'asset',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取资产列表
      .addCase(fetchAssets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.assets = action.payload.assets;
        state.total = action.payload.total;
      })
      .addCase(fetchAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取资产列表失败';
      })
      // 创建资产
      .addCase(createAsset.pending, (state) => {
        state.loading = true;
      })
      .addCase(createAsset.fulfilled, (state, action) => {
        state.loading = false;
        state.assets.push(action.payload);
        message.success('资产创建成功');
      })
      .addCase(createAsset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '创建资产失败';
        message.error(state.error);
      })
      // 更新资产
      .addCase(updateAsset.fulfilled, (state, action) => {
        const index = state.assets.findIndex(asset => asset.id === action.payload.id);
        if (index !== -1) {
          state.assets[index] = action.payload;
        }
        message.success('资产更新成功');
      })
      .addCase(updateAsset.rejected, (state, action) => {
        state.error = action.error.message || '更新资产失败';
        message.error(state.error);
      })
      // 删除资产
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.assets = state.assets.filter(asset => asset.id !== action.payload);
        message.success('资产删除成功');
      })
      .addCase(deleteAsset.rejected, (state, action) => {
        state.error = action.error.message || '删除资产失败';
        message.error(state.error);
      })
      // 测试连接
      .addCase(testConnection.fulfilled, (state, action) => {
        message.success('连接测试成功');
      })
      .addCase(testConnection.rejected, (state, action) => {
        message.error('连接测试失败: ' + action.error.message);
      });
  },
});

export const { clearError } = assetSlice.actions;
export default assetSlice.reducer; 