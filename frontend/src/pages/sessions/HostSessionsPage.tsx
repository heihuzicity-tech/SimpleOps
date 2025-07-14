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
  Badge,
  Modal
} from 'antd';
import { 
  LinkOutlined, 
  DesktopOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  DeleteOutlined 
} from '@ant-design/icons';
import ResourceTree from '../../components/sessions/ResourceTree';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import { createSession } from '../../store/sshSessionSlice';
import WebTerminal from '../../components/ssh/WebTerminal';
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

const HostSessionsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, loading } = useSelector((state: RootState) => state.asset);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTerminals, setActiveTerminals] = useState<Map<string, string>>(new Map());
  const [terminalModalVisible, setTerminalModalVisible] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  const loadAssets = useCallback(() => {
    dispatch(fetchAssets({
      page: 1,
      page_size: 100,
      type: 'server'
    }));
  }, [dispatch]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleConnect = async (asset: Asset) => {
    try {
      // 这里应该有一个选择凭证的对话框，暂时先模拟
      const credentialId = 1; // 模拟凭证ID
      
      const response = await dispatch(createSession({
        asset_id: asset.id,
        credential_id: credentialId,
        protocol: 'ssh'
      })).unwrap();

      // 保存会话映射
      setActiveTerminals(prev => new Map(prev).set(response.id, asset.name));
      setCurrentSessionId(response.id);
      setTerminalModalVisible(true);
      
      message.success(`已连接到 ${asset.name}`);
    } catch (error) {
      message.error('连接失败');
    }
  };

  const handleCloseTerminal = () => {
    setTerminalModalVisible(false);
    if (currentSessionId) {
      setActiveTerminals(prev => {
        const newMap = new Map(prev);
        newMap.delete(currentSessionId);
        return newMap;
      });
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      setSelectedCategory(selectedKeys[0] as string);
    }
  };

  const columns: ColumnsType<Asset> = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string, record) => (
        <Space size="small">
          <CloudServerOutlined />
          <span>{text}</span>
          {activeTerminals.has(record.id.toString()) && (
            <Badge status="processing" />
          )}
        </Space>
      ),
    },
    {
      title: '主机地址',
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
      title: '系统类型',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
      render: (protocol: string) => (
        <Tag color={protocol === 'ssh' ? 'blue' : 'green'}>
          {protocol?.toUpperCase() || 'SSH'}
        </Tag>
      ),
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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleConnect(record)}
            disabled={activeTerminals.has(record.id.toString())}
            style={{ 
              backgroundColor: activeTerminals.has(record.id.toString()) ? '#52c41a' : undefined,
              borderColor: activeTerminals.has(record.id.toString()) ? '#52c41a' : undefined
            }}
          >
            {activeTerminals.has(record.id.toString()) ? '已连接' : '连接'}
          </Button>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => message.info('登录功能开发中')}
          >
            登录
          </Button>
          <Tooltip title="编辑">
            <Button 
              size="small" 
              icon={<DesktopOutlined />}
              onClick={() => message.info('编辑功能开发中')}
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
    // 只显示服务器类型的资产
    if (asset.type !== 'server') return false;
    
    if (selectedCategory === 'all') return true;
    // 这里可以根据实际的分类逻辑过滤
    return true;
  });

  return (
    <div style={{ height: 'calc(100vh - 100px)' }}>
      <Row gutter={12} style={{ height: '100%' }}>
        <Col span={4} style={{ height: '100%' }}>
          <ResourceTree 
            resourceType="host"
            onSelect={handleTreeSelect}
          />
        </Col>
        <Col span={20} style={{ height: '100%' }}>
          <Card 
            title={
              <Space>
                <DesktopOutlined />
                <span>主机资源</span>
                <Badge count={filteredAssets.length} showZero />
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
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 终端弹窗 */}
      <Modal
        title={`SSH终端 - ${activeTerminals.get(currentSessionId) || ''}`}
        open={terminalModalVisible}
        onCancel={handleCloseTerminal}
        width="90%"
        style={{ top: 20 }}
        footer={null}
        destroyOnClose
      >
        {currentSessionId && (
          <WebTerminal
            sessionId={currentSessionId}
            onClose={handleCloseTerminal}
            onError={(error) => {
              message.error(`终端错误: ${error.message}`);
              handleCloseTerminal();
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default HostSessionsPage;