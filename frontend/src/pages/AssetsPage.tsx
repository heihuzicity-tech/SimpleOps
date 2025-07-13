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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchAssets, createAsset, updateAsset, deleteAsset, testConnection } from '../store/assetSlice';
import { fetchCredentials } from '../store/credentialSlice';

const { Search } = Input;
const { Option } = Select;

const AssetsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, total, loading } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [testingConnection, setTestingConnection] = useState<number | null>(null);

  useEffect(() => {
    loadAssets();
    loadCredentials();
  }, []);

  const loadCredentials = () => {
    dispatch(fetchCredentials({ page: 1, page_size: 100 }));
  };

  const loadAssets = () => {
    dispatch(fetchAssets({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
      type: typeFilter,
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
    dispatch(fetchAssets({
      page: 1,
      page_size: pagination.pageSize,
      keyword: value,
      type: typeFilter,
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
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>{getTypeText(type)}</Tag>
      ),
    },
    {
      title: '主机',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => protocol?.toUpperCase() || '-',
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Badge
          status={status === 1 ? 'success' : 'error'}
          text={status === 1 ? '活跃' : '禁用'}
        />
      ),
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
          <Tooltip key="test" title="测试连接">
            <Button
              type="text"
              icon={<LinkOutlined />}
              loading={testingConnection === record.id}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Button
            key="edit"
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            key="delete"
            title="确定要删除这个资产吗？"
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

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增资产
            </Button>
            <Button
              key="refresh"
              icon={<ReloadOutlined />}
              onClick={loadAssets}
            >
              刷新
            </Button>
            <Select
              key="filter"
              placeholder="筛选类型"
              allowClear
              style={{ width: 120 }}
              onChange={handleTypeFilter}
            >
              <Option value="">全部</Option>
              <Option value="server">服务器</Option>
              <Option value="database">数据库</Option>
            </Select>
          </Space>
          <div style={{ float: 'right' }}>
            <Search
              placeholder="搜索名称或主机"
              allowClear
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={assets}
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
              dispatch(fetchAssets({
                page,
                page_size: pageSize || 10,
                keyword: searchKeyword,
                type: typeFilter,
              }));
            },
          }}
        />
      </Card>

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
    </div>
  );
};

export default AssetsPage; 