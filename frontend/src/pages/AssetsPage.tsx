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

const { Search } = Input;
const { Option } = Select;

const AssetsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, total, loading } = useSelector((state: RootState) => state.asset);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [testingConnection, setTestingConnection] = useState<number | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = () => {
    dispatch(fetchAssets({
      page: pagination.current,
      limit: pagination.pageSize,
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
    form.setFieldsValue(asset);
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
      if (editingAsset) {
        await dispatch(updateAsset({ id: editingAsset.id, assetData: values })).unwrap();
      } else {
        await dispatch(createAsset(values)).unwrap();
      }
      setIsModalVisible(false);
      loadAssets();
    } catch (error) {
      console.error('保存资产失败:', error);
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
      limit: pagination.pageSize,
      keyword: value,
      type: typeFilter,
    }));
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchAssets({
      page: 1,
      limit: pagination.pageSize,
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
      case 'network':
        return 'orange';
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
      case 'network':
        return '网络设备';
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
      dataIndex: 'host',
      key: 'host',
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
    },
    {
      title: '分组',
      dataIndex: 'group',
      key: 'group',
      render: (group: string) => group ? <Tag>{group}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '活跃' : '禁用'}
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
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<LinkOutlined />}
              loading={testingConnection === record.id}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
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
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增资产
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAssets}
            >
              刷新
            </Button>
            <Select
              placeholder="筛选类型"
              allowClear
              style={{ width: 120 }}
              onChange={handleTypeFilter}
            >
              <Option value="">全部</Option>
              <Option value="server">服务器</Option>
              <Option value="database">数据库</Option>
              <Option value="network">网络设备</Option>
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
                limit: pageSize || 10,
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
              <Option value="network">网络设备</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="主机地址"
            name="host"
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
              { type: 'number', min: 1, max: 65535, message: '端口号范围为1-65535' },
            ]}
          >
            <Input type="number" placeholder="请输入端口号" />
          </Form.Item>

          <Form.Item
            label="分组"
            name="group"
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            initialValue="active"
          >
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAsset ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
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