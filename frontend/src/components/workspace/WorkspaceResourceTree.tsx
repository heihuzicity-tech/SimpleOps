import React, { useState, useEffect, useCallback } from 'react';
import { Tree, Empty, Spin, Input, Button, Space, Tooltip } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  CloudServerOutlined,
  SearchOutlined,
  ReloadOutlined,
  LinuxOutlined,
  WindowsOutlined,
  DatabaseOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import { Asset } from '../../types';
import type { DataNode } from 'antd/es/tree';

interface WorkspaceResourceTreeProps {
  onAssetSelect: (asset: Asset) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

const WorkspaceResourceTree: React.FC<WorkspaceResourceTreeProps> = ({
  onAssetSelect,
  searchValue = '',
  onSearchChange
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, loading } = useSelector((state: RootState) => state.asset);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['host-resources', 'group-生产环境', 'group-测试环境', 'group-运维环境']);
  const [treeData, setTreeData] = useState<DataNode[]>([]);

  // 加载资源数据
  const loadResources = useCallback(() => {
    dispatch(fetchAssets({ page: 1, page_size: 1000, type: 'server' }));
    dispatch(fetchCredentials({ page: 1, page_size: 1000 }));
  }, [dispatch]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // 构建树形数据结构
  const buildTreeData = useCallback(() => {
    if (!assets || assets.length === 0) {
      return [];
    }

    // 按环境和用途分组资产 
    const groupedAssets = assets.reduce((groups: Record<string, Asset[]>, asset) => {
      let groupName = '生产环境'; // 默认分组
      
      // 根据主机名称特征进行智能分组
      const hostname = asset.name.toLowerCase();
      
      if (hostname.includes('web') || hostname.includes('nginx') || hostname.includes('apache')) {
        groupName = 'Web服务器';
      } else if (hostname.includes('db') || hostname.includes('mysql') || hostname.includes('postgres')) {
        groupName = '数据库服务器';
      } else if (hostname.includes('test') || hostname.includes('dev')) {
        groupName = '测试环境';
      } else if (hostname.includes('prod') || hostname.includes('production')) {
        groupName = '生产环境';
      } else if (hostname.includes('app') || hostname.includes('api')) {
        groupName = '应用服务器';
      } else if (asset.os_type === 'windows') {
        groupName = 'Windows服务器';
      } else {
        groupName = 'Linux服务器';
      }
      
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(asset);
      return groups;
    }, {});

    // 如果没有资产，创建默认分组结构
    if (Object.keys(groupedAssets).length === 0) {
      groupedAssets['生产环境'] = [];
      groupedAssets['测试环境'] = [];
      groupedAssets['运维环境'] = [];
    }

    // 构建子节点（具体主机）
    const buildAssetNodes = (groupAssets: Asset[]): DataNode[] => {
      return groupAssets
        .filter(asset => {
          if (!searchValue) return true;
          const search = searchValue.toLowerCase();
          return asset.name.toLowerCase().includes(search) || 
                 asset.address.toLowerCase().includes(search);
        })
        .map(asset => ({
          key: `asset-${asset.id}`,
          title: (
            <Space size="small">
              {asset.os_type === 'linux' ? (
                <LinuxOutlined style={{ color: '#52c41a' }} />
              ) : asset.os_type === 'windows' ? (
                <WindowsOutlined style={{ color: '#1890ff' }} />
              ) : (
                <CloudServerOutlined style={{ color: '#722ed1' }} />
              )}
              <span style={{ fontSize: '12px' }}>
                {asset.name}
              </span>
              <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
                ({asset.address}:{asset.port})
              </span>
            </Space>
          ),
          isLeaf: true,
          data: asset
        }));
    };

    // 构建分组节点
    const groupNodes: DataNode[] = Object.entries(groupedAssets).map(([groupName, groupAssets]) => ({
      key: `group-${groupName}`,
      title: (
        <Space size="small">
          <FolderOutlined style={{ color: '#faad14' }} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {groupName}
          </span>
          <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
            ({groupAssets.length})
          </span>
        </Space>
      ),
      children: buildAssetNodes(groupAssets)
    }));

    // 构建根节点
    const rootNodes: DataNode[] = [
      {
        key: 'host-resources',
        title: (
          <Space size="small">
            <CloudServerOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              主机资源
            </span>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              ({assets.length})
            </span>
          </Space>
        ),
        children: groupNodes
      },
      {
        key: 'database-resources',
        title: (
          <Space size="small">
            <DatabaseOutlined style={{ color: '#722ed1' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              数据库资源
            </span>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              (0)
            </span>
          </Space>
        ),
        children: []
      },
      {
        key: 'network-resources',
        title: (
          <Space size="small">
            <GlobalOutlined style={{ color: '#52c41a' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              网络设备资源
            </span>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
              (0)
            </span>
          </Space>
        ),
        children: []
      }
    ];

    return rootNodes;
  }, [assets, searchValue]);

  useEffect(() => {
    setTreeData(buildTreeData());
  }, [buildTreeData]);

  // 处理节点选择
  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length === 0) return;
    
    const selectedKey = selectedKeys[0] as string;
    
    // 只处理资产节点的选择
    if (selectedKey.startsWith('asset-')) {
      const asset = info.node.data as Asset;
      if (asset) {
        onAssetSelect(asset);
      }
    }
  };

  // 处理节点展开
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
  };

  if (loading && (!treeData || treeData.length === 0)) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <Spin size="small" tip="加载资源中...">
          <div style={{ minHeight: '50px' }} />
        </Spin>
      </div>
    );
  }

  if (!loading && (!treeData || treeData.length === 0)) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无资源"
        style={{ margin: '20px 0' }}
      />
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索和刷新工具栏 */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="搜索主机"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{ flex: 1 }}
            size="small"
            prefix={<SearchOutlined />}
            allowClear
          />
          <Tooltip title="刷新资源列表">
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={loadResources}
              loading={loading}
              size="small"
            />
          </Tooltip>
        </Space.Compact>
      </div>

      {/* 资源树 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        <Tree
          treeData={treeData}
          onSelect={handleSelect}
          onExpand={handleExpand}
          expandedKeys={expandedKeys}
          selectedKeys={[]}
          showLine
          showIcon={false}
          blockNode
          style={{
            backgroundColor: 'transparent'
          }}
        />
      </div>
    </div>
  );
};

export default WorkspaceResourceTree;