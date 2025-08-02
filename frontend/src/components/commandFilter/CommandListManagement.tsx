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
  Tooltip,
  Select,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  CodeOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import { commandFilterService } from '../../services/commandFilterService';
import { adaptPaginatedResponse } from '../../services/responseAdapter';
import { 
  Command,
  CommandListRequest,
  CommandCreateRequest,
  CommandUpdateRequest,
} from '../../types';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;

const CommandListManagement: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  useEffect(() => {
    loadCommands();
  }, [pagination.current, pagination.pageSize, searchKeyword]);

  const loadCommands = async () => {
    setLoading(true);
    try {
      const params: CommandListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        name: searchKeyword || undefined,
      };
      
      const response = await commandFilterService.command.getCommands(params);
      if (response.data) {
        const adaptedData = adaptPaginatedResponse<Command>(response);
        setCommands(adaptedData.items);
        setTotal(adaptedData.total);
      }
    } catch (error: any) {
      console.error('加载命令列表失败:', error);
      message.error(error?.response?.data?.message || '加载命令列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCommand(null);
    setIsModalVisible(true);
    form.resetFields();
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
    setDeleteLoading(id);
    try {
      await commandFilterService.command.deleteCommand(id);
      message.success('删除成功');
      loadCommands();
    } catch (error: any) {
      console.error('删除命令失败:', error);
      message.error(error?.response?.data?.message || '删除命令失败');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true);
    try {
      if (editingCommand) {
        const updateData: CommandUpdateRequest = {
          name: values.name,
          type: values.type,
          description: values.description,
        };
        await commandFilterService.command.updateCommand(editingCommand.id, updateData);
        message.success('更新成功');
      } else {
        const createData: CommandCreateRequest = {
          name: values.name,
          type: values.type,
          description: values.description,
        };
        await commandFilterService.command.createCommand(createData);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      loadCommands();
    } catch (error: any) {
      console.error('保存命令失败:', error);
      message.error(error?.response?.data?.message || '保存命令失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination({ ...pagination, current: 1 });
    if (value) {
      message.info(`正在搜索: ${value}`);
    }
  };

  const columns = [
    {
      title: '命令名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <CodeOutlined />
          <code>{text}</code>
        </Space>
      ),
    },
    {
      title: '命令类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const labelMap: { [key: string]: string } = {
          'exact': '精确匹配',
          'regex': '正则匹配',
        };
        const colorMap: { [key: string]: string } = {
          'exact': 'blue',
          'regex': 'orange',
        };
        return (
          <Tag color={colorMap[type] || 'default'}>
            {labelMap[type] || type}
          </Tag>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
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
            description="删除后将无法恢复，所有引用此命令的命令组也将受到影响。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定删除"
            okType="danger"
            cancelText="取消"
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
            新增命令
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadCommands();
              message.success('刷新成功');
            }}
            loading={loading}
          >
            刷新
          </Button>
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
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  暂无命令数据
                  {!searchKeyword && (
                    <>
                      <br />
                      <span style={{ color: '#999' }}>
                        点击"新增命令"按钮创建第一个命令
                      </span>
                    </>
                  )}
                </span>
              }
            >
              {!searchKeyword && (
                <Button
                  type="primary"
                  icon={<FileAddOutlined />}
                  onClick={handleAdd}
                >
                  新增命令
                </Button>
              )}
            </Empty>
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
              { pattern: /^[a-zA-Z0-9_\-./\\*]+$/, message: '命令名称只能包含字母、数字、下划线、横线、斜杠、点号和星号' },
            ]}
            validateTrigger={['onChange', 'onBlur']}
            hasFeedback
          >
            <Input 
              placeholder="请输入命令名称，如: ls, rm -rf, git *" 
              onBlur={() => form.validateFields(['name'])}
            />
          </Form.Item>

          <Form.Item
            label="命令类型"
            name="type"
            rules={[{ required: true, message: '请选择命令类型' }]}
          >
            <Select placeholder="请选择命令类型">
              <Option value="exact">精确匹配</Option>
              <Option value="regex">正则匹配</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[
              { max: 500, message: '描述最多500个字符' },
              { whitespace: true, message: '描述不能为纯空格' },
            ]}
            validateTrigger={['onBlur']}
            hasFeedback
          >
            <TextArea 
              rows={4} 
              placeholder="请输入描述信息（可选）"
              showCount
              maxLength={500}
              onBlur={() => form.validateFields(['description'])}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={submitLoading}
              >
                {editingCommand ? '更新' : '创建'}
              </Button>
              <Button 
                onClick={() => setIsModalVisible(false)}
                disabled={submitLoading}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CommandListManagement;