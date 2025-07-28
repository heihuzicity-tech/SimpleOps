import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Tag,
  Popconfirm,
  message,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  Command,
  CommandListRequest,
  CommandCreateRequest,
  CommandUpdateRequest,
  CommandType,
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;

const CommandTable: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    setLoading(true);
    try {
      const params: CommandListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        name: searchKeyword || undefined,
        type: typeFilter || undefined,
      };
      
      const response = await commandFilterService.command.getCommands(params);
      if (response.data) {
        setCommands(response.data.data || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      console.error('加载命令列表失败:', error);
      message.error('加载命令列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCommand(null);
    setIsModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      type: CommandType.EXACT,
    });
  };

  const handleEdit = (command: Command) => {
    setEditingCommand(command);
    setIsModalVisible(true);  
    form.setFieldsValue({
      name: command.name,
      type: command.type,
      description: command.description,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await commandFilterService.command.deleteCommand(id);
      message.success('删除成功');
      loadCommands();
    } catch (error: any) {
      console.error('删除命令失败:', error);
      message.error('删除命令失败');
    }
  };

  const handleSubmit = async (values: CommandCreateRequest | CommandUpdateRequest) => {
    try {
      if (editingCommand) {
        await commandFilterService.command.updateCommand(editingCommand.id, values);
        message.success('更新成功');
      } else {
        await commandFilterService.command.createCommand(values as CommandCreateRequest);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      loadCommands();
    } catch (error: any) {
      console.error('保存命令失败:', error);
      message.error('保存命令失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    loadCommands();
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPagination({ ...pagination, current: 1 });
    loadCommands();
  };

  const validateRegex = (_: any, value: string) => {
    if (!value) return Promise.resolve();
    
    const currentType = form.getFieldValue('type');
    if (currentType === CommandType.REGEX) {
      try {
        new RegExp(value);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(new Error('请输入有效的正则表达式'));
      }
    }
    return Promise.resolve();
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '命令名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Command) => (
        <span>
          <code style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '2px 6px', 
            borderRadius: '3px',
            fontFamily: 'Monaco, Consolas, monospace',
          }}>
            {text}
          </code>
          {record.type === CommandType.REGEX && (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              正则
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '匹配类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === CommandType.EXACT ? 'blue' : 'orange'}>
          {type === CommandType.EXACT ? '精确匹配' : '正则表达式'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
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
      render: (_: any, record: Command) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个命令吗？"
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
      <Alert
        message="命令配置说明"
        description="支持精确匹配和正则表达式匹配。精确匹配会匹配命令的主体部分（不包含参数），正则表达式可以匹配完整的命令行。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增命令
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCommands}
          >
            刷新
          </Button>
          <Select
            placeholder="匹配类型"
            allowClear
            style={{ width: 120 }}
            onChange={handleTypeFilterChange}
          >
            <Option value={CommandType.EXACT}>精确匹配</Option>
            <Option value={CommandType.REGEX}>正则表达式</Option>
          </Select>
        </Space>
        <div style={{ float: 'right' }}>
          <Search
            placeholder="搜索命令名称"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={commands}
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
            loadCommands();
          },
        }}
      />

      {/* 命令编辑模态框 */}
      <Modal
        title={editingCommand ? '编辑命令' : '新增命令'}
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
            label="命令名称"
            name="name"
            rules={[
              { required: true, message: '请输入命令名称' },
              { max: 100, message: '命令名称最多100个字符' },
              { validator: validateRegex },
            ]}
          >
            <Input 
              placeholder="例如: rm 或 rm.*-rf.*"
              style={{ fontFamily: 'Monaco, Consolas, monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="匹配类型"
            name="type"
            rules={[{ required: true, message: '请选择匹配类型' }]}
          >
            <Select placeholder="请选择匹配类型">
              <Option value={CommandType.EXACT}>
                精确匹配 - 匹配命令主体（不含参数）
              </Option>
              <Option value={CommandType.REGEX}>
                正则表达式 - 匹配完整命令行
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: '描述最多500个字符' }]}
          >
            <TextArea
              placeholder="请输入命令描述，例如：删除文件或目录"
              rows={3}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCommand ? '更新' : '创建'}
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

export default CommandTable;