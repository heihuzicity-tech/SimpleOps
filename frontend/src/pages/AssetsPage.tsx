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
  Badge,
  Popconfirm,
  Tooltip,
  message,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  DesktopOutlined,
  EyeOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchAssets, createAsset, updateAsset, deleteAsset, testConnection } from '../store/assetSlice';
import { fetchCredentials } from '../store/credentialSlice';
import { getAssetGroups, createAssetGroup, deleteAssetGroup, AssetGroup } from '../services/assetAPI';
import ResourceTree from '../components/sessions/ResourceTree';

const { Search } = Input;
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
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [groupForm] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 根据路径确定当前资产类型
  const getCurrentAssetType = () => {
    if (location.pathname.includes('/assets/hosts')) return 'server';
    if (location.pathname.includes('/assets/databases')) return 'database';
    return 'server'; // 默认
  };

  const getCurrentPageTitle = () => {
    if (location.pathname.includes('/assets/hosts')) return '主机资源';
    if (location.pathname.includes('/assets/databases')) return '数据库';
    return '主机资源'; // 默认
  };

  const getCurrentResourceType = (): 'host' | 'database' => {
    if (location.pathname.includes('/assets/databases')) return 'database';
    return 'host'; // 默认
  };

  useEffect(() => {
    loadAssets();
    loadCredentials();
    loadAssetGroups();
  }, []);

  const loadCredentials = () => {
    dispatch(fetchCredentials({ page: 1, page_size: 100 }));
  };

  const loadAssetGroups = async () => {
    try {
      const response = await getAssetGroups({ page: 1, page_size: 100 });
      setAssetGroups(response.data.data || []);
    } catch (error) {
      console.error('加载资产分组失败:', error);
    }
  };

  const loadAssets = () => {
    const currentType = getCurrentAssetType();
    dispatch(fetchAssets({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: currentType,
    }));
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
    // 设置分组字段
    if (asset.groups && asset.groups.length > 0) {
      formData.group_ids = asset.groups.map((group: AssetGroup) => group.id);
    }
    form.setFieldsValue(formData);
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteAsset(id)).unwrap();
      loadAssets();
    } catch (error) {
      console.error('删除资产失败:', error);
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
      loadAssets();
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

  const handleTestConnection = async (id: number) => {
    setTestingConnection(id);
    try {
      await dispatch(testConnection(id)).unwrap();
    } catch (error) {
      console.error('连接测试失败:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    const currentType = getCurrentAssetType();
    dispatch(fetchAssets({
      page: 1,
      page_size: pagination.pageSize,
      keyword: value,
      type: currentType,
    }));
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchAssets({
      page: 1,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: value,
    }));
  };

  const handleCreateGroup = async (values: any) => {
    try {
      await createAssetGroup(values);
      message.success('分组创建成功');
      setIsGroupModalVisible(false);
      groupForm.resetFields();
      loadAssetGroups();
    } catch (error) {
      message.error('分组创建失败');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      await deleteAssetGroup(groupId);
      message.success('分组删除成功');
      loadAssetGroups();
    } catch (error) {
      message.error('分组删除失败');
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      setSelectedCategory(selectedKeys[0] as string);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'server':
        return 'blue';
      case 'database':
        return 'green';
      default:
        return 'default';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'server':
        return '服务器';
      case 'database':
        return '数据库';
      default:
        return type;
    }
  };

  const columns = [
    {
      title: '主机名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '主机地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '系统类型',
      dataIndex: 'os_type',
      key: 'os_type',
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (text: any, record: any) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button 
              size="small"
              icon={<EyeOutlined />}
              loading={testingConnection === record.id}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个资产吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button 
                size="small" 
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 根据选中的分类和路径过滤资产
  const filteredAssets = assets.filter(asset => {
    const currentType = getCurrentAssetType();
    // 只显示当前类型的资产
    if (asset.type !== currentType) return false;
    
    if (selectedCategory === 'all') return true;
    // 这里可以根据实际的分类逻辑过滤
    return true;
  });

  return (
    <div style={{ height: 'calc(100vh - 100px)' }}>
      <Row gutter={12} style={{ height: '100%' }}>
        <Col span={4} style={{ height: '100%' }}>
          <ResourceTree 
            resourceType={getCurrentResourceType()}
            onSelect={handleTreeSelect}
          />
        </Col>
        <Col span={20} style={{ height: '100%' }}>
          <Card 
            title={
              <Space>
                {getCurrentPageTitle() === '主机资源' ? <DesktopOutlined /> : <ConsoleSqlOutlined />}
                <span>{getCurrentPageTitle()}</span>
                <Badge count={filteredAssets.length} showZero />
              </Space>
            }
            extra={
              <Space>
                <Search
                  placeholder="请输入主机名称、主机地址搜索"
                  allowClear
                  onSearch={handleSearch}
                  style={{ width: 250 }}
                  size="small"
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadAssets}
                  loading={loading}
                  size="small"
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                  size="small"
                >
                  新增资产
                </Button>
                <Button
                  onClick={() => setIsGroupModalVisible(true)}
                  size="small"
                >
                  分组管理
                </Button>
              </Space>
            }
            style={{ height: '100%' }}
            styles={{ body: { height: 'calc(100% - 56px)', overflow: 'auto' } }}
          >
            <Table
              columns={columns}
              dataSource={filteredAssets}
              loading={loading}
              rowKey="id"
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
            <Input type="number" placeholder="请输入端口号" />
          </Form.Item>

          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select placeholder="请选择协议">
              <Option value="ssh">SSH</Option>
              <Option value="rdp">RDP</Option>
              <Option value="vnc">VNC</Option>
              <Option value="mysql">MySQL</Option>
              <Option value="postgresql">PostgreSQL</Option>
            </Select>
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
            name="group_ids"
            tooltip="可选：选择资产所属的分组"
          >
            <Select 
              mode="multiple" 
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

      {/* 分组管理弹窗 */}
      <Modal
        title="分组管理"
        open={isGroupModalVisible}
        onCancel={() => setIsGroupModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Form
            form={groupForm}
            layout="inline"
            onFinish={handleCreateGroup}
          >
            <Form.Item
              name="name"
              rules={[{ required: true, message: '请输入分组名称' }]}
            >
              <Input placeholder="分组名称" />
            </Form.Item>
            <Form.Item
              name="description"
            >
              <Input placeholder="分组描述（可选）" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                创建分组
              </Button>
            </Form.Item>
          </Form>
        </div>
        
        <Table
          dataSource={assetGroups}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              key: 'id',
              width: 80,
            },
            {
              title: '分组名称',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              render: (text: string) => text || '-',
            },
            {
              title: '资产数量',
              dataIndex: 'asset_count',
              key: 'asset_count',
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (text: string) => new Date(text).toLocaleString(),
            },
            {
              title: '操作',
              key: 'action',
              render: (text: any, record: AssetGroup) => (
                <Popconfirm
                  title="确定要删除这个分组吗？"
                  onConfirm={() => handleDeleteGroup(record.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default AssetsPage; 