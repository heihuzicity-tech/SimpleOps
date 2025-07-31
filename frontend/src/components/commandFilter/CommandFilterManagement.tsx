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
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';
import { adaptPaginatedResponse } from '../../services/responseAdapter';
import { getUsers, User } from '../../services/userAPI';
import { getAssets } from '../../services/assetAPI';
import { getCredentials } from '../../services/credentialAPI';

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
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  
  // 数据源
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [selectedAssetKeys, setSelectedAssetKeys] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<FilterAttribute[]>([]);

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
      console.log('用户列表响应:', response.data);
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        console.log('设置用户数据:', response.data.data.items);
        setUsers(response.data.data.items);
      } else {
        console.error('用户API响应格式不符合统一标准:', response.data);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const loadAssets = async () => {
    try {
      const response = await getAssets({ page: 1, page_size: 100 });
      console.log('资产列表响应:', response.data);
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        console.log('设置资产数据:', response.data.data.items);
        setAssets(response.data.data.items);
      } else {
        console.error('资产API响应格式不符合统一标准:', response.data);
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
    }
  };

  const loadCredentials = async () => {
    try {
      const response = await getCredentials({ page: 1, page_size: 100 });
      console.log('凭证列表响应:', response.data);
      
      // 使用统一的响应格式
      if (response.data?.data?.items) {
        const credentialList = response.data.data.items;
        console.log('凭证数据:', credentialList);
        setCredentials(credentialList);
        
        // 提取唯一的账号名称
        const uniqueAccounts = Array.from(new Set(
          credentialList.map((cred: Credential) => cred.username)
        )).filter(Boolean).sort();
        
        console.log('可用账号列表:', uniqueAccounts);
        setAvailableAccounts(uniqueAccounts);
      } else {
        console.error('凭证API响应格式不符合统一标准:', response.data);
      }
    } catch (error) {
      console.error('加载凭证列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingFilter(null);
    setSelectedUserKeys([]);
    setSelectedAssetKeys([]);
    setSelectedAccounts([]);
    setAttributes([]);
    setIsModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      priority: 50,
      enabled: true,
      user_type: 'all',
      asset_type: 'all',
      account_type: 'all',
      action: 'deny',
    });
  };

  const handleEdit = async (filter: CommandFilter) => {
    setEditingFilter(filter);
    
    // 加载详细信息
    try {
      const response = await commandFilterService.filter.getFilter(filter.id);
      if (response.data) {
        const detailFilter = response.data;
        setSelectedUserKeys((detailFilter.users || []).map(id => id.toString()));
        setSelectedAssetKeys((detailFilter.assets || []).map(id => id.toString()));
        setAttributes(detailFilter.attributes || []);
        
        // 设置选中的账号
        if (detailFilter.account_names) {
          const accounts = detailFilter.account_names.split(',').map(s => s.trim()).filter(Boolean);
          setSelectedAccounts(accounts);
        } else {
          setSelectedAccounts([]);
        }
        
        setIsModalVisible(true);
        form.setFieldsValue({
          name: detailFilter.name,
          priority: detailFilter.priority,
          enabled: detailFilter.enabled,
          user_type: detailFilter.user_type,
          asset_type: detailFilter.asset_type,
          account_type: detailFilter.account_type,
          account_names: detailFilter.account_names,
          command_group_id: detailFilter.command_group_id,
          action: detailFilter.action,
          remark: detailFilter.remark,
        });
      }
    } catch (error) {
      console.error('加载过滤规则详情失败:', error);
      message.error('加载过滤规则详情失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await commandFilterService.filter.deleteFilter(id);
      message.success('删除成功');
      loadFilters();
    } catch (error: any) {
      console.error('删除过滤规则失败:', error);
      message.error('删除过滤规则失败');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await commandFilterService.filter.toggleFilter(id);
      message.success('状态切换成功');
      loadFilters();
    } catch (error: any) {
      console.error('切换状态失败:', error);
      message.error('切换状态失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CommandFilterCreateRequest | CommandFilterUpdateRequest = {
        ...values,
        user_ids: values.user_type === 'specific' ? selectedUserKeys.map(key => parseInt(key)) : undefined,
        asset_ids: values.asset_type === 'specific' ? selectedAssetKeys.map(key => parseInt(key)) : undefined,
        attributes: values.user_type === 'attribute' || values.asset_type === 'attribute' ? attributes : undefined,
        // 处理账号选择
        account_names: values.account_type === 'specific' ? selectedAccounts.join(',') : undefined,
      };

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
               record.user_type === 'specific' ? `指定用户(${record.users?.length || 0})` : 
               '属性筛选'}
            </span>
          </Space>
          <Space>
            <DesktopOutlined />
            <span>
              {record.asset_type === 'all' ? '所有资产' : 
               record.asset_type === 'specific' ? `指定资产(${record.assets?.length || 0})` : 
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

  // 资产Transfer数据源
  const assetDataSource: TransferItem[] = assets.map(asset => ({
    key: asset.id.toString(),
    title: asset.name,
    description: `${asset.type} - ${asset.address}:${asset.port}`,
  }));

  // 添加属性
  const handleAddAttribute = () => {
    const newAttribute: FilterAttribute = {
      id: Date.now(),
      filter_id: editingFilter?.id || 0,
      target_type: 'user',
      name: '',
      value: '',
    };
    setAttributes([...attributes, newAttribute]);
  };

  // 删除属性
  const handleRemoveAttribute = (id: number) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  // 更新属性
  const handleUpdateAttribute = (id: number, field: string, value: any) => {
    setAttributes(attributes.map(attr => 
      attr.id === id ? { ...attr, [field]: value } : attr
    ));
  };

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

      {/* 过滤规则编辑模态框 */}
      <Modal
        title={editingFilter ? '编辑过滤规则' : '新增过滤规则'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="规则名称"
            name="name"
            rules={[
              { required: true, message: '请输入规则名称' },
              { max: 100, message: '规则名称最多100个字符' },
            ]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[
              { required: true, message: '请输入优先级' },
              { type: 'number', min: 1, max: 100, message: '优先级范围为1-100' },
            ]}
            extra="数字越小优先级越高"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="启用状态"
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item
            label="用户范围"
            name="user_type"
            rules={[{ required: true, message: '请选择用户范围' }]}
          >
            <Select>
              <Option value="all">所有用户</Option>
              <Option value="specific">指定用户</Option>
              <Option value="attribute">属性筛选</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => {
              const userType = form.getFieldValue('user_type');
              if (userType === 'specific') {
                return (
                  <Form.Item label="选择用户">
                    <Transfer
                      dataSource={userDataSource}
                      titles={['可选用户', '已选用户']}
                      targetKeys={selectedUserKeys}
                      onChange={(targetKeys) => setSelectedUserKeys(targetKeys as string[])}
                      render={item => `${item.title} ${item.description ? `(${item.description})` : ''}`}
                      showSearch
                      filterOption={(inputValue, option) =>
                        option.title?.toLowerCase().includes(inputValue.toLowerCase()) ||
                        option.description?.toLowerCase().includes(inputValue.toLowerCase()) || false
                      }
                      style={{ marginBottom: 16 }}
                      listStyle={{
                        width: 350,
                        height: 250,
                      }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            label="资产范围"
            name="asset_type"
            rules={[{ required: true, message: '请选择资产范围' }]}
          >
            <Select>
              <Option value="all">所有资产</Option>
              <Option value="specific">指定资产</Option>
              <Option value="attribute">属性筛选</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => {
              const assetType = form.getFieldValue('asset_type');
              if (assetType === 'specific') {
                return (
                  <Form.Item label="选择资产">
                    <Transfer
                      dataSource={assetDataSource}
                      titles={['可选资产', '已选资产']}
                      targetKeys={selectedAssetKeys}
                      onChange={(targetKeys) => setSelectedAssetKeys(targetKeys as string[])}
                      render={item => `${item.title} ${item.description ? `(${item.description})` : ''}`}
                      showSearch
                      filterOption={(inputValue, option) =>
                        option.title?.toLowerCase().includes(inputValue.toLowerCase()) ||
                        option.description?.toLowerCase().includes(inputValue.toLowerCase()) || false
                      }
                      style={{ marginBottom: 16 }}
                      listStyle={{
                        width: 350,
                        height: 250,
                      }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => {
              const userType = form.getFieldValue('user_type');
              const assetType = form.getFieldValue('asset_type');
              if (userType === 'attribute' || assetType === 'attribute') {
                return (
                  <Form.Item label="属性筛选条件">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {attributes.map((attr) => (
                        <Space key={attr.id} style={{ width: '100%' }}>
                          <Select
                            value={attr.target_type}
                            onChange={(value) => handleUpdateAttribute(attr.id, 'target_type', value)}
                            style={{ width: 120 }}
                          >
                            <Option value="user">用户属性</Option>
                            <Option value="asset">资产属性</Option>
                          </Select>
                          <Input
                            placeholder="属性名称"
                            value={attr.name}
                            onChange={(e) => handleUpdateAttribute(attr.id, 'name', e.target.value)}
                            style={{ width: 200 }}
                          />
                          <Input
                            placeholder="属性值"
                            value={attr.value}
                            onChange={(e) => handleUpdateAttribute(attr.id, 'value', e.target.value)}
                            style={{ width: 200 }}
                          />
                          <Button
                            type="text"
                            danger
                            onClick={() => handleRemoveAttribute(attr.id)}
                          >
                            删除
                          </Button>
                        </Space>
                      ))}
                      <Button type="dashed" onClick={handleAddAttribute} style={{ width: '100%' }}>
                        添加属性条件
                      </Button>
                    </Space>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            label="账号范围"
            name="account_type"
            rules={[{ required: true, message: '请选择账号范围' }]}
          >
            <Select>
              <Option value="all">所有账号</Option>
              <Option value="specific">指定账号</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => {
              const accountType = form.getFieldValue('account_type');
              if (accountType === 'specific') {
                return (
                  <Form.Item label="选择账号">
                    <Transfer
                      dataSource={availableAccounts.map(account => ({
                        key: account,
                        title: account,
                      }))}
                      titles={['可选账号', '已选账号']}
                      targetKeys={selectedAccounts}
                      onChange={(targetKeys) => setSelectedAccounts(targetKeys as string[])}
                      render={item => item.title}
                      showSearch
                      filterOption={(inputValue, option) =>
                        option.title?.toLowerCase().includes(inputValue.toLowerCase()) || false
                      }
                      style={{ marginBottom: 16 }}
                      listStyle={{
                        width: 350,
                        height: 250,
                      }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            label="关联命令组"
            name="command_group_id"
            rules={[{ required: true, message: '请选择命令组' }]}
          >
            <Select placeholder="请选择命令组">
              {commandGroups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                  {group.is_preset && <Tag color="gold" style={{ marginLeft: 8 }}>预设</Tag>}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="执行动作"
            name="action"
            rules={[{ required: true, message: '请选择执行动作' }]}
          >
            <Select>
              <Option value={FilterAction.DENY}>
                <Tag color="red">拒绝</Tag> - 阻止命令执行
              </Option>
              <Option value={FilterAction.ALLOW}>
                <Tag color="green">允许</Tag> - 允许命令执行
              </Option>
              <Option value={FilterAction.ALERT}>
                <Tag color="orange">告警</Tag> - 记录告警但允许执行
              </Option>
              <Option value={FilterAction.PROMPT_ALERT}>
                <Tag color="gold">提示并告警</Tag> - 提示用户并记录告警
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="备注"
            name="remark"
            rules={[{ max: 500, message: '备注最多500个字符' }]}
          >
            <TextArea
              placeholder="请输入备注信息"
              rows={3}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingFilter ? '更新' : '创建'}
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

export default CommandFilterManagement;