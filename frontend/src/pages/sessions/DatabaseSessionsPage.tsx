import React, { useState, useEffect, useCallback } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space, 
  message,
  Tooltip,
  Badge
} from 'antd';
import { 
  DatabaseOutlined,
  ReloadOutlined,
  LinkOutlined,
  DeleteOutlined,
  KeyOutlined
} from '@ant-design/icons';
import ResourceTree from '../../components/sessions/ResourceTree';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import type { ColumnsType } from 'antd/es/table';

interface Asset {
  id: number;
  name: string;
  type: 'server' | 'database';
  address: string;
  port: number;
  protocol: string;
  tags: string;
  status: number;
  created_at: string;
  updated_at: string;
}

const DatabaseSessionsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, loading } = useSelector((state: RootState) => state.asset);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadAssets = useCallback(() => {
    dispatch(fetchAssets({
      page: 1,
      page_size: 100,
      type: 'database'
    }));
  }, [dispatch]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleConnect = async (asset: Asset) => {
    message.info(`数据库连接功能开发中: ${asset.name}`);
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      setSelectedCategory(selectedKeys[0] as string);
    }
  };

  const getDatabaseTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; icon: React.ReactNode }> = {
      mysql: { color: 'blue', icon: <DatabaseOutlined /> },
      postgresql: { color: 'green', icon: <DatabaseOutlined /> },
      redis: { color: 'red', icon: <DatabaseOutlined /> },
      mongodb: { color: 'purple', icon: <DatabaseOutlined /> },
      oracle: { color: 'orange', icon: <DatabaseOutlined /> },
    };
    const config = typeMap[type?.toLowerCase()] || { color: 'default', icon: <DatabaseOutlined /> };
    return (
      <Tag color={config.color} icon={config.icon}>
        {type?.toUpperCase() || 'MySQL'}
      </Tag>
    );
  };

  const columns: ColumnsType<Asset> = [
    {
      title: '数据库名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => (
        <Space size="small">
          <DatabaseOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '数据库地址',
      dataIndex: 'address',
      key: 'address',
      width: 140,
      render: (text: string, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {text}:{record.port}
        </span>
      ),
    },
    {
      title: '数据库类型',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      render: (protocol: string) => getDatabaseTypeTag(protocol || 'mysql'),
    },
    {
      title: '关联凭证',
      dataIndex: 'credentials',
      key: 'credentials',
      width: 80,
      align: 'center',
      render: () => (
        <Tooltip title="可用凭证数量">
          <span>1</span>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (time: string) => (
        <span style={{ fontSize: '12px' }}>
          {new Date(time).toLocaleString()}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleConnect(record)}
          >
            连接
          </Button>
          <Tooltip title="管理凭证">
            <Button 
              size="small" 
              icon={<KeyOutlined />}
              onClick={() => message.info('凭证管理功能开发中')}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => message.info('删除功能开发中')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 根据选中的分类过滤资产
  const filteredAssets = assets.filter(asset => {
    // 只显示数据库类型的资产
    if (asset.type !== 'database') return false;
    
    if (selectedCategory === 'all') return true;
    // 这里可以根据实际的分类逻辑过滤
    return true;
  });

  return (
    <div style={{ height: 'calc(100vh - 100px)' }}>
      <Row gutter={12} style={{ height: '100%' }}>
        <Col span={4} style={{ height: '100%' }}>
          <ResourceTree 
            resourceType="database"
            onSelect={handleTreeSelect}
            totalCount={filteredAssets.length}
          />
        </Col>
        <Col span={20} style={{ height: '100%' }}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined />
                <span>数据库资源</span>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAssets}
                loading={loading}
              >
                刷新
              </Button>
            }
            style={{ height: '100%' }}
            styles={{ body: { height: 'calc(100% - 56px)', overflow: 'auto' } }}
          >
            <Table
              columns={columns}
              dataSource={filteredAssets}
              rowKey="id"
              loading={loading}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              size="small"
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DatabaseSessionsPage;