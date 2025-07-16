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
  Select,
  Input
} from 'antd';
import { 
  LinkOutlined, 
  DesktopOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  ApiOutlined,
  SearchOutlined,
  WindowsOutlined,
  LinuxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ResourceTree from '../../components/sessions/ResourceTree';
import CredentialSelector from '../../components/sessions/CredentialSelector';
import QuickAccess from '../../components/sessions/QuickAccess';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import { createSession } from '../../store/sshSessionSlice';
import { performConnectionTest } from '../../services/connectionTest';
import type { ColumnsType } from 'antd/es/table';
import type { Asset } from '../../types';

const { Search } = Input;
const { Option } = Select;

const HostSessionsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { assets, loading } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeSessions, setActiveSessions] = useState<Set<number>>(new Set());
  const [testingAssets, setTestingAssets] = useState<Set<number>>(new Set());
  const [credentialModalVisible, setCredentialModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchText, setSearchText] = useState('');
  const [osTypeFilter, setOsTypeFilter] = useState<string>('all');
  const [connectionStatusFilter, setConnectionStatusFilter] = useState<string>('all');

  const loadAssets = useCallback(() => {
    dispatch(fetchAssets({
      page: 1,
      page_size: 100,
      type: 'server'
    }));
    dispatch(fetchCredentials({ page: 1, page_size: 100 }));
  }, [dispatch]);

  useEffect(() => {
    loadAssets();
    // 从localStorage加载最近连接
    const recentConnections = localStorage.getItem('recentConnections');
    if (recentConnections) {
      const recent = JSON.parse(recentConnections);
      setActiveSessions(new Set(recent));
    }
  }, [loadAssets]);

  const handleConnect = async (asset: Asset) => {
    // 获取该资产的可用凭证
    const assetCredentials = credentials.filter(cred => 
      cred.assets && cred.assets.some(a => a.id === asset.id)
    );
    
    if (credentials.length === 0) {
      message.warning('没有可用的凭证，请先创建凭证');
      return;
    }
    
    // 显示凭证选择对话框
    setSelectedAsset(asset);
    setCredentialModalVisible(true);
  };
  
  const handleCredentialSelect = async (credentialId: number) => {
    if (!selectedAsset) return;
    
    setCredentialModalVisible(false);
    
    try {
      // 先进行连接测试
      setTestingAssets(prev => new Set(prev).add(selectedAsset.id));
      const testResult = await performConnectionTest(dispatch, selectedAsset, credentialId);
      
      if (!testResult.success) {
        setTestingAssets(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedAsset.id);
          return newSet;
        });
        return;
      }
      
      // 测试通过，创建会话
      const response = await dispatch(createSession({
        asset_id: selectedAsset.id,
        credential_id: credentialId,
        protocol: selectedAsset.protocol || 'ssh'
      })).unwrap();
      
      // 更新活跃会话状态
      setActiveSessions(prev => new Set(prev).add(selectedAsset.id));
      
      // 保存到最近连接
      const recentConnections = Array.from(activeSessions).concat(selectedAsset.id).slice(-10);
      localStorage.setItem('recentConnections', JSON.stringify(recentConnections));
      
      message.success(`成功连接到 ${selectedAsset.name}`);
      
      // 跳转到终端页面
      navigate(`/connect/terminal/${response.id}`);
    } catch (error: any) {
      message.error(`连接失败: ${error.message}`);
    } finally {
      setTestingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedAsset.id);
        return newSet;
      });
    }
  };

  const handleTest = async (asset: Asset) => {
    const assetCredentials = credentials.filter(cred => 
      cred.assets && cred.assets.some(a => a.id === asset.id)
    );
    
    if (assetCredentials.length === 0) {
      message.warning('该资产没有关联的凭证');
      return;
    }
    
    const credentialId = assetCredentials[0].id;
    setTestingAssets(prev => new Set(prev).add(asset.id));
    
    try {
      await performConnectionTest(dispatch, asset, credentialId);
    } finally {
      setTestingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(asset.id);
        return newSet;
      });
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      setSelectedCategory(selectedKeys[0] as string);
    }
  };
  
  // 处理快速访问连接
  const handleQuickConnect = async (connection: any) => {
    // 找到对应的资产
    const asset = assets.find(a => a.id === connection.id);
    if (asset) {
      await handleConnect(asset);
    } else {
      message.warning('资产信息不存在，可能已被删除');
    }
  };

  const columns: ColumnsType<any> = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string, record) => (
        <Space size="small">
          <CloudServerOutlined style={{ color: record.os_type === 'linux' ? '#52c41a' : '#1890ff' }} />
          <span>{text}</span>
          {activeSessions.has(record.id) && (
            <Badge status="processing" text="已连接" />
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
      dataIndex: 'os_type',
      key: 'os_type',
      width: 100,
      render: (osType: string) => {
        const isLinux = osType === 'linux';
        return (
          <Tag 
            icon={isLinux ? <LinuxOutlined /> : <WindowsOutlined />} 
            color={isLinux ? 'green' : 'blue'}
          >
            {isLinux ? 'Linux' : 'Windows'}
          </Tag>
        );
      },
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
      render: (protocol: string) => (
        <Tag color="cyan">
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
          <Tooltip title="测试连接">
            <Button
              size="small"
              icon={<ApiOutlined />}
              onClick={() => handleTest(record)}
              loading={testingAssets.has(record.id)}
            >
              测试
            </Button>
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleConnect(record)}
            disabled={activeSessions.has(record.id)}
            style={{ 
              backgroundColor: activeSessions.has(record.id) ? '#52c41a' : undefined,
              borderColor: activeSessions.has(record.id) ? '#52c41a' : undefined
            }}
          >
            {activeSessions.has(record.id) ? '已连接' : '连接'}
          </Button>
        </Space>
      ),
    },
  ];

  // 根据选中的分类和筛选条件过滤资产
  const filteredAssets = assets.filter(asset => {
    // 只显示服务器类型的资产
    if (asset.type !== 'server') return false;
    
    // 文本搜索
    if (searchText) {
      const search = searchText.toLowerCase();
      if (!asset.name.toLowerCase().includes(search) && 
          !asset.address.toLowerCase().includes(search)) {
        return false;
      }
    }
    
    // 系统类型筛选
    if (osTypeFilter !== 'all' && asset.os_type !== osTypeFilter) {
      return false;
    }
    
    // 连接状态筛选
    if (connectionStatusFilter === 'connected' && !activeSessions.has(asset.id)) {
      return false;
    }
    if (connectionStatusFilter === 'disconnected' && activeSessions.has(asset.id)) {
      return false;
    }
    
    // 分类筛选
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
        <Col span={20} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 快速访问 */}
          <QuickAccess onConnect={handleQuickConnect} />
          
          <Card 
            title={
              <Space>
                <DesktopOutlined />
                <span>主机资源</span>
                <Badge count={filteredAssets.length} showZero />
              </Space>
            }
            extra={
              <Space>
                <Select
                  value={osTypeFilter}
                  onChange={setOsTypeFilter}
                  style={{ width: 120 }}
                  placeholder="系统类型"
                >
                  <Option value="all">全部系统</Option>
                  <Option value="linux">
                    <Space>
                      <LinuxOutlined />
                      Linux
                    </Space>
                  </Option>
                  <Option value="windows">
                    <Space>
                      <WindowsOutlined />
                      Windows
                    </Space>
                  </Option>
                </Select>
                
                <Select
                  value={connectionStatusFilter}
                  onChange={setConnectionStatusFilter}
                  style={{ width: 120 }}
                  placeholder="连接状态"
                >
                  <Option value="all">全部状态</Option>
                  <Option value="connected">已连接</Option>
                  <Option value="disconnected">未连接</Option>
                </Select>
                
                <Search
                  placeholder="搜索主机名或IP"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadAssets}
                  loading={loading}
                >
                  刷新
                </Button>
              </Space>
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

      {/* 凭证选择对话框 */}
      <CredentialSelector
        visible={credentialModalVisible}
        asset={selectedAsset}
        credentials={credentials}
        onSelect={handleCredentialSelect}
        onCancel={() => setCredentialModalVisible(false)}
      />
    </div>
  );
};

export default HostSessionsPage;