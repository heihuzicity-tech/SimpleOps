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
  Popover,
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
import { fetchCredentials, createCredential, updateCredential, deleteCredential, batchDeleteCredentials } from '../store/credentialSlice';
import { fetchAssets } from '../store/assetSlice';
import SearchSelect from '../components/common/SearchSelect';

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
  const [searchType, setSearchType] = useState('name'); // 搜索类型：name, username, asset
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedCredentialType, setSelectedCredentialType] = useState<'password' | 'key'>('password');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  
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
    }));
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCredentials = () => {
    dispatch(fetchCredentials({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: typeFilter as 'password' | 'key' | undefined,
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

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的凭证');
      return;
    }

    setBatchDeleting(true);
    try {
      const ids = selectedRowKeys.map(key => Number(key));
      await dispatch(batchDeleteCredentials(ids)).unwrap();
      setSelectedRowKeys([]);
      loadCredentials();
    } catch (error) {
      console.error('批量删除凭证失败:', error);
    } finally {
      setBatchDeleting(false);
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
    }));
  };

  const handleSearchTypeChange = (value: string) => {
    setSearchType(value);
    // 如果已有搜索关键词，立即执行搜索
    if (searchKeyword) {
      handleSearch(searchKeyword);
    }
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchCredentials({
      page: 1,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: value as 'password' | 'key' | undefined,
    }));
  };


  // 根据路由获取页面信息
  const getPageInfo = () => {
    if (location.pathname.includes('/credentials/password')) {
      return {
        title: '密码凭证管理',
        type: 'password',
        itemName: '密码凭证',
        searchLabel: '凭证名称'
      };
    } else if (location.pathname.includes('/credentials/ssh-key')) {
      return {
        title: '密钥凭证管理', 
        type: 'key',
        itemName: '密钥凭证',
        searchLabel: '凭证名称'
      };
    }
    return {
      title: '凭证管理',
      type: '',
      itemName: '凭证',
      searchLabel: '凭证名称'
    };
  };

  const pageInfo = getPageInfo();

  const renderCredentialType = (type: string) => {
    return (
      <Tag color={type === 'password' ? 'blue' : 'green'} icon={type === 'password' ? <LockOutlined /> : <KeyOutlined />}>
        {type === 'password' ? '密码' : '密钥'}
      </Tag>
    );
  };

  const columns = [
    {
      title: pageInfo.searchLabel,
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      ellipsis: true,
    },
    {
      title: '关联资产',
      dataIndex: 'assets',
      key: 'assets',
      width: 150,
      align: 'center' as const,
      render: (credentialAssets: any[]) => {
        if (!credentialAssets || credentialAssets.length === 0) {
          return <Tag color="default">未关联</Tag>;
        }
        
        const popoverContent = (
          <div style={{ maxWidth: 300 }}>
            {credentialAssets.map(asset => (
              <div key={asset.id} style={{ marginBottom: 8 }}>
                <Tag color="blue">
                  {(() => {
                    // 根据协议判断资产类型
                    if (asset.protocol === 'ssh' || asset.protocol === 'rdp') {
                      return '主机';
                    } else if (asset.protocol === 'mysql' || asset.protocol === 'postgresql' || asset.protocol === 'mongodb') {
                      return '数据库';
                    } else if (asset.type === 'host') {
                      return '主机';
                    } else if (asset.type === 'database') {
                      return '数据库';
                    } else {
                      return '资产';
                    }
                  })()}
                </Tag>
                <span>{asset.name}</span>
                {asset.address && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                    {asset.address}:{asset.port}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
        
        return (
          <Popover 
            content={popoverContent}
            title="关联资产列表"
            placement="top"
          >
            <Button type="link" size="small">
              {credentialAssets.length} 个资产
            </Button>
          </Popover>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (text: any, record: any) => (
        <Space size="small">
          <Button 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个凭证吗？"
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

  return (
    <div>
      <Card title={pageInfo.title}>
        <div style={{ 
          marginBottom: 16, 
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
              { value: 'name', label: pageInfo.searchLabel },
              { value: 'username', label: '用户名' },
              { value: 'asset', label: '关联资产' },
            ]}
            style={{ width: 300 }}
          />
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadCredentials}
            >
              刷新
            </Button>
            {/* 只有在通用凭证管理页面才显示类型筛选器 */}
            {!location.pathname.includes('/credentials/password') && !location.pathname.includes('/credentials/ssh-key') && (
              <Select
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              title={`新建${pageInfo.itemName}`}
            >
              新建
            </Button>
          </Space>
        </div>


        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
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
              }));
            },
          }}
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
            title={`确定要删除这 ${selectedRowKeys.length} 个${pageInfo.itemName}吗？`}
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
              title={selectedRowKeys.length === 0 ? "请先选择要删除的凭证" : `删除选中的 ${selectedRowKeys.length} 个${pageInfo.itemName}`}
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
          </Popconfirm>
          {selectedRowKeys.length > 0 && (
            <span style={{ marginLeft: 12, color: '#666' }}>
              已选择 {selectedRowKeys.length} 个{pageInfo.itemName}
            </span>
          )}
        </div>
      </Card>

      <Modal
        title={editingCredential ? `编辑${pageInfo.itemName}` : `新建${pageInfo.itemName}`}
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
            label={pageInfo.searchLabel}
            name="name"
            rules={[
              { required: true, message: `请输入${pageInfo.searchLabel}` },
              { min: 1, max: 100, message: '名称长度为1-100个字符' },
            ]}
          >
            <Input placeholder={`请输入${pageInfo.searchLabel}`} />
          </Form.Item>

          <Form.Item
            label={pageInfo.type ? `${pageInfo.itemName}类型` : '凭证类型'}
            name="type"
            rules={[{ required: true, message: `请选择${pageInfo.type ? pageInfo.itemName : '凭证'}类型` }]}
          >
            <Select 
              placeholder={`请选择${pageInfo.type ? pageInfo.itemName : '凭证'}类型`}
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
                {editingCredential ? `更新${pageInfo.itemName}` : `创建${pageInfo.itemName}`}
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