import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Switch,
  InputNumber,
  Tag,
  Popconfirm,
  message,
  Select,
  Transfer,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import {
  CommandPolicy,
  PolicyListRequest,
  PolicyCreateRequest,
  PolicyUpdateRequest,
  User,
  Command,
  CommandGroup,
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';
import { getUsers, User as APIUser } from '../../services/userAPI';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;

interface TransferItem {
  key: string;
  title: string;
  description?: string;
  type?: string;
}

const PolicyTable: React.FC = () => {
  const [policies, setPolicies] = useState<CommandPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [isCommandModalVisible, setIsCommandModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CommandPolicy | null>(null);
  const [currentPolicyId, setCurrentPolicyId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  
  // 用户和命令数据
  const [users, setUsers] = useState<APIUser[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [selectedCommandKeys, setSelectedCommandKeys] = useState<string[]>([]);

  useEffect(() => {
    loadPolicies();
    loadUsers();
    loadCommands();
    loadCommandGroups();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const params: PolicyListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        name: searchKeyword || undefined,
      };
      
      const response = await commandFilterService.policy.getPolicies(params);
      if (response.data) {
        setPolicies(response.data.data || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      console.error('加载策略列表失败:', error);
      message.error('加载策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getUsers({ page: 1, page_size: 100 });
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const loadCommands = async () => {
    try {
      const response = await commandFilterService.command.getCommands({ page: 1, page_size: 100 });
      if (response.data) {
        setCommands(response.data.data || []);
      }
    } catch (error) {
      console.error('加载命令列表失败:', error);
    }
  };

  const loadCommandGroups = async () => {
    try {
      const response = await commandFilterService.commandGroup.getCommandGroups({ page: 1, page_size: 100 });
      if (response.data) {
        setCommandGroups(response.data.data || []);
      }
    } catch (error) {
      console.error('加载命令组列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingPolicy(null);
    setIsModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      priority: 50,
    });
  };

  const handleEdit = (policy: CommandPolicy) => {
    setEditingPolicy(policy);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: policy.name,
      description: policy.description,
      enabled: policy.enabled,
      priority: policy.priority,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await commandFilterService.policy.deletePolicy(id);
      message.success('删除成功');
      loadPolicies();
    } catch (error: any) {
      console.error('删除策略失败:', error);
      message.error('删除策略失败');
    }
  };

  const handleSubmit = async (values: PolicyCreateRequest | PolicyUpdateRequest) => {
    try {
      if (editingPolicy) {
        await commandFilterService.policy.updatePolicy(editingPolicy.id, values);
        message.success('更新成功');
      } else {
        await commandFilterService.policy.createPolicy(values as PolicyCreateRequest);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      loadPolicies();
    } catch (error: any) {
      console.error('保存策略失败:', error);
      message.error('保存策略失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    loadPolicies();
  };

  const handleManageUsers = (policy: CommandPolicy) => {
    setCurrentPolicyId(policy.id);
    setSelectedUserKeys((policy.users || []).map(user => user.id.toString()));
    setIsUserModalVisible(true);
  };

  const handleManageCommands = (policy: CommandPolicy) => {
    setCurrentPolicyId(policy.id);
    const commandKeys = (policy.commands || [])
      .filter(pc => pc.type === 'command' && pc.command)
      .map(pc => `command_${pc.command!.id}`);
    const groupKeys = (policy.commands || [])
      .filter(pc => pc.type === 'command_group' && pc.command_group)
      .map(pc => `group_${pc.command_group!.id}`);
    setSelectedCommandKeys([...commandKeys, ...groupKeys]);
    setIsCommandModalVisible(true);
  };

  const handleSaveUsers = async () => {
    if (!currentPolicyId) return;
    
    try {
      await commandFilterService.policy.bindUsers(currentPolicyId, {
        user_ids: selectedUserKeys.map(key => parseInt(key)),
      });
      message.success('用户绑定成功');
      setIsUserModalVisible(false);
      loadPolicies();
    } catch (error: any) {
      console.error('绑定用户失败:', error);
      message.error('绑定用户失败');
    }
  };

  const handleSaveCommands = async () => {
    if (!currentPolicyId) return;
    
    try {
      const commandIds = selectedCommandKeys
        .filter(key => key.startsWith('command_'))
        .map(key => parseInt(key.replace('command_', '')));
      const groupIds = selectedCommandKeys
        .filter(key => key.startsWith('group_'))
        .map(key => parseInt(key.replace('group_', '')));
      
      await commandFilterService.policy.bindCommands(currentPolicyId, {
        command_ids: commandIds,
        command_group_ids: groupIds,
      });
      message.success('命令绑定成功');
      setIsCommandModalVisible(false);
      loadPolicies();
    } catch (error: any) {
      console.error('绑定命令失败:', error);
      message.error('绑定命令失败');
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
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
    },
    {
      title: '关联用户',
      dataIndex: 'user_count',
      key: 'user_count',
      render: (count: number = 0) => (
        <Tag color="blue">{count} 个用户</Tag>
      ),
    },
    {
      title: '关联命令',
      dataIndex: 'command_count',
      key: 'command_count',
      render: (count: number = 0) => (
        <Tag color="orange">{count} 个命令</Tag>
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
      render: (_: any, record: CommandPolicy) => (
        <Space size="small">
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={() => handleManageUsers(record)}
            title="管理用户"
          >
            用户
          </Button>
          <Button
            type="text"
            icon={<CodeOutlined />}
            onClick={() => handleManageCommands(record)}
            title="管理命令"
          >
            命令
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个策略吗？"
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

  // 用户Transfer数据源
  const userDataSource: TransferItem[] = users.map(user => ({
    key: user.id.toString(),
    title: user.username,
    description: user.email,
  }));

  // 命令和命令组Transfer数据源
  const commandDataSource: TransferItem[] = [
    ...commands.map(cmd => ({
      key: `command_${cmd.id}`,
      title: cmd.name,
      description: cmd.description,
      type: '命令',
    })),
    ...commandGroups.map(group => ({
      key: `group_${group.id}`,
      title: group.name,
      description: group.description,
      type: '命令组',
    })),
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增策略
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadPolicies}
          >
            刷新
          </Button>
        </Space>
        <div style={{ float: 'right' }}>
          <Search
            placeholder="搜索策略名称"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={policies}
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
            loadPolicies();
          },
        }}
      />

      {/* 策略编辑模态框 */}
      <Modal
        title={editingPolicy ? '编辑策略' : '新增策略'}
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
            label="策略名称"
            name="name"
            rules={[
              { required: true, message: '请输入策略名称' },
              { max: 100, message: '策略名称最多100个字符' },
            ]}
          >
            <Input placeholder="请输入策略名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: '描述最多500个字符' }]}
          >
            <TextArea
              placeholder="请输入策略描述"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请输入优先级' }]}
          >
            <InputNumber
              min={1}
              max={100}
              placeholder="请输入优先级（1-100）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="启用状态"
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPolicy ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 用户管理模态框 */}
      <Modal
        title="管理关联用户"
        open={isUserModalVisible}
        onCancel={() => setIsUserModalVisible(false)}
        onOk={handleSaveUsers}
        width={800}
      >
        <Transfer
          dataSource={userDataSource}
          titles={['可选用户', '已选用户']}
          targetKeys={selectedUserKeys}
          onChange={(targetKeys) => setSelectedUserKeys(targetKeys as string[])}
          render={item => `${item.title} ${item.description ? `(${item.description})` : ''}`}
          showSearch
          style={{ width: '100%' }}
        />
      </Modal>

      {/* 命令管理模态框 */}
      <Modal
        title="管理关联命令"
        open={isCommandModalVisible}
        onCancel={() => setIsCommandModalVisible(false)}
        onOk={handleSaveCommands}
        width={800}
      >
        <Transfer
          dataSource={commandDataSource}
          titles={['可选命令/命令组', '已选命令/命令组']}
          targetKeys={selectedCommandKeys}
          onChange={(targetKeys) => setSelectedCommandKeys(targetKeys as string[])}
          render={item => (
            <span>
              <Tag color={item.type === '命令' ? 'blue' : 'green'}>
                {item.type}
              </Tag>
              {item.title} {item.description ? `(${item.description})` : ''}
            </span>
          )}
          showSearch
          style={{ width: '100%' }}
        />
      </Modal>
    </div>
  );
};

export default PolicyTable;