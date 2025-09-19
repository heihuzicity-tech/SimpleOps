import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { 
  getAssets, 
  createAsset, 
  updateAsset, 
  deleteAsset, 
  testConnection,
  getAssetGroups,
  createAssetGroup,
  updateAssetGroup,
  deleteAssetGroup 
} from '../services/api';
import { Asset, AssetGroup, Credential } from '../types';

// 资产查询参数
interface AssetQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  status?: number;
  groupId?: number;
}

// 资产管理状态
interface AssetManagementState {
  assets: Asset[];
  groups: AssetGroup[];
  loading: boolean;
  groupLoading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  searchKeyword: string;
  selectedGroup?: AssetGroup;
  selectedAssets: Asset[];
  connectionTestResults: Map<number, { status: string; message: string; time: number }>;
}

// 资产管理操作
interface AssetManagementActions {
  // 资产CRUD操作
  fetchAssets: (params?: AssetQueryParams) => Promise<void>;
  createNewAsset: (asset: Partial<Asset>) => Promise<boolean>;
  updateExistingAsset: (id: number, asset: Partial<Asset>) => Promise<boolean>;
  deleteExistingAsset: (id: number) => Promise<boolean>;
  batchDeleteAssets: (ids: number[]) => Promise<boolean>;
  
  // 分组管理
  fetchGroups: () => Promise<void>;
  createNewGroup: (group: Partial<AssetGroup>) => Promise<boolean>;
  updateExistingGroup: (id: number, group: Partial<AssetGroup>) => Promise<boolean>;
  deleteExistingGroup: (id: number) => Promise<boolean>;
  selectGroup: (group?: AssetGroup) => void;
  
  // 连接测试
  testAssetConnection: (assetId: number, credentialId: number) => Promise<boolean>;
  batchTestConnections: (assetIds: number[]) => Promise<void>;
  getConnectionStatus: (assetId: number) => { status: string; message: string; time: number } | undefined;
  
  // 搜索和过滤
  setSearchKeyword: (keyword: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // 选择操作
  selectAsset: (asset: Asset) => void;
  selectAllAssets: (selected: boolean) => void;
  isAssetSelected: (assetId: number) => boolean;
  clearSelection: () => void;
  
  // 刷新
  refresh: () => Promise<void>;
}

// 资产管理Hook返回类型
export interface UseAssetManagementReturn extends AssetManagementState, AssetManagementActions {}

/**
 * 资产管理统一Hook
 * 提供资产的CRUD操作、分组管理、连接测试、搜索过滤等功能
 */
export const useAssetManagement = (): UseAssetManagementReturn => {
  // 状态管理
  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<AssetGroup | undefined>();
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [connectionTestResults, setConnectionTestResults] = useState<Map<number, { status: string; message: string; time: number }>>(new Map());

  // 获取资产列表
  const fetchAssets = useCallback(async (params?: AssetQueryParams) => {
    setLoading(true);
    try {
      const queryParams = {
        page: params?.page || currentPage,
        page_size: params?.pageSize || pageSize,
        keyword: params?.keyword !== undefined ? params.keyword : searchKeyword,
        type: params?.type,
        status: params?.status,
        group_id: params?.groupId || selectedGroup?.id,
      };

      const response = await getAssets(queryParams);
      if (response.data) {
        setAssets(response.data.items || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      message.error('获取资产列表失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchKeyword, selectedGroup]);

  // 创建资产
  const createNewAsset = useCallback(async (asset: Partial<Asset>) => {
    try {
      await createAsset(asset);
      message.success('资产创建成功');
      await fetchAssets();
      return true;
    } catch (error: any) {
      message.error('创建资产失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchAssets]);

  // 更新资产
  const updateExistingAsset = useCallback(async (id: number, asset: Partial<Asset>) => {
    try {
      await updateAsset(id, asset);
      message.success('资产更新成功');
      await fetchAssets();
      return true;
    } catch (error: any) {
      message.error('更新资产失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchAssets]);

  // 删除资产
  const deleteExistingAsset = useCallback(async (id: number) => {
    try {
      await deleteAsset(id);
      message.success('资产删除成功');
      await fetchAssets();
      return true;
    } catch (error: any) {
      message.error('删除资产失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchAssets]);

  // 批量删除资产
  const batchDeleteAssets = useCallback(async (ids: number[]) => {
    try {
      const deletePromises = ids.map(id => deleteAsset(id));
      await Promise.all(deletePromises);
      message.success(`成功删除 ${ids.length} 个资产`);
      clearSelection();
      await fetchAssets();
      return true;
    } catch (error: any) {
      message.error('批量删除失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchAssets]);

  // 获取分组列表
  const fetchGroups = useCallback(async () => {
    setGroupLoading(true);
    try {
      const response = await getAssetGroups();
      if (response.data) {
        setGroups(response.data.items || []);
      }
    } catch (error: any) {
      message.error('获取分组列表失败: ' + (error.message || '未知错误'));
    } finally {
      setGroupLoading(false);
    }
  }, []);

  // 创建分组
  const createNewGroup = useCallback(async (group: Partial<AssetGroup>) => {
    try {
      await createAssetGroup(group);
      message.success('分组创建成功');
      await fetchGroups();
      return true;
    } catch (error: any) {
      message.error('创建分组失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchGroups]);

  // 更新分组
  const updateExistingGroup = useCallback(async (id: number, group: Partial<AssetGroup>) => {
    try {
      await updateAssetGroup(id, group);
      message.success('分组更新成功');
      await fetchGroups();
      return true;
    } catch (error: any) {
      message.error('更新分组失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchGroups]);

  // 删除分组
  const deleteExistingGroup = useCallback(async (id: number) => {
    try {
      await deleteAssetGroup(id);
      message.success('分组删除成功');
      await fetchGroups();
      if (selectedGroup?.id === id) {
        setSelectedGroup(undefined);
      }
      return true;
    } catch (error: any) {
      message.error('删除分组失败: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }, [fetchGroups, selectedGroup]);

  // 选择分组
  const selectGroup = useCallback((group?: AssetGroup) => {
    setSelectedGroup(group);
    setCurrentPage(1); // 重置页码
  }, []);

  // 测试连接
  const testAssetConnection = useCallback(async (assetId: number, credentialId: number) => {
    try {
      const startTime = Date.now();
      const response = await testConnection({ 
        asset_id: assetId, 
        credential_id: credentialId,
        test_type: 'ssh' // 默认SSH测试，实际应根据资产类型
      });
      
      const endTime = Date.now();
      const responseData = response.data || { success: false, message: '' };
      const testResult = {
        status: responseData.success ? 'success' : 'failed',
        message: responseData.message || '连接测试完成',
        time: endTime - startTime
      };
      
      setConnectionTestResults(prev => new Map(prev).set(assetId, testResult));
      
      if (responseData.success) {
        message.success('连接测试成功');
      } else {
        message.error('连接测试失败: ' + responseData.message);
      }
      
      return responseData.success;
    } catch (error: any) {
      const testResult = {
        status: 'error',
        message: error.response?.data?.error || error.message,
        time: 0
      };
      setConnectionTestResults(prev => new Map(prev).set(assetId, testResult));
      message.error('连接测试失败: ' + testResult.message);
      return false;
    }
  }, []);

  // 批量测试连接
  const batchTestConnections = useCallback(async (assetIds: number[]) => {
    message.info(`开始批量测试 ${assetIds.length} 个资产的连接...`);
    
    const testPromises = assetIds.map(async (assetId) => {
      const asset = assets.find(a => a.id === assetId);
      if (asset && asset.credentials && asset.credentials.length > 0) {
        // 使用第一个凭证进行测试
        return testAssetConnection(assetId, asset.credentials[0].id);
      }
      return false;
    });
    
    const results = await Promise.all(testPromises);
    const successCount = results.filter(r => r).length;
    
    message.info(`连接测试完成: ${successCount} 成功, ${results.length - successCount} 失败`);
  }, [assets, testAssetConnection]);

  // 获取连接状态
  const getConnectionStatus = useCallback((assetId: number) => {
    return connectionTestResults.get(assetId);
  }, [connectionTestResults]);

  // 选择资产
  const selectAsset = useCallback((asset: Asset) => {
    setSelectedAssets(prev => {
      const exists = prev.some(a => a.id === asset.id);
      if (exists) {
        return prev.filter(a => a.id !== asset.id);
      } else {
        return [...prev, asset];
      }
    });
  }, []);

  // 全选/取消全选
  const selectAllAssets = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedAssets(assets);
    } else {
      setSelectedAssets([]);
    }
  }, [assets]);

  // 检查资产是否被选中
  const isAssetSelected = useCallback((assetId: number) => {
    return selectedAssets.some(a => a.id === assetId);
  }, [selectedAssets]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedAssets([]);
  }, []);

  // 刷新数据
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchAssets(),
      fetchGroups()
    ]);
  }, [fetchAssets, fetchGroups]);

  // 初始化加载
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // 监听查询参数变化
  useEffect(() => {
    fetchAssets();
  }, [currentPage, pageSize, selectedGroup, fetchAssets]);

  return {
    // 状态
    assets,
    groups,
    loading,
    groupLoading,
    total,
    currentPage,
    pageSize,
    searchKeyword,
    selectedGroup,
    selectedAssets,
    connectionTestResults,
    
    // 操作
    fetchAssets,
    createNewAsset,
    updateExistingAsset,
    deleteExistingAsset,
    batchDeleteAssets,
    
    fetchGroups,
    createNewGroup,
    updateExistingGroup,
    deleteExistingGroup,
    selectGroup,
    
    testAssetConnection,
    batchTestConnections,
    getConnectionStatus,
    
    setSearchKeyword,
    setCurrentPage,
    setPageSize,
    
    selectAsset,
    selectAllAssets,
    isAssetSelected,
    clearSelection,
    
    refresh,
  };
};