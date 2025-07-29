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
  message,
  Popconfirm,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchUsers, createUser, updateUser, deleteUser } from '../store/userSlice';
import { getRoles } from '../services/userAPI';
import { adaptPaginatedResponse } from '../services/responseAdapter';

const { Search } = Input;
const { Option } = Select;

interface Role {
  id: number;
  name: string;
  description: string;
}

const UsersPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, total, loading } = useSelector((state: RootState) => state.user);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form] = Form.useForm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = () => {
    dispatch(fetchUsers({
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: searchKeyword,
    }));
  };

  const loadRoles = async () => {
    try {
      const response = await getRoles();
      // 使用适配器处理响应格式
      const adaptedData = adaptPaginatedResponse<Role>(response.data);
      setRoles(adaptedData.items || []);
    } catch (error: any) {
      console.error('加载角色失败:', error);
      if (error.response?.status === 403) {
        message.error('您没有权限访问角色信息');
      }
      setRoles([]); // 确保即使出错也设置为空数组
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsModalVisible(true);
    form.setFieldsValue({
      ...user,
      role_ids: (user.roles || []).map((role: any) => role.id),
      status: user.status === 1 ? 'active' : 'inactive', // 转换状态：1 -> active, 0 -> inactive
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteUser(id)).unwrap();
      loadUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // 转换状态字段：active -> 1, inactive -> 0
      const processedValues = {
        ...values,
        status: values.status === 'active' ? 1 : 0
      };
      
      if (editingUser) {
        await dispatch(updateUser({ id: editingUser.id, userData: processedValues })).unwrap();
      } else {
        await dispatch(createUser(processedValues)).unwrap();
      }
      setIsModalVisible(false);
      loadUsers();
    } catch (error) {
      console.error('保存用户失败:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    dispatch(fetchUsers({
      page: 1,
      page_size: pagination.pageSize,
      keyword: value,
    }));
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: any[]) => (
        <Space wrap>
          {(roles || []).map((role) => (
            <Tag key={role.id} color="blue">
              {role.name}
            </Tag>
          ))}
        </Space>
      ),
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
            title="确定要删除这个用户吗？"
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
              新增用户
            </Button>
            <Button
              key="refresh"
              icon={<ReloadOutlined />}
              onClick={loadUsers}
            >
              刷新
            </Button>
          </Space>
          <div style={{ float: 'right' }}>
            <Search
              placeholder="搜索用户名或邮箱"
              allowClear
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={users}
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
              dispatch(fetchUsers({
                page,
                page_size: pageSize || 10,
                keyword: searchKeyword,
              }));
            },
          }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
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
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 50, message: '用户名长度为3-50个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item
            label="角色"
            name="role_ids"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              style={{ width: '100%' }}
            >
              {roles.map((role) => (
                <Option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </Option>
              ))}
            </Select>
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
              <Button key="submit" type="primary" htmlType="submit">
                {editingUser ? '更新' : '创建'}
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

export default UsersPage; 