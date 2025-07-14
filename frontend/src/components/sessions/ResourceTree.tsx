import React, { useState, useEffect } from 'react';
import { Tree, Input, Card } from 'antd';
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

const { Search } = Input;

interface ResourceTreeProps {
  onSelect?: (selectedKeys: React.Key[], info: any) => void;
  resourceType: 'host' | 'database';
}

const ResourceTree: React.FC<ResourceTreeProps> = ({ onSelect, resourceType }) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  useEffect(() => {
    // 模拟树形数据
    const generateTreeData = (): DataNode[] => {
      if (resourceType === 'host') {
        return [
          {
            title: '全部主机',
            key: 'all',
            icon: <FolderOutlined />,
            children: [
              {
                title: '生产环境',
                key: 'production',
                icon: <CloudServerOutlined />,
                children: [
                  {
                    title: 'Web服务器',
                    key: 'web-servers',
                    icon: <DesktopOutlined />,
                  },
                  {
                    title: '应用服务器',
                    key: 'app-servers',
                    icon: <DesktopOutlined />,
                  },
                ],
              },
              {
                title: '测试环境',
                key: 'test',
                icon: <HddOutlined />,
                children: [
                  {
                    title: '测试服务器',
                    key: 'test-servers',
                    icon: <DesktopOutlined />,
                  },
                ],
              },
              {
                title: '开发环境',
                key: 'dev',
                icon: <HddOutlined />,
                children: [
                  {
                    title: '开发服务器',
                    key: 'dev-servers',
                    icon: <DesktopOutlined />,
                  },
                ],
              },
            ],
          },
        ];
      } else {
        return [
          {
            title: '全部数据库',
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
  }, [resourceType]);

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
        treeData={renderTreeNodes(treeData)}
        style={{ background: 'transparent' }}
        height={400}
      />
    </Card>
  );
};

export default ResourceTree;