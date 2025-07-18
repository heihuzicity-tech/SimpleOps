import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Input,
  Modal,
  Form,
  Select,
  Tag,
  Popconfirm,
  Tooltip,
  Popover,
  message,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ApiOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchAssets, createAsset, updateAsset, deleteAsset, batchDeleteAssets, testConnection } from '../store/assetSlice';
import { fetchCredentials } from '../store/credentialSlice';
import { getAssetGroups, AssetGroup } from '../services/assetAPI';
import ResourceTree from '../components/sessions/ResourceTree';
import SearchSelect from '../components/common/SearchSelect';

const { Option } = Select;

const AssetsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { assets, total, loading } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState('name'); // 搜索类型：name, address, os_type
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 根据路径确定当前资产类型
  const getCurrentAssetType = () => {
    if (location.pathname.includes('/assets/hosts')) return 'server';
    if (location.pathname.includes('/assets/databases')) return 'database';
    return 'server'; // 默认
  };


  const getCurrentResourceType = (): 'host' | 'database' => {
    if (location.pathname.includes('/assets/databases')) return 'database';
    return 'host'; // 默认
  };

  useEffect(() => {
    loadCredentials();
    loadAssetGroups();
    // 初始化时加载全部资产
    loadAssetsByGroup('all');
  }, []);

  const loadCredentials = () => {
    dispatch(fetchCredentials({ page: 1, page_size: 100 }));
  };

  const loadAssetGroups = async () => {
    try {
      const response = await getAssetGroups({ page: 1, page_size: 100 });
      const groups = response.data.data || [];
      setAssetGroups(groups);
      
    } catch (error) {
      console.error('加载资产分组失败:', error);
    }
  };


  const handleAdd = () => {
    setEditingAsset(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setIsModalVisible(true);
    // 解析标签JSON格式用于表单显示
    const formData = { ...asset };
    if (asset.tags && asset.tags !== '{}') {
      try {
        const parsedTags = JSON.parse(asset.tags);
        formData.tags = parsedTags.tags || '';
      } catch {
        formData.tags = asset.tags;
      }
    } else {
      formData.tags = '';
    }
    // 设置分组字段（一对多关系）
    if (asset.group_id) {
      formData.group_id = asset.group_id;
    }
    // 设置关联凭证字段
    const assetCredentials = credentials.filter(cred => 
      (asset.credential_ids && asset.credential_ids.includes(cred.id)) ||
      (cred.assets && cred.assets.some(a => a.id === asset.id))
    );
    formData.credential_ids = assetCredentials.map(cred => cred.id);
    
    form.setFieldsValue(formData);
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteAsset(id)).unwrap();
      // 同时刷新资产列表和分组数据
      loadAssetsByGroup(selectedCategory);
      loadAssetGroups(); // 添加分组数据刷新
    } catch (error) {
      console.error('删除资产失败:', error);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的资产');
      return;
    }

    setBatchDeleting(true);
    try {
      const ids = selectedRowKeys.map(key => Number(key));
      await dispatch(batchDeleteAssets(ids)).unwrap();
      setSelectedRowKeys([]);
      // 同时刷新资产列表和分组数据
      loadAssetsByGroup(selectedCategory);
      loadAssetGroups();
    } catch (error) {
      console.error('批量删除资产失败:', error);
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // 确保端口号是数字类型，并将标签转换为JSON格式
      const submitData = {
        ...values,
        port: parseInt(values.port),
        tags: values.tags ? JSON.stringify({ tags: values.tags }) : '{}',
        credential_ids: values.credential_ids || [],
      };
      
      if (editingAsset) {
        await dispatch(updateAsset({ id: editingAsset.id, assetData: submitData })).unwrap();
      } else {
        await dispatch(createAsset(submitData)).unwrap();
      }
      setIsModalVisible(false);
      // 同时刷新资产列表和分组数据
      loadAssetsByGroup(selectedCategory);
      loadAssetGroups(); // 添加分组数据刷新
    } catch (error: any) {
      console.error('保存资产失败:', error);
      
      // 根据错误类型显示不同的提示
      let errorMessage = '保存资产失败，请检查输入信息';
      
      // 检查是否是409冲突错误（资产名称已存在）
      if (error?.response?.status === 409 || error?.status === 409 || error?.code === 409) {
        errorMessage = '资产名称已存在，请使用其他名称';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message && error.message.includes('409')) {
        errorMessage = '资产名称已存在，请使用其他名称';
      } else if (error?.message) {
        errorMessage = `保存失败: ${error.message}`;
      }
      
      message.error(errorMessage);
    }
  };


  const handleTestConnection = async (asset: any) => {
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
          const errorMsg = `${serviceTestType.toUpperCase()}服务异常: ${serviceResult.result.message}`;
          message.error(errorMsg, 4);
          setTestResults(prev => ({ ...prev, [asset.id]: { success: false, message: errorMsg } }));
        }
      } else {
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

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    // 使用当前选中的分组进行搜索
    loadAssetsByGroupWithKeyword(selectedCategory, value);
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value);
    // 如果已有搜索关键词，立即执行搜索
    if (searchKeyword) {
      handleSearch(searchKeyword);
    }
  };



  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const categoryKey = selectedKeys[0] as string;
      setSelectedCategory(categoryKey);
      // 根据选中的分组重新加载资产数据
      loadAssetsByGroup(categoryKey);
    } else {
      // 如果没有选中任何分组，默认选择'all'
      setSelectedCategory('all');
      loadAssetsByGroup('all');
    }
  };

  // 根据分组加载资产
  const loadAssetsByGroup = (groupKey: string, keyword?: string) => {
    const currentType = getCurrentAssetType();
    const searchTerm = keyword !== undefined ? keyword : searchKeyword;
    
    if (groupKey === 'all') {
      // 加载所有资产
      dispatch(fetchAssets({
        page: pagination.current,
        page_size: pagination.pageSize,
        keyword: searchTerm,
        type: currentType,
      }));
    } else {
      // 根据分组ID过滤资产
      dispatch(fetchAssets({
        page: pagination.current,
        page_size: pagination.pageSize,
        keyword: searchTerm,
        type: currentType,
        group_id: parseInt(groupKey),
      }));
    }
  };

  // 使用关键字搜索的辅助函数
  const loadAssetsByGroupWithKeyword = (groupKey: string, keyword: string) => {
    loadAssetsByGroup(groupKey, keyword);
  };

  // 手动刷新函数
  const handleRefresh = async () => {
    try {
      await Promise.all([
        loadAssetsByGroup(selectedCategory),
        loadAssetGroups()
      ]);
      message.success('刷新成功');
    } catch (error) {
      message.error('刷新失败');
    }
  };


  const columns = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '主机地址',
      dataIndex: 'address',
      key: 'address',
      width: 140,
      ellipsis: true,
    },
    {
      title: '系统类型',
      dataIndex: 'os_type',
      key: 'os_type',
      width: 100,
      align: 'center' as const,
      render: (osType: string) => {
        const displayType = osType === 'linux' ? 'Linux' : osType === 'windows' ? 'Windows' : 'Unknown';
        const color = osType === 'linux' ? 'blue' : osType === 'windows' ? 'green' : 'default';
        return <Tag color={color}>{displayType}</Tag>;
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 80,
      align: 'center' as const,
      render: (tags: string) => {
        if (!tags || tags === '{}') return '-';
        try {
          const parsedTags = JSON.parse(tags);
          if (parsedTags.tags) {
            return <Tag>{parsedTags.tags}</Tag>;
          }
          // 如果是其他格式的JSON，显示第一个键值对
          const firstKey = Object.keys(parsedTags)[0];
          return firstKey ? <Tag>{parsedTags[firstKey]}</Tag> : '-';
        } catch {
          return <Tag>{tags}</Tag>;
        }
      },
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
      width: 160,
      align: 'center' as const,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (text: any, record: any) => (
        <Space size="small">
          <Button 
            icon={<ApiOutlined />}
            loading={testingConnection === record.id}
            onClick={() => handleTestConnection(record)}
            type={testResults[record.id] && testResults[record.id].success ? 'primary' : 'default'}
            danger={testResults[record.id] && !testResults[record.id].success}
            title={testResults[record.id] ? testResults[record.id].message : undefined}
          >
            测试
          </Button>
          <Button 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个资产吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据选中的分类和路径过滤资产
  const filteredAssets = assets.filter(asset => {
    const currentType = getCurrentAssetType();
    // 只显示当前类型的资产
    if (asset.type !== currentType) return false;
    
    // 根据搜索类型过滤
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      switch (searchType) {
        case 'name':
          if (!asset.name.toLowerCase().includes(keyword)) return false;
          break;
        case 'address':
          if (!asset.address.toLowerCase().includes(keyword)) return false;
          break;
        case 'os_type':
          if (!asset.os_type || !asset.os_type.toLowerCase().includes(keyword)) return false;
          break;
      }
    }
    
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
            resourceType={getCurrentResourceType()}
            onSelect={handleTreeSelect}
            selectedKeys={[selectedCategory]}
            totalCount={total}
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
              onSearchTypeChange={handleSearchTypeChange}
              onSearch={handleSearch}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="请输入关键字搜索"
              searchOptions={[
                { value: 'name', label: '主机名称' },
                { value: 'address', label: '主机地址' },
                { value: 'os_type', label: '系统类型' },
              ]}
              style={{ width: 300 }}
            />
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              >
                刷新
              </Button>
              <Dropdown
                menu={{
                  items: [
                    { key: 'import', label: '导入主机', icon: <PlusOutlined /> },
                  ],
                }}
              >
                <Button>
                  导入主机 <DownOutlined />
                </Button>
              </Dropdown>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                新建
              </Button>
            </Space>
          </div>
          <Card 
            style={{ flex: 1, overflow: 'hidden' }}
            styles={{ body: { height: '100%', overflow: 'auto', padding: 0 } }}
          >
            <div style={{ padding: '12px 16px' }}>
              <Table
                rowSelection={{
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }}
                columns={columns}
                dataSource={filteredAssets}
                loading={loading}
                rowKey="id"
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => (
                    <Space>
                      <span>共 {total} 条数据</span>
                    </Space>
                  ),
                }}
                size="small"
                scroll={{ x: true }}
              />
              
              {/* 批量删除按钮 - 与分页器保持同一水平高度 */}
              <div style={{ 
                marginTop: -40, 
                display: 'flex', 
                justifyContent: 'flex-start',
                alignItems: 'center',
                height: '32px'
              }}>
                <Popconfirm
                  title={`确定要删除这 ${selectedRowKeys.length} 个资产吗？`}
                  onConfirm={handleBatchDelete}
                  okText="确定"
                  cancelText="取消"
                  disabled={selectedRowKeys.length === 0}
                >
                  <Button 
                    danger 
                    icon={<DeleteOutlined />}
                    loading={batchDeleting}
                    disabled={selectedRowKeys.length === 0}
                    title={selectedRowKeys.length === 0 ? "请先选择要删除的资产" : `删除选中的 ${selectedRowKeys.length} 个资产`}
                  >
                    批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
                  </Button>
                </Popconfirm>
                {selectedRowKeys.length > 0 && (
                  <span style={{ marginLeft: 12, color: '#666' }}>
                    已选择 {selectedRowKeys.length} 个资产
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title={editingAsset ? '编辑资产' : '新增资产'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: '请输入资产名称' },
              { min: 2, max: 100, message: '名称长度为2-100个字符' },
            ]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>

          <Form.Item
            label="类型"
            name="type"
            rules={[{ required: true, message: '请选择资产类型' }]}
          >
            <Select placeholder="请选择资产类型">
              <Option value="server">服务器</Option>
              <Option value="database">数据库</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="操作系统"
            name="os_type"
            rules={[{ required: true, message: '请选择操作系统类型' }]}
          >
            <Select placeholder="请选择操作系统">
              <Option value="linux">Linux</Option>
              <Option value="windows">Windows</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="主机地址"
            name="address"
            rules={[
              { required: true, message: '请输入主机地址' },
              { pattern: /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/, message: '请输入有效的IP地址或域名' },
            ]}
          >
            <Input placeholder="请输入主机地址" />
          </Form.Item>

          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select 
              placeholder="请选择协议"
              onChange={(value) => {
                // 根据协议自动填充端口号
                const defaultPorts: Record<string, number> = {
                  ssh: 22,
                  rdp: 3389,
                  vnc: 5900,
                  mysql: 3306,
                  postgresql: 5432,
                  redis: 6379,
                  mongodb: 27017,
                  telnet: 23,
                  ftp: 21,
                  http: 80,
                  https: 443,
                };
                if (defaultPorts[value]) {
                  form.setFieldsValue({ port: defaultPorts[value] });
                }
              }}
            >
              <Option value="ssh">SSH</Option>
              <Option value="rdp">RDP</Option>
              <Option value="vnc">VNC</Option>
              <Option value="mysql">MySQL</Option>
              <Option value="postgresql">PostgreSQL</Option>
              <Option value="redis">Redis</Option>
              <Option value="mongodb">MongoDB</Option>
              <Option value="telnet">Telnet</Option>
              <Option value="ftp">FTP</Option>
              <Option value="http">HTTP</Option>
              <Option value="https">HTTPS</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="端口"
            name="port"
            rules={[
              { required: true, message: '请输入端口号' },
              { 
                validator: (_, value) => {
                  const port = parseInt(value);
                  if (isNaN(port) || port < 1 || port > 65535) {
                    return Promise.reject(new Error('端口号范围为1-65535'));
                  }
                  return Promise.resolve();
                }
              },
            ]}
          >
            <Input 
              placeholder="请输入端口号（协议选择后自动填充）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="标签"
            name="tags"
          >
            <Input placeholder="请输入标签" />
          </Form.Item>

          <Form.Item
            label="关联凭证"
            name="credential_ids"
            tooltip="可选：选择与此资产关联的凭证"
          >
            <Select 
              mode="multiple" 
              placeholder="选择已有凭证（可选）"
              allowClear
              showSearch
            >
              {credentials.map(credential => (
                <Option key={credential.id} value={credential.id}>
                  {credential.name} ({credential.username})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="资产分组"
            name="group_id"
            tooltip="可选：选择资产所属的分组（一个资产只能属于一个分组）"
          >
            <Select 
              placeholder="选择资产分组（可选）"
              allowClear
              showSearch
            >
              {assetGroups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button key="submit" type="primary" htmlType="submit">
                {editingAsset ? '更新' : '创建'}
              </Button>
              <Button key="cancel" onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

    </>
  );
};

export default AssetsPage; 