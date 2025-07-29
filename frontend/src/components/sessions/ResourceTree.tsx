import React, { useState, useEffect } from 'react';
import { Tree, Input, Card, message, Menu } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined,
  DesktopOutlined,
  DatabaseOutlined,
  SearchOutlined,
  CloudServerOutlined,
  HddOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { MenuProps } from 'antd';
import { getAssetGroups, AssetGroup, getAssetGroupsWithHosts, AssetGroupWithHosts } from '../../services/assetAPI';
import { adaptPaginatedResponse } from '../../services/responseAdapter';
import './ResourceTree.css';

const { Search } = Input;

interface ResourceTreeProps {
  onSelect?: (selectedKeys: React.Key[], info: any) => void;
  resourceType: 'host' | 'database';
  selectedKeys?: React.Key[];
  treeData?: DataNode[];
  totalCount?: number; // 新增：总数量统计
  searchValue?: string; // 新增：外部搜索值
  hideSearch?: boolean; // 新增：是否隐藏搜索框
  showHostDetails?: boolean; // 新增：是否显示主机详情（仅控制台页面使用）
  externalGroups?: AssetGroup[]; // 新增：外部传入的分组数据
}

const ResourceTree: React.FC<ResourceTreeProps> = ({ 
  onSelect, 
  resourceType, 
  selectedKeys: externalSelectedKeys = [], 
  treeData: externalTreeData,
  totalCount = 0, // 新增：总数量参数
  searchValue: externalSearchValue = '', // 新增：外部搜索值
  hideSearch = false, // 新增：是否隐藏搜索框
  showHostDetails = false, // 新增：是否显示主机详情
  externalGroups = [] // 新增：外部传入的分组数据
}) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(externalSearchValue);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [groupsWithHosts, setGroupsWithHosts] = useState<AssetGroupWithHosts[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuProps['items']>([]);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<string[]>([]);

  // 加载资产分组数据（包含主机详情）
  const loadAssetGroupsWithHosts = async () => {
    try {
      setLoading(true);
      const assetType = resourceType === 'host' ? 'server' : 'database';
      const response = await getAssetGroupsWithHosts({ type: assetType });
      // getAssetGroupsWithHosts 返回的是直接的数组，不需要适配器
      const groupsData = response.data.data || [];
      setGroupsWithHosts(groupsData);
    } catch (error) {
      console.error('加载资产分组失败:', error);
      message.error('加载资产分组失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载资产分组数据（兼容旧版本）
  const loadAssetGroups = async () => {
    try {
      setLoading(true);
      // 开始加载资产分组数据
      const response = await getAssetGroups({ page: 1, page_size: 100 });
      const adaptedData = adaptPaginatedResponse<AssetGroup>(response);
      setGroups(adaptedData.items);
    } catch (error) {
      console.error('加载资产分组失败:', error);
      message.error('加载资产分组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // useEffect 触发 - 检查数据源
    
    if (showHostDetails) {
      // 仅当需要显示主机详情时才加载新数据
      // 加载主机详情数据
      loadAssetGroupsWithHosts();
    } else if (externalGroups.length === 0) {
      // 只有当没有外部分组数据时才加载分组数据
      // 外部分组数据为空，使用内部API加载
      loadAssetGroups();
    } else {
      // 使用外部传入的分组数据
      // 使用外部分组数据
      setGroups(externalGroups);
    }
  }, [resourceType, showHostDetails, externalGroups]);

  // 同步外部搜索值
  useEffect(() => {
    if (externalSearchValue !== searchValue) {
      setSearchValue(externalSearchValue);
      
      if (!externalSearchValue) {
        setExpandedKeys(['all']);
        setAutoExpandParent(false);
        return;
      }

      // 搜索功能
      const expandedKeys: string[] = [];
      const loop = (data: DataNode[]): void => {
        data.forEach((item) => {
          if (item.title && item.title.toString().toLowerCase().includes(externalSearchValue.toLowerCase())) {
            expandedKeys.push(item.key as string);
          }
          if (item.children) {
            loop(item.children);
          }
        });
      };
      loop(treeData);
      setExpandedKeys(expandedKeys);
      setAutoExpandParent(true);
    }
  }, [externalSearchValue, searchValue, treeData]);

  useEffect(() => {
    // 优先使用外部传入的树数据
    if (externalTreeData && externalTreeData.length > 0) {
      setTreeData(externalTreeData);
      setExpandedKeys(['all']);
      return;
    }
    
    // 根据真实API数据生成树形数据
    const generateTreeData = (): DataNode[] => {
      // 生成树数据
      if (resourceType === 'host') {
        if (showHostDetails && groupsWithHosts.length > 0) {
          // 使用包含主机详情的数据生成树形结构（仅控制台页面）
          const groupItems = groupsWithHosts.map(group => ({
            title: `${group.name} (${group.asset_count})`,
            key: group.id.toString(),
            icon: <FolderOutlined />,
            children: group.assets.map(asset => ({
              title: asset.name,
              key: `asset-${asset.id}`,
              icon: <DesktopOutlined />,
              isLeaf: true,
              // 存储额外信息用于后续处理
              data: {
                type: 'asset',
                asset: asset,
                groupId: group.id,
              },
            })),
          }));

          // 计算总主机数量
          const totalHosts = groupsWithHosts.reduce((sum, group) => sum + group.asset_count, 0);

          return [
            {
              title: `全部主机${totalHosts > 0 ? `(${totalHosts})` : ''}`,
              key: 'all',
              icon: <FolderOutlined />,
              children: groupItems,
            },
          ];
        } else {
          // 使用传统的分组数据结构（其他页面）
          const groupItems = groups.map(group => ({
            title: `${group.name} (${group.asset_count})`,
            key: group.id.toString(),
            icon: <FolderOutlined />,
            isLeaf: true,
          }));

          return [
            {
              title: `全部主机${totalCount > 0 ? `(${totalCount})` : ''}`,
              key: 'all',
              icon: <FolderOutlined />,
              children: groupItems,
            },
          ];
        }
      } else {
        // 数据库类型，暂时保持简单结构
        return [
          {
            title: `全部数据库${totalCount > 0 ? `(${totalCount})` : ''}`,
            key: 'all',
            icon: <FolderOutlined />,
            children: [
              {
                title: 'MySQL',
                key: 'mysql',
                icon: <DatabaseOutlined />,
              },
              {
                title: 'PostgreSQL',
                key: 'postgresql',
                icon: <DatabaseOutlined />,
              },
              {
                title: 'Redis',
                key: 'redis',
                icon: <DatabaseOutlined />,
              },
              {
                title: 'MongoDB',
                key: 'mongodb',
                icon: <DatabaseOutlined />,
              },
            ],
          },
        ];
      }
    };

    const data = generateTreeData();
    setTreeData(data);
    setExpandedKeys(['all']);
    
    // 如果是控制台页面，同时生成Menu数据
    if (showHostDetails) {
      const menuData = generateMenuData();
      setMenuItems(menuData);
    }
  }, [resourceType, groups, groupsWithHosts, externalTreeData, totalCount, showHostDetails]);

  // 生成Menu组件数据
  const generateMenuData = (): MenuProps['items'] => {
    if (resourceType === 'host' && showHostDetails && groupsWithHosts.length > 0) {
      return groupsWithHosts.map(group => ({
        key: group.id.toString(),
        label: `${group.name} (${group.asset_count})`,
        icon: <FolderOutlined />,
        children: group.assets.map(asset => ({
          key: `asset-${asset.id}`,
          label: asset.name,
          icon: <DesktopOutlined />,
          data: {
            type: 'asset',
            asset: asset,
            groupId: group.id,
          },
        }))
      }));
    }
    return [];
  };

  // 处理Menu选择事件
  const handleMenuSelect = ({ key }: { key: string }) => {
    setSelectedMenuKeys([key]);
    
    // 如果是主机资产，触发onSelect回调
    if (key.startsWith('asset-') && onSelect) {
      // 构造与Tree组件兼容的回调参数
      const mockInfo = {
        node: {
          key,
          data: { type: 'asset' }
        }
      };
      onSelect([key], mockInfo);
    }
  };

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys as string[]);
    setAutoExpandParent(false);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSearchValue(value);
    
    if (!value) {
      setExpandedKeys(['all']);
      setAutoExpandParent(false);
      return;
    }

    // 搜索功能
    const expandedKeys: string[] = [];
    const loop = (data: DataNode[]): void => {
      data.forEach((item) => {
        if (item.title && item.title.toString().toLowerCase().includes(value.toLowerCase())) {
          expandedKeys.push(item.key as string);
        }
        if (item.children) {
          loop(item.children);
        }
      });
    };
    loop(treeData);
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(true);
  };

  const renderTreeNodes = (data: DataNode[]): DataNode[] => {
    return data.map((item) => {
      const index = item.title ? item.title.toString().toLowerCase().indexOf(searchValue.toLowerCase()) : -1;
      const beforeStr = item.title ? item.title.toString().substr(0, index) : '';
      const afterStr = item.title ? item.title.toString().substr(index + searchValue.length) : '';
      const title =
        index > -1 ? (
          <span>
            {beforeStr}
            <span style={{ color: '#f50' }}>{searchValue}</span>
            {afterStr}
          </span>
        ) : (
          <span>{item.title as React.ReactNode}</span>
        );

      if (item.children) {
        return {
          ...item,
          title,
          icon: expandedKeys.includes(item.key as string) ? <FolderOpenOutlined /> : item.icon,
          children: renderTreeNodes(item.children),
        };
      }

      return {
        ...item,
        title,
      };
    });
  };

  return (
    <Card 
      title={resourceType === 'host' ? '主机分类' : '数据库分类'} 
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px' } }}
    >
      {!hideSearch && (
        <Search
          style={{ marginBottom: 8 }}
          placeholder="搜索资源"
          value={searchValue}
          onChange={onChange}
          prefix={<SearchOutlined />}
          size="small"
        />
      )}
      
      {/* 根据是否为控制台页面选择不同的组件 */}
      {showHostDetails && resourceType === 'host' ? (
        <Menu
          mode="inline"
          inlineIndent={12}
          selectedKeys={selectedMenuKeys}
          items={menuItems}
          onSelect={handleMenuSelect}
          className="resource-tree-menu"
          style={{ 
            border: 'none', 
            background: 'transparent',
            height: hideSearch ? 432 : 400,
            overflow: 'auto'
          }}
        />
      ) : (
        <Tree
          showIcon
          onExpand={onExpand}
          expandedKeys={expandedKeys}
          autoExpandParent={autoExpandParent}
          onSelect={onSelect}
          selectedKeys={externalSelectedKeys}
          treeData={renderTreeNodes(treeData)}
          style={{ background: 'transparent' }}
          height={hideSearch ? 432 : 400}
        />
      )}
    </Card>
  );
};

export default ResourceTree;