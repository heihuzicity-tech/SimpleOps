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
  Empty,
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
import { 
  CommandGroup, 
  CommandGroupItem, 
  CommandGroupListRequest, 
  CommandGroupCreateRequest, 
  CommandGroupUpdateRequest,
  CommandGroupResponse 
} from '../../types';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;


const CommandGroupManagement: React.FC = () => {
  const [commandGroups, setCommandGroups] = useState<CommandGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CommandGroup | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteItemLoading, setDeleteItemLoading] = useState<number | null>(null);
  
  // 命令项表单数据
  const [commandItems, setCommandItems] = useState<CommandGroupItem[]>([]);
  const [commandType, setCommandType] = useState<'command' | 'regex'>('command');
  const [commandContent, setCommandContent] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [addCommandLoading, setAddCommandLoading] = useState(false);

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
        // 清空选中项
        setSelectedRowKeys([]);
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

  const handleEdit = async (group: CommandGroup) => {
    setEditLoading(true);
    try {
      // 获取命令组详情，确保包含完整的 items 数据
      const response = await commandFilterService.commandGroup.getCommandGroupDetail(group.id);
      if (response.data) {
        const detailedGroup = response.data;
        setEditingGroup(detailedGroup);
        setCommandItems(detailedGroup.items || []);
        setIsModalVisible(true);
        form.setFieldsValue({
          name: detailedGroup.name,
          remark: detailedGroup.remark,
        });
        setCommandType('command');
        setCommandContent('');
        setIgnoreCase(false);
      }
    } catch (error: any) {
      console.error('获取命令组详情失败:', error);
      message.error('获取命令组详情失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteItemLoading(id);
    try {
      await commandFilterService.commandGroup.deleteCommandGroup(id);
      message.success('删除成功');
      loadCommandGroups();
    } catch (error: any) {
      console.error('删除命令组失败:', error);
      message.error('删除命令组失败');
    } finally {
      setDeleteItemLoading(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的命令组');
      return;
    }

    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个命令组吗？此操作不可恢复。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeleteLoading(true);
        try {
          // 逐个删除选中的命令组
          const deletePromises = selectedRowKeys.map(id => 
            commandFilterService.commandGroup.deleteCommandGroup(id)
          );
          await Promise.all(deletePromises);
          
          message.success(`成功删除 ${selectedRowKeys.length} 个命令组`);
          setSelectedRowKeys([]);
          loadCommandGroups();
        } catch (error: any) {
          console.error('批量删除命令组失败:', error);
          message.error('批量删除命令组失败');
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (commandItems.length === 0) {
      message.error('请至少添加一个命令或正则表达式');
      return;
    }

    setSubmitLoading(true);
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

  const handleAddCommand = () => {
    const lines = commandContent.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      message.error('请输入命令内容');
      return;
    }

    setAddCommandLoading(true);
    // 模拟异步操作，实际上是同步的，但为了用户体验添加短暂延迟
    setTimeout(() => {
      const newItems: CommandGroupItem[] = lines.map(content => ({
        type: commandType,
        content: content.trim(),
        ignore_case: ignoreCase,
      }));

      setCommandItems([...commandItems, ...newItems]);
      setCommandContent('');
      message.success(`已添加 ${newItems.length} 个${commandType === 'command' ? '命令' : '正则表达式'}`);
      setAddCommandLoading(false);
    }, 300);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...commandItems];
    newItems.splice(index, 1);
    setCommandItems(newItems);
    message.success('已移除');
  };

  const columns = [
    {
      title: '命令组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: CommandGroup) => (
        <Space>
          <GroupOutlined />
          <span style={{ fontWeight: 500 }}>{text}</span>
          <Badge 
            count={record.items?.length || 0} 
            color="blue"
            showZero
            style={{ marginLeft: 8 }}
          />
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '描述',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: CommandGroup) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            loading={editLoading}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个命令组吗？"
            description="删除后将无法恢复，所有引用此命令组的过滤规则也将受到影响。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定删除"
            okType="danger"
            cancelText="取消"
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              loading={deleteItemLoading === record.id}
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
            新增命令组
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              loading={deleteLoading}
            >
              批量删除 ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadCommandGroups();
              message.success('刷新成功');
            }}
            loading={loading}
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
        rowSelection={{
          selectedRowKeys,
          onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys as number[]);
          },
          getCheckboxProps: (record: CommandGroup) => ({
            disabled: record.is_preset, // 预设命令组不能删除
          }),
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  暂无命令组数据
                  {!searchKeyword && (
                    <>
                      <br />
                      <span style={{ color: '#999' }}>
                        点击"新增命令组"按钮创建第一个命令组
                      </span>
                    </>
                  )}
                </span>
              }
            >
              {!searchKeyword && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  新增命令组
                </Button>
              )}
            </Empty>
          ),
        }}
        expandable={{
          expandedRowRender: (record: CommandGroup) => (
            <div style={{ padding: '16px 48px', backgroundColor: '#fafafa', borderRadius: 4 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 500, color: '#666' }}>包含的命令/正则表达式：</span>
                <span style={{ marginLeft: 8, color: '#999' }}>
                  共 {record.items?.length || 0} 项
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                {(record.items || []).length > 0 ? (
                  <Space wrap size={[8, 8]}>
                    {(record.items || []).map((item, index) => (
                      <Tag 
                        key={index}
                        color={item.type === 'command' ? 'blue' : 'orange'}
                        icon={item.type === 'command' ? <CodeOutlined /> : <RegexIcon />}
                        style={{ margin: 0 }}
                      >
                        <code style={{ fontSize: 13 }}>{item.content}</code>
                        {item.ignore_case && (
                          <Tooltip title="忽略大小写">
                            <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>(i)</span>
                          </Tooltip>
                        )}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <div style={{ color: '#999', fontStyle: 'italic' }}>
                    暂无命令或正则表达式
                  </div>
                )}
              </div>
            </div>
          ),
          rowExpandable: (record) => true,
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
                  { pattern: /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/, message: '命令组名称只能包含中文、字母、数字、下划线和横线' },
                ]}
                validateTrigger={['onChange', 'onBlur']}
                hasFeedback
              >
                <Input 
                  placeholder="请输入命令组名称，如：危险命令组、系统维护命令" 
                  onBlur={() => form.validateFields(['name'])}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="描述"
                name="remark"
                rules={[
                  { max: 500, message: '描述最多500个字符' },
                  { whitespace: true, message: '描述不能为纯空格' },
                ]}
                validateTrigger={['onBlur']}
                hasFeedback
              >
                <TextArea 
                  placeholder="请输入命令组的描述信息" 
                  rows={2}
                  showCount
                  maxLength={500}
                  onBlur={() => form.validateFields(['remark'])}
                />
              </Form.Item>
            </Col>
          </Row>

          <Card 
            title={
              <span>
                <PlusOutlined style={{ marginRight: 8 }} />
                添加命令或正则表达式
              </span>
            } 
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <span style={{ color: '#999', fontSize: 12 }}>
                  支持批量添加，每行一个
                </span>
              </Space>
            }
          >
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Select
                  value={commandType}
                  onChange={setCommandType}
                  style={{ width: '100%' }}
                  size="large"
                >
                  <Option value="command">
                    <Space>
                      <CodeOutlined />
                      <span>命令</span>
                    </Space>
                  </Option>
                  <Option value="regex">
                    <Space>
                      <RegexIcon />
                      <span>正则表达式</span>
                    </Space>
                  </Option>
                </Select>
              </Col>
              <Col span={6}>
                <Checkbox
                  checked={ignoreCase}
                  onChange={(e) => setIgnoreCase(e.target.checked)}
                  style={{ marginTop: 8 }}
                >
                  忽略大小写
                </Checkbox>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Button 
                  type="primary" 
                  onClick={handleAddCommand}
                  disabled={!commandContent.trim()}
                  icon={<PlusOutlined />}
                  loading={addCommandLoading}
                >
                  添加到命令组
                </Button>
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <TextArea
                value={commandContent}
                onChange={(e) => {
                  const value = e.target.value;
                  setCommandContent(value);
                  
                  // 实时验证正则表达式
                  if (commandType === 'regex' && value.trim()) {
                    const lines = value.trim().split('\n').filter(line => line.trim());
                    const invalidRegex = lines.find(line => {
                      try {
                        new RegExp(line.trim());
                        return false;
                      } catch {
                        return true;
                      }
                    });
                    
                    if (invalidRegex) {
                      message.warning(`正则表达式语法错误：${invalidRegex}`);
                    }
                  }
                }}
                placeholder={commandType === 'command' 
                  ? "请输入命令，每行一个，例如：\nrm -rf\nreboot\nshutdown\nkill -9" 
                  : "请输入正则表达式，每行一个，例如：\n^rm\\s+-rf\n.*password.*\n^sudo\\s+.*"}
                rows={5}
                style={{ fontFamily: 'monospace' }}
              />
              {commandContent.trim() && (
                <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                  将添加 {commandContent.trim().split('\n').filter(line => line.trim()).length} 个{commandType === 'command' ? '命令' : '正则表达式'}
                </div>
              )}
            </div>
          </Card>

          <Card 
            title={
              <Space>
                <span>已添加的命令/正则表达式</span>
                <Badge count={commandItems.length} showZero color="blue" />
              </Space>
            }
            style={{ marginBottom: 16 }}
            extra={
              commandItems.length > 0 && (
                <Popconfirm
                  title="确定要清空所有已添加的项吗？"
                  description="此操作不可恢复，您需要重新添加命令或正则表达式。"
                  okText="确定清空"
                  okType="danger"
                  cancelText="取消"
                  onConfirm={() => {
                    setCommandItems([]);
                    message.success('已清空所有项');
                  }}
                >
                  <Button type="link" size="small" danger>
                    清空全部
                  </Button>
                </Popconfirm>
              )
            }
          >
            {commandItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂未添加任何命令或正则表达式"
              />
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <Space wrap size={[8, 8]}>
                  {commandItems.map((item, index) => (
                    <Tag
                      key={index}
                      closable
                      onClose={() => handleRemoveItem(index)}
                      color={item.type === 'command' ? 'blue' : 'orange'}
                      style={{ 
                        margin: 0,
                        padding: '4px 8px',
                        fontSize: 13,
                        lineHeight: '20px'
                      }}
                    >
                      <Space size={4}>
                        {item.type === 'command' ? <CodeOutlined /> : <RegexIcon />}
                        <code style={{ fontWeight: 500 }}>{item.content}</code>
                        {item.ignore_case && (
                          <Tooltip title="忽略大小写">
                            <span style={{ fontSize: 11, opacity: 0.7 }}>(i)</span>
                          </Tooltip>
                        )}
                      </Space>
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Card>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={submitLoading}
              >
                {editingGroup ? '更新' : '创建'}
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

// 正则表达式图标组件
const RegexIcon: React.FC = () => (
  <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>.*</span>
);

export default CommandGroupManagement;