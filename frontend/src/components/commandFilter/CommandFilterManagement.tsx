import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Tag,
  Popconfirm,
  message,
  Transfer,
  Badge,
  Tooltip,
  Switch,
  Select,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  UserOutlined,
  DesktopOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  CommandFilter,
  CommandGroup,
  Asset,
  Credential,
  CommandFilterListRequest,
  CommandFilterCreateRequest,
  CommandFilterUpdateRequest,
  FilterAttribute,
  FilterAction,
  User,
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';
import { adaptPaginatedResponse } from '../../services/responseAdapter';
import { getUsers } from '../../services/userAPI';
import { getAssets } from '../../services/assetAPI';
import { getCredentials } from '../../services/credentialAPI';
import FilterRuleWizard from './FilterRuleWizard';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;

interface TransferItem {
  key: string;
  title: string;
  description?: string;
}

const CommandFilterManagement: React.FC = () => {
  const [filters, setFilters] = useState<CommandFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFilter, setEditingFilter] = useState<CommandFilter | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  
  // 数据源
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);

  useEffect(() => {
    loadFilters();
    loadCommandGroups();
    loadUsers();
    loadAssets();
    loadCredentials();
  }, []);

  const loadFilters = async () => {
    setLoading(true);
    try {
      const params: CommandFilterListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        name: searchKeyword || undefined,
      };
      
      const response = await commandFilterService.filter.getFilters(params);
      if (response.data) {
        const adaptedData = adaptPaginatedResponse<CommandFilter>(response);
        setFilters(adaptedData.items);
        setTotal(adaptedData.total);
      }
    } catch (error: any) {
      console.error('加载过滤规则列表失败:', error);
      message.error('加载过滤规则列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCommandGroups = async () => {
    try {
      const response = await commandFilterService.commandGroup.getCommandGroups({ 
        page: 1, 
        page_size: 100 
      });
      if (response.data) {
        const adaptedData = adaptPaginatedResponse<CommandGroup>(response);
        setCommandGroups(adaptedData.items);
      }
    } catch (error) {
      console.error('加载命令组列表失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getUsers({ page: 1, page_size: 100 });
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        // 转换用户数据以匹配类型定义
        const users = response.data.data.items.map((user: any) => ({
          ...user,
          status: user.status === 'active' ? 1 : 0, // 将字符串状态转换为数字
        }));
        setUsers(users);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const loadAssets = async () => {
    try {
      const response = await getAssets({ page: 1, page_size: 100 });
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        setAssets(response.data.data.items);
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
    }
  };

  const loadCredentials = async () => {
    try {
      const response = await getCredentials({ page: 1, page_size: 100 });
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        const credentialList = response.data.data.items;
        setCredentials(credentialList);
        
        // 提取唯一的账号名称
        const uniqueAccounts = Array.from(new Set(
          credentialList.map((cred: Credential) => cred.username)
        )).filter(Boolean).sort();
        setAvailableAccounts(uniqueAccounts);
      }
    } catch (error) {
      console.error('加载凭证列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingFilter(null);
    setIsModalVisible(true);
  };

  const handleEdit = async (filter: CommandFilter) => {
    // 加载详细信息
    try {
      const response = await commandFilterService.filter.getFilter(filter.id);
      if (response.data) {
        setEditingFilter(response.data);
        setIsModalVisible(true);
      }
    } catch (error) {
      console.error('加载过滤规则详情失败:', error);
      message.error('加载过滤规则详情失败');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteLoading(id);
    try {
      await commandFilterService.filter.deleteFilter(id);
      message.success('删除成功');
      loadFilters();
    } catch (error: any) {
      console.error('删除过滤规则失败:', error);
      message.error('删除过滤规则失败');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleToggle = async (id: number) => {
    setToggleLoading(id);
    try {
      await commandFilterService.filter.toggleFilter(id);
      message.success('状态切换成功');
      loadFilters();
    } catch (error: any) {
      console.error('切换状态失败:', error);
      message.error('切换状态失败');
    } finally {
      setToggleLoading(null);
    }
  };

  const handleSubmit = async (data: CommandFilterCreateRequest | CommandFilterUpdateRequest) => {
    try {
      if (editingFilter) {
        await commandFilterService.filter.updateFilter(editingFilter.id, data);
        message.success('更新成功');
      } else {
        await commandFilterService.filter.createFilter(data as CommandFilterCreateRequest);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      loadFilters();
    } catch (error: any) {
      console.error('保存过滤规则失败:', error);
      message.error('保存过滤规则失败');
      throw error; // 抛出错误让向导组件处理
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    loadFilters();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'deny':
        return 'red';
      case 'allow':
        return 'green';
      case 'alert':
        return 'orange';
      case 'prompt_alert':
        return 'gold';
      default:
        return 'default';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'deny':
        return '拒绝';
      case 'allow':
        return '允许';
      case 'alert':
        return '告警';
      case 'prompt_alert':
        return '提示并告警';
      default:
        return action;
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FilterOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: number) => (
        <Badge count={priority} style={{ backgroundColor: priority <= 30 ? '#f5222d' : priority <= 70 ? '#faad14' : '#52c41a' }} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: CommandFilter) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggle(record.id)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          loading={toggleLoading === record.id}
        />
      ),
    },
    {
      title: '应用范围',
      key: 'scope',
      render: (record: CommandFilter) => (
        <Space direction="vertical" size="small">
          <Space>
            <UserOutlined />
            <span>
              {record.user_type === 'all' ? '所有用户' : 
               record.user_type === 'specific' ? `指定用户(${record.user_ids?.length || 0})` : 
               '属性筛选'}
            </span>
          </Space>
          <Space>
            <DesktopOutlined />
            <span>
              {record.asset_type === 'all' ? '所有资产' : 
               record.asset_type === 'specific' ? `指定资产(${record.asset_ids?.length || 0})` : 
               '属性筛选'}
            </span>
          </Space>
          <Space>
            <SafetyOutlined />
            <span>
              {record.account_type === 'all' ? '所有账号' : 
               `指定账号: ${record.account_names || '无'}`}
            </span>
          </Space>
        </Space>
      ),
    },
    {
      title: '命令组',
      dataIndex: 'command_group',
      key: 'command_group',
      render: (commandGroup: CommandGroup) => (
        <Tag color="blue">{commandGroup?.name || '-'}</Tag>
      ),
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color={getActionColor(action)}>
          {getActionText(action)}
        </Tag>
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
      render: (_: any, record: CommandFilter) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个过滤规则吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              loading={deleteLoading === record.id}
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
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增过滤规则
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadFilters}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
        <div style={{ float: 'right' }}>
          <Search
            placeholder="搜索规则名称"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filters}
        loading={loading}
        rowKey="id"
        expandable={{
          expandedRowRender: (record: CommandFilter) => (
            <div style={{ padding: '8px 24px' }}>
              {record.remark && (
                <div style={{ marginBottom: 8 }}>
                  <strong>备注：</strong> {record.remark}
                </div>
              )}
              {record.attributes && record.attributes.length > 0 && (
                <div>
                  <strong>属性筛选条件：</strong>
                  <Space wrap style={{ marginTop: 8 }}>
                    {record.attributes.map((attr) => (
                      <Tag key={attr.id} color="purple">
                        {attr.target_type === 'user' ? '用户' : '资产'} - {attr.name}: {attr.value}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          ),
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 10 });
            loadFilters();
          },
        }}
      />

      {/* 使用向导式组件替代原有的Modal */}
      <FilterRuleWizard
        visible={isModalVisible}
        editingFilter={editingFilter}
        commandGroups={commandGroups}
        users={users}
        assets={assets}
        availableAccounts={availableAccounts}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingFilter(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default CommandFilterManagement;