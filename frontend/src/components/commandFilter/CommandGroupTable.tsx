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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  GroupOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  CommandGroup,
  Command,
  CommandGroupListRequest,
  CommandGroupCreateRequest,
  CommandGroupUpdateRequest,
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';

const { Search } = Input;
const { TextArea } = Input;

interface TransferItem {
  key: string;
  title: string;
  description?: string;
  type?: string;
}

const CommandGroupTable: React.FC = () => {
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CommandGroup | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  
  // 命令数据
  const [commands, setCommands] = useState<Command[]>([]);
  const [selectedCommandKeys, setSelectedCommandKeys] = useState<string[]>([]);

  useEffect(() => {
    loadCommandGroups();
    loadCommands();
  }, []);

  const loadCommandGroups = async () => {
    setLoading(true);
    try {
      const params: CommandGroupListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        name: searchKeyword || undefined,
      };
      
      const response = await commandFilterService.commandGroup.getCommandGroups(params);
      if (response.data) {
        setCommandGroups(response.data.data || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      console.error('加载命令组列表失败:', error);
      message.error('加载命令组列表失败');
    } finally {
      setLoading(false);
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

  const handleAdd = () => {
    setEditingGroup(null);
    setSelectedCommandKeys([]);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (group: CommandGroup) => {
    setEditingGroup(group);
    setSelectedCommandKeys((group.commands || []).map(cmd => cmd.id.toString()));
    setIsModalVisible(true);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await commandFilterService.commandGroup.deleteCommandGroup(id);
      message.success('删除成功');
      loadCommandGroups();
    } catch (error: any) {
      console.error('删除命令组失败:', error);
      message.error('删除命令组失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        command_ids: selectedCommandKeys.map(key => parseInt(key)),
      };

      if (editingGroup) {
        await commandFilterService.commandGroup.updateCommandGroup(editingGroup.id, data);
        message.success('更新成功');
      } else {
        await commandFilterService.commandGroup.createCommandGroup(data);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      loadCommandGroups();
    } catch (error: any) {
      console.error('保存命令组失败:', error);
      message.error('保存命令组失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    loadCommandGroups();
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '命令组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: CommandGroup) => (
        <Space>
          <GroupOutlined />
          {text}
          {record.is_preset && (
            <Tooltip title="系统预设命令组，不可删除">
              <Tag color="gold" icon={<LockOutlined />}>
                预设
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '命令数量',
      dataIndex: 'command_count',
      key: 'command_count',
      render: (count: number = 0, record: CommandGroup) => (
        <Badge 
          count={count} 
          color={record.is_preset ? 'gold' : 'blue'}
          showZero
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'is_preset',
      key: 'is_preset',
      render: (isPreset: boolean) => (
        <Tag color={isPreset ? 'gold' : 'blue'}>
          {isPreset ? '系统预设' : '自定义'}
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
      render: (_: any, record: CommandGroup) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {!record.is_preset && (
            <Popconfirm
              title="确定要删除这个命令组吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
          {record.is_preset && (
            <Tooltip title="系统预设命令组不能删除">
              <Button type="text" disabled icon={<DeleteOutlined />}>
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 命令Transfer数据源
  const commandDataSource: TransferItem[] = commands.map(cmd => ({
    key: cmd.id.toString(),
    title: cmd.name,
    description: cmd.description,
    type: cmd.type === 'exact' ? '精确匹配' : '正则表达式',
  }));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增命令组
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCommandGroups}
          >
            刷新
          </Button>
        </Space>
        <div style={{ float: 'right' }}>
          <Search
            placeholder="搜索命令组名称"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={commandGroups}
        loading={loading}
        rowKey="id"
        expandable={{
          expandedRowRender: (record: CommandGroup) => (
            <div style={{ padding: '8px 24px' }}>
              <h4>包含的命令：</h4>
              <Space wrap>
                {(record.commands || []).map((cmd) => (
                  <Tag 
                    key={cmd.id}
                    color={cmd.type === 'exact' ? 'blue' : 'orange'}
                  >
                    <code>{cmd.name}</code>
                    <span style={{ marginLeft: 4 }}>
                      ({cmd.type === 'exact' ? '精确' : '正则'})
                    </span>
                  </Tag>
                ))}
                {(!record.commands || record.commands.length === 0) && (
                  <span style={{ color: '#999' }}>暂无命令</span>
                )}
              </Space>
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
            loadCommandGroups();
          },
        }}
      />

      {/* 命令组编辑模态框 */}
      <Modal
        title={editingGroup ? '编辑命令组' : '新增命令组'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="命令组名称"
            name="name"
            rules={[
              { required: true, message: '请输入命令组名称' },
              { max: 100, message: '命令组名称最多100个字符' },
            ]}
          >
            <Input placeholder="请输入命令组名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: '描述最多500个字符' }]}
          >
            <TextArea
              placeholder="请输入命令组描述"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="选择命令"
            required
          >
            <Transfer
              dataSource={commandDataSource}
              titles={['可选命令', '已选命令']}
              targetKeys={selectedCommandKeys}
              onChange={(targetKeys) => setSelectedCommandKeys(targetKeys as string[])}
              render={item => (
                <span>
                  <Tag color={item.type === '精确匹配' ? 'blue' : 'orange'}>
                    {item.type}
                  </Tag>
                  <code>{item.title}</code>
                  {item.description && (
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      ({item.description})
                    </span>
                  )}
                </span>
              )}
              showSearch
              style={{ width: '100%' }}
              listStyle={{
                width: 350,
                height: 300,
              }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingGroup ? '更新' : '创建'}
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

export default CommandGroupTable;