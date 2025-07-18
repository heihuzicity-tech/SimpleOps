import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space, 
  message,
  Tooltip,
  Select,
  Popover,
} from 'antd';
import { 
  LinkOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  ApiOutlined,
  WindowsOutlined,
  LinuxOutlined
} from '@ant-design/icons';
import ResourceTree from '../../components/sessions/ResourceTree';
import SearchSelect from '../../components/common/SearchSelect';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAssets, testConnection } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import type { ColumnsType } from 'antd/es/table';
import type { Asset } from '../../types';

const { Option } = Select;

const HostSessionsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { assets, loading } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('name'); // 搜索类型：name, address
  const [osTypeFilter, setOsTypeFilter] = useState<string>('all');

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
    }, [loadAssets]);

  // 处理连接 - 跳转到控制台并自动连接
  const handleConnect = async (asset: Asset) => {
    // 构建控制台URL，传递主机信息用于自动连接
    const workspaceUrl = `/connect/workspace?assetId=${asset.id}&name=${encodeURIComponent(asset.name)}&address=${asset.address}`;
    
    // 在新标签页中打开控制台
    window.open(workspaceUrl, '_blank', 'noopener,noreferrer');
  };


  const handleTest = async (asset: Asset) => {
    // 获取该资产的凭据列表
    const assetCredentials = credentials.filter(cred => 
      cred.assets && cred.assets.some(a => a.id === asset.id)
    );
    
    if (assetCredentials.length === 0) {
      message.warning('该资产没有关联的凭据，请先配置凭据');
      return;
    }
    // 使用第一个可用的凭据进行测试
    const credentialId = assetCredentials[0].id;
    
    setTestingConnection(asset.id);
    try {
      // 分层测试策略：先测主机连通性，再测服务
      await performLayeredConnectionTest(asset, credentialId);
    } catch (error) {
      console.error('连接测试失败:', error);
    } finally {
      setTestingConnection(null);
    }
  };
  
  // 分层连接测试
  const performLayeredConnectionTest = async (asset: any, credentialId: number) => {
    try {
      // 第一层：主机连通性测试
      const pingResult = await dispatch(testConnection({
        asset_id: asset.id,
        credential_id: credentialId,
        test_type: 'ping'
      })).unwrap();
      
      if (!pingResult.result.success) {
        // 主机不可达，显示网络错误
        const errorMsg = `主机不可达: ${asset.address}`;
        message.error(errorMsg, 4);
        setTestResults(prev => ({ ...prev, [asset.id]: { success: false, message: errorMsg } }));
        return;
      }
      
      // 第二层：服务端口测试
      let serviceTestType = 'ping';
      if (asset.type === 'server') {
        if (asset.protocol === 'ssh') serviceTestType = 'ssh';
        else if (asset.protocol === 'rdp') serviceTestType = 'rdp';
      } else if (asset.type === 'database') {
        serviceTestType = 'database';
      }
      
      if (serviceTestType !== 'ping') {
        const serviceResult = await dispatch(testConnection({
          asset_id: asset.id,
          credential_id: credentialId,
          test_type: serviceTestType as 'ping' | 'ssh' | 'rdp' | 'database'
        })).unwrap();
        
        if (serviceResult.result.success) {
          const successMsg = `${serviceTestType.toUpperCase()}服务正常 (延迟: ${serviceResult.result.latency}ms)`;
          message.success(successMsg, 3);
          setTestResults(prev => ({ ...prev, [asset.id]: { success: true, message: successMsg } }));
        } else {
          const errorMsg = `${serviceTestType.toUpperCase()}服务不可用: ${serviceResult.result.error}`;
          message.error(errorMsg, 4);
          setTestResults(prev => ({ ...prev, [asset.id]: { success: false, message: errorMsg } }));
        }
      } else {
        // 只有ping测试
        const successMsg = `主机连通正常 (延迟: ${pingResult.result.latency}ms)`;
        message.success(successMsg, 3);
        setTestResults(prev => ({ ...prev, [asset.id]: { success: true, message: successMsg } }));
      }
    } catch (error: any) {
      const errorMsg = `连接测试异常: ${error.message}`;
      message.error(errorMsg, 4);
      setTestResults(prev => ({ ...prev, [asset.id]: { success: false, message: errorMsg } }));
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      setSelectedCategory(selectedKeys[0] as string);
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
      dataIndex: 'credential_ids',
      key: 'credentials',
      width: 120,
      align: 'center' as const,
      render: (credentialIds: number[], record: any) => {
        // 获取该资产关联的凭证
        const assetCredentials = credentials.filter(cred => 
          credentialIds?.includes(cred.id) || 
          (cred.assets && cred.assets.some(a => a.id === record.id))
        );
        
        if (assetCredentials.length === 0) {
          return <Tag color="default">未关联</Tag>;
        }
        
        const popoverContent = (
          <div style={{ maxWidth: 300 }}>
            {assetCredentials.map(cred => (
              <div key={cred.id} style={{ marginBottom: 8 }}>
                <Tag color={cred.type === 'password' ? 'blue' : 'green'}>
                  {cred.type === 'password' ? '密码' : '密钥'}
                </Tag>
                <span>{cred.name}</span>
              </div>
            ))}
          </div>
        );
        
        return (
          <Popover 
            content={popoverContent}
            title="关联凭证列表"
            placement="top"
          >
            <Button type="link" size="small">
              {assetCredentials.length} 个凭证
            </Button>
          </Popover>
        );
      },
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
          <Tooltip title={testResults[record.id] ? testResults[record.id].message : "测试连接"}>
            <Button
              size="small"
              icon={<ApiOutlined />}
              onClick={() => handleTest(record)}
              loading={testingConnection === record.id}
              type={testResults[record.id] && testResults[record.id].success ? 'primary' : 'default'}
              danger={testResults[record.id] && !testResults[record.id].success}
            >
              测试
            </Button>
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleConnect(record)}
          >
            连接
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
      if (searchType === 'name' && !asset.name.toLowerCase().includes(search)) {
        return false;
      }
      if (searchType === 'address' && !asset.address.toLowerCase().includes(search)) {
        return false;
      }
      if (searchType === 'all' && !asset.name.toLowerCase().includes(search) && 
          !asset.address.toLowerCase().includes(search)) {
        return false;
      }
    }
    
    // 系统类型筛选
    if (osTypeFilter !== 'all' && asset.os_type !== osTypeFilter) {
      return false;
    }
    
    
    // 分类筛选
    if (selectedCategory === 'all') return true;
    // 这里可以根据实际的分类逻辑过滤
    return true;
  });

  return (
    <>
      <div style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: '12px' }}>
        <div 
          style={{ 
            width: '240px',
            minWidth: '200px',
            maxWidth: '260px',
            height: '100%',
            flexShrink: 0
          }}
        >
          <ResourceTree 
            resourceType="host"
            onSelect={handleTreeSelect}
            totalCount={filteredAssets.length}
          />
        </div>
        <div 
          style={{ 
            flex: 1,
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            minWidth: 0
          }}
        >
          <div style={{ 
            marginBottom: 8, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <SearchSelect
              searchType={searchType}
              onSearchTypeChange={setSearchType}
              onSearch={setSearchText}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="请输入关键字搜索"
              searchOptions={[
                { value: 'name', label: '主机名称' },
                { value: 'address', label: '主机地址' },
                { value: 'all', label: '全部' },
              ]}
              style={{ width: 300 }}
            />
            <Space>
              <Select
                value={osTypeFilter}
                onChange={setOsTypeFilter}
                style={{ width: 140 }}
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
              
              
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAssets}
                loading={loading}
                title="刷新数据"
              >
                刷新
              </Button>
            </Space>
          </div>
          <Card 
            style={{ flex: 1, overflow: 'hidden' }}
            styles={{ body: { height: '100%', overflow: 'auto', padding: 0 } }}
          >
            <div style={{ padding: '12px 16px' }}>
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
            </div>
          </Card>
        </div>
      </div>

    </>
  );
};

export default HostSessionsPage;