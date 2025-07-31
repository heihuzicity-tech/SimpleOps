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
  Badge,
  Tooltip,
  Select,
  Checkbox,
  InputNumber,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  GroupOutlined,
  CodeOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { commandFilterService } from '../../services/commandFilterService';
import { adaptPaginatedResponse } from '../../services/responseAdapter';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;

// TypeScript接口定义
interface CommandGroup {
  id: number;
  name: string;
  remark?: string;
  items: CommandGroupItem[];
  created_at: string;
  updated_at: string;
}

interface CommandGroupItem {
  id?: number;
  command_group_id?: number;
  type: 'command' | 'regex';
  content: string;
  ignore_case: boolean;
  sort_order?: number;
}

interface CommandGroupListRequest {
  page?: number;
  page_size?: number;
  name?: string;
}

interface CommandGroupCreateRequest {
  name: string;
  remark?: string;
  items: CommandGroupItem[];
}

interface CommandGroupUpdateRequest {
  name?: string;
  remark?: string;
  items?: CommandGroupItem[];
}

const CommandGroupManagement: React.FC = () => {
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CommandGroup | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  
  // 命令项表单数据
  const [commandItems, setCommandItems] = useState<CommandGroupItem[]>([]);
  const [commandType, setCommandType] = useState<'command' | 'regex'>('command');
  const [commandContent, setCommandContent] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);

  useEffect(() => {
    loadCommandGroups();
  }, [pagination.current, pagination.pageSize, searchKeyword]);

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
        const adaptedData = adaptPaginatedResponse<CommandGroup>(response);
        setCommandGroups(adaptedData.items);
        setTotal(adaptedData.total);
      }
    } catch (error: any) {
      console.error('加载命令组列表失败:', error);
      message.error('加载命令组列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingGroup(null);
    setCommandItems([]);
    setIsModalVisible(true);
    form.resetFields();
    setCommandType('command');
    setCommandContent('');
    setIgnoreCase(false);
  };

  const handleEdit = (group: CommandGroup) => {
    setEditingGroup(group);
    setCommandItems(group.items || []);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: group.name,
      remark: group.remark,
    });
    setCommandType('command');
    setCommandContent('');
    setIgnoreCase(false);
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
    if (commandItems.length === 0) {
      message.error('请至少添加一个命令或正则表达式');
      return;
    }

    try {
      if (editingGroup) {
        const updateData: CommandGroupUpdateRequest = {
          ...values,
          items: commandItems.map((item, index) => ({
            ...item,
            sort_order: index,
          })),
        };
        await commandFilterService.commandGroup.updateCommandGroup(editingGroup.id, updateData);
        message.success('更新成功');
      } else {
        const createData: CommandGroupCreateRequest = {
          ...values,
          items: commandItems.map((item, index) => ({
            ...item,
            sort_order: index,
          })),
        };
        await commandFilterService.commandGroup.createCommandGroup(createData);
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
  };

  const handleAddCommand = () => {
    const lines = commandContent.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      message.error('请输入命令内容');
      return;
    }

    const newItems: CommandGroupItem[] = lines.map(content => ({
      type: commandType,
      content: content.trim(),
      ignore_case: ignoreCase,
    }));

    setCommandItems([...commandItems, ...newItems]);
    setCommandContent('');
    message.success(`已添加 ${newItems.length} 个${commandType === 'command' ? '命令' : '正则表达式'}`);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...commandItems];
    newItems.splice(index, 1);
    setCommandItems(newItems);
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
      render: (text: string) => (
        <Space>
          <GroupOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '命令数量',
      key: 'command_count',
      render: (_: any, record: CommandGroup) => (
        <Badge 
          count={record.items?.length || 0} 
          color="blue"
          showZero
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
      render: (_: any, record: CommandGroup) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个命令组吗？"
            description="删除后将无法恢复"
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
              <h4>包含的命令/正则表达式：</h4>
              <Space wrap>
                {(record.items || []).map((item, index) => (
                  <Tag 
                    key={index}
                    color={item.type === 'command' ? 'blue' : 'orange'}
                    icon={item.type === 'command' ? <CodeOutlined /> : <RegexIcon />}
                  >
                    <code>{item.content}</code>
                    {item.ignore_case && (
                      <Tooltip title="忽略大小写">
                        <span style={{ marginLeft: 4 }}>(i)</span>
                      </Tooltip>
                    )}
                  </Tag>
                ))}
                {(!record.items || record.items.length === 0) && (
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
          },
        }}
      />

      {/* 命令组编辑模态框 */}
      <Modal
        title={editingGroup ? '编辑命令组' : '新增命令组'}
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
          <Row gutter={16}>
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item
                label="备注"
                name="remark"
                rules={[{ max: 500, message: '备注最多500个字符' }]}
              >
                <Input placeholder="请输入备注信息" />
              </Form.Item>
            </Col>
          </Row>

          <Card title="添加命令或正则表达式" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label="类型">
                  <Select
                    value={commandType}
                    onChange={setCommandType}
                    style={{ width: '100%' }}
                  >
                    <Option value="command">
                      <CodeOutlined /> 命令
                    </Option>
                    <Option value="regex">
                      <RegexIcon /> 正则表达式
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="忽略大小写">
                  <Checkbox
                    checked={ignoreCase}
                    onChange={(e) => setIgnoreCase(e.target.checked)}
                  >
                    忽略大小写
                  </Checkbox>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label={
                <span>
                  内容（每行一个）
                  <Tooltip title={commandType === 'command' ? '每行输入一个命令' : '每行输入一个正则表达式'}>
                    <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                  </Tooltip>
                </span>
              }
            >
              <TextArea
                value={commandContent}
                onChange={(e) => setCommandContent(e.target.value)}
                placeholder={commandType === 'command' 
                  ? "请输入命令，每行一个，例如：\nrm\nreboot\nshutdown" 
                  : "请输入正则表达式，每行一个，例如：\n^rm\\s+-rf\n.*password.*"}
                rows={4}
              />
            </Form.Item>
            <Button type="primary" onClick={handleAddCommand}>
              添加到命令组
            </Button>
          </Card>

          <Card title="已添加的命令/正则表达式" style={{ marginBottom: 16 }}>
            {commandItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                暂未添加任何命令或正则表达式
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {commandItems.map((item, index) => (
                  <Tag
                    key={index}
                    closable
                    onClose={() => handleRemoveItem(index)}
                    color={item.type === 'command' ? 'blue' : 'orange'}
                    style={{ margin: '4px' }}
                  >
                    <Space>
                      {item.type === 'command' ? <CodeOutlined /> : <RegexIcon />}
                      <code>{item.content}</code>
                      {item.ignore_case && <span>(忽略大小写)</span>}
                    </Space>
                  </Tag>
                ))}
              </Space>
            )}
          </Card>

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

// 正则表达式图标组件
const RegexIcon: React.FC = () => (
  <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>.*</span>
);

export default CommandGroupManagement;