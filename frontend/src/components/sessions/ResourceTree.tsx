import React, { useState, useEffect } from 'react';
import { Tree, Input, Card, message } from 'antd';
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
import { getAssetGroups, AssetGroup } from '../../services/assetAPI';

const { Search } = Input;

interface ResourceTreeProps {
  onSelect?: (selectedKeys: React.Key[], info: any) => void;
  resourceType: 'host' | 'database';
  selectedKeys?: React.Key[];
  treeData?: DataNode[];
  totalCount?: number; // 新增：总数量统计
}

const ResourceTree: React.FC<ResourceTreeProps> = ({ 
  onSelect, 
  resourceType, 
  selectedKeys: externalSelectedKeys = [], 
  treeData: externalTreeData,
  totalCount = 0 // 新增：总数量参数
}) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载资产分组数据
  const loadAssetGroups = async () => {
    try {
      setLoading(true);
      const response = await getAssetGroups({ page: 1, page_size: 100 });
      const groupsData = response.data.data || [];
      setGroups(groupsData);
    } catch (error) {
      console.error('加载资产分组失败:', error);
      message.error('加载资产分组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetGroups();
  }, []);

  useEffect(() => {
    // 优先使用外部传入的树数据
    if (externalTreeData && externalTreeData.length > 0) {
      setTreeData(externalTreeData);
      setExpandedKeys(['all']);
      return;
    }
    
    // 根据真实API数据生成树形数据
    const generateTreeData = (): DataNode[] => {
      if (resourceType === 'host') {
        // 将分组数据转换为树形结构
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
  }, [resourceType, groups, externalTreeData, totalCount]);

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
      <Search
        style={{ marginBottom: 8 }}
        placeholder="搜索资源"
        onChange={onChange}
        prefix={<SearchOutlined />}
        size="small"
      />
      <Tree
        showIcon
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        onSelect={onSelect}
        selectedKeys={externalSelectedKeys}
        treeData={renderTreeNodes(treeData)}
        style={{ background: 'transparent' }}
        height={400}
      />
    </Card>
  );
};

export default ResourceTree;