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
  message,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  KeyOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchCredentials, createCredential, updateCredential, deleteCredential } from '../store/credentialSlice';
import { fetchAssets } from '../store/assetSlice';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const CredentialsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { credentials, total, loading } = useSelector((state: RootState) => state.credential);
  const { assets } = useSelector((state: RootState) => state.asset);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCredential, setEditingCredential] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedCredentialType, setSelectedCredentialType] = useState<'password' | 'key'>('password');
  
  // 根据路由确定凭证类型
  const getCredentialTypeFromRoute = () => {
    if (location.pathname.includes('/credentials/password')) {
      return 'password';
    } else if (location.pathname.includes('/credentials/ssh-key')) {
      return 'key';
    }
    return '';
  };
  
  const [typeFilter, setTypeFilter] = useState(getCredentialTypeFromRoute());

  useEffect(() => {
    loadCredentials();
    loadAssets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听路由变化，更新凭证类型筛选
  useEffect(() => {
    const newTypeFilter = getCredentialTypeFromRoute();
    setTypeFilter(newTypeFilter);
    if (newTypeFilter) {
      setSelectedCredentialType(newTypeFilter as 'password' | 'key');
    }
    // 重新加载数据
    dispatch(fetchCredentials({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: newTypeFilter as 'password' | 'key' | undefined,
      asset_id: assetFilter ? parseInt(assetFilter) : undefined,
    }));
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCredentials = () => {
    dispatch(fetchCredentials({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: typeFilter as 'password' | 'key' | undefined,
      asset_id: assetFilter ? parseInt(assetFilter) : undefined,
    }));
  };

  const loadAssets = () => {
    dispatch(fetchAssets({ page: 1, page_size: 100 }));
  };

  const handleAdd = () => {
    setEditingCredential(null);
    setIsModalVisible(true);
    const routeType = getCredentialTypeFromRoute();
    const defaultType = routeType || 'password';
    setSelectedCredentialType(defaultType as 'password' | 'key');
    form.resetFields();
    form.setFieldsValue({ type: defaultType });
  };

  const handleEdit = (credential: any) => {
    setEditingCredential(credential);
    setIsModalVisible(true);
    setSelectedCredentialType(credential.type);
    const assetIds = credential.assets ? credential.assets.map((asset: any) => asset.id) : [];
    form.setFieldsValue({
      name: credential.name,
      type: credential.type,
      username: credential.username,
      asset_ids: assetIds,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteCredential(id)).unwrap();
      loadCredentials();
    } catch (error) {
      console.error('删除凭证失败:', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const submitData = {
        name: values.name,
        type: values.type,
        username: values.username,
        asset_ids: values.asset_ids,
        ...(values.type === 'password' && { password: values.password }),
        ...(values.type === 'key' && { private_key: values.private_key }),
      };
      
      if (editingCredential) {
        await dispatch(updateCredential({ id: editingCredential.id, credentialData: submitData })).unwrap();
      } else {
        await dispatch(createCredential(submitData)).unwrap();
      }
      setIsModalVisible(false);
      loadCredentials();
    } catch (error: any) {
      console.error('保存凭证失败:', error);
      
      let errorMessage = '保存凭证失败，请检查输入信息';
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = `保存失败: ${error.message}`;
      }
      
      message.error(errorMessage);
    }
  };


  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchCredentials({
      page: 1,
      page_size: pagination.pageSize,
      keyword: value,
      type: typeFilter as 'password' | 'key' | undefined,
      asset_id: assetFilter ? parseInt(assetFilter) : undefined,
    }));
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchCredentials({
      page: 1,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: value as 'password' | 'key' | undefined,
      asset_id: assetFilter ? parseInt(assetFilter) : undefined,
    }));
  };

  const handleAssetFilter = (value: string) => {
    setAssetFilter(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchCredentials({
      page: 1,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: typeFilter as 'password' | 'key' | undefined,
      asset_id: value ? parseInt(value) : undefined,
    }));
  };


  const renderCredentialType = (type: string) => {
    return (
      <Tag color={type === 'password' ? 'blue' : 'green'} icon={type === 'password' ? <LockOutlined /> : <KeyOutlined />}>
        {type === 'password' ? '密码' : '密钥'}
      </Tag>
    );
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => renderCredentialType(type),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '关联资产',
      dataIndex: 'assets',
      key: 'assets',
      render: (credentialAssets: any[]) => {
        if (!credentialAssets || credentialAssets.length === 0) {
          return <span style={{ color: '#999' }}>0</span>;
        }
        
        const tooltipContent = (
          <div>
            {credentialAssets.map((asset, index) => (
              <div key={asset.id} style={{ marginBottom: index < credentialAssets.length - 1 ? 4 : 0 }}>
                {asset.name}
              </div>
            ))}
          </div>
        );
        
        return (
          <Tooltip title={tooltipContent} placement="topLeft">
            <span style={{ color: '#1890ff', cursor: 'pointer' }}>
              {credentialAssets.length}
            </span>
          </Tooltip>
        );
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
      render: (text: any, record: any) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个凭证吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据路由获取页面标题
  const getPageTitle = () => {
    if (location.pathname.includes('/credentials/password')) {
      return '密码凭证管理';
    } else if (location.pathname.includes('/credentials/ssh-key')) {
      return 'SSH密钥凭证管理';
    }
    return '凭证管理';
  };

  return (
    <div>
      <Card title={getPageTitle()}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                key="add"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                {location.pathname.includes('/credentials/password') ? '新增密码凭证' : 
                 location.pathname.includes('/credentials/ssh-key') ? '新增SSH密钥凭证' : '新增凭证'}
              </Button>
              <Button
                key="refresh"
                icon={<ReloadOutlined />}
                onClick={loadCredentials}
              >
                刷新
              </Button>
            </Space>
            <Space>
              {/* 只有在通用凭证管理页面才显示类型筛选器 */}
              {!location.pathname.includes('/credentials/password') && !location.pathname.includes('/credentials/ssh-key') && (
                <Select
                  key="typeFilter"
                  placeholder="筛选类型"
                  allowClear
                  style={{ width: 120 }}
                  onChange={handleTypeFilter}
                  value={typeFilter}
                >
                  <Option value="">全部</Option>
                  <Option value="password">密码</Option>
                  <Option value="key">密钥</Option>
                </Select>
              )}
              <Select
                key="assetFilter"
                placeholder="筛选资产"
                allowClear
                style={{ width: 200 }}
                onChange={handleAssetFilter}
              >
                <Option value="">全部资产</Option>
                {assets.map(asset => (
                  <Option key={asset.id} value={asset.id}>
                    {asset.name}
                  </Option>
                ))}
              </Select>
              <Search
                placeholder="搜索凭证名称或用户名"
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
              />
            </Space>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={credentials}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize: pageSize || 10 });
              dispatch(fetchCredentials({
                page,
                page_size: pageSize || 10,
                keyword: searchKeyword,
                type: typeFilter as 'password' | 'key' | undefined,
                asset_id: assetFilter ? parseInt(assetFilter) : undefined,
              }));
            },
          }}
        />
      </Card>

      <Modal
        title={editingCredential ? '编辑凭证' : 
               (location.pathname.includes('/credentials/password') ? '新增密码凭证' : 
                location.pathname.includes('/credentials/ssh-key') ? '新增SSH密钥凭证' : '新增凭证')}
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
            label="凭证名称"
            name="name"
            rules={[
              { required: true, message: '请输入凭证名称' },
              { min: 1, max: 100, message: '名称长度为1-100个字符' },
            ]}
          >
            <Input placeholder="请输入凭证名称" />
          </Form.Item>

          <Form.Item
            label="凭证类型"
            name="type"
            rules={[{ required: true, message: '请选择凭证类型' }]}
          >
            <Select 
              placeholder="请选择凭证类型"
              onChange={(value) => setSelectedCredentialType(value)}
              disabled={location.pathname.includes('/credentials/password') || location.pathname.includes('/credentials/ssh-key')}
            >
              <Option value="password">密码认证</Option>
              <Option value="key">密钥认证</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 1, max: 100, message: '用户名长度为1-100个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="关联资产"
            name="asset_ids"
            rules={[{ required: true, message: '请选择至少一个关联资产' }]}
          >
            <Select 
              mode="multiple" 
              placeholder="请选择关联资产（可多选）"
              showSearch
            >
              {assets.map(asset => (
                <Option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.address}:{asset.port})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedCredentialType === 'password' && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: !editingCredential, message: '请输入密码' },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          {selectedCredentialType === 'key' && (
            <Form.Item
              label="私钥"
              name="private_key"
              rules={[
                { required: !editingCredential, message: '请输入私钥' },
              ]}
            >
              <TextArea
                rows={8}
                placeholder="请粘贴私钥内容，格式如：&#10;-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              />
            </Form.Item>
          )}

          <Alert
            message="安全提示"
            description="所有凭证信息都会经过加密存储，确保数据安全。创建后密码和私钥将被加密，不会明文显示。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item>
            <Space>
              <Button key="submit" type="primary" htmlType="submit">
                {editingCredential ? '更新' : '创建'}
              </Button>
              <Button key="cancel" onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CredentialsPage; 