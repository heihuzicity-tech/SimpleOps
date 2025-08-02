import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Transfer,
  Button,
  Space,
  Card,
  Tag,
  message,
  Typography,
  Divider,
  Alert,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  InfoCircleOutlined,
  UserOutlined,
  DesktopOutlined,
  SafetyOutlined,
  FilterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  CommandFilter,
  CommandGroup,
  Asset,
  User,
  CommandFilterCreateRequest,
  CommandFilterUpdateRequest,
  FilterAttribute,
  FilterAction,
} from '../../types';

const { Step } = Steps;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface TransferItem {
  key: string;
  title: string;
  description?: string;
}

interface FilterRuleWizardProps {
  visible: boolean;
  editingFilter: CommandFilter | null;
  commandGroups: CommandGroup[];
  users: User[];
  assets: Asset[];
  availableAccounts: string[];
  onCancel: () => void;
  onSubmit: (data: CommandFilterCreateRequest | CommandFilterUpdateRequest) => Promise<void>;
}

const FilterRuleWizard: React.FC<FilterRuleWizardProps> = ({
  visible,
  editingFilter,
  commandGroups,
  users,
  assets,
  availableAccounts,
  onCancel,
  onSubmit,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  // 选中的数据
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [selectedAssetKeys, setSelectedAssetKeys] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<FilterAttribute[]>([]);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      if (editingFilter) {
        // 编辑模式：加载现有数据
        form.setFieldsValue({
          name: editingFilter.name,
          priority: editingFilter.priority,
          enabled: editingFilter.enabled,
          user_type: editingFilter.user_type,
          asset_type: editingFilter.asset_type,
          account_type: editingFilter.account_type,
          command_group_id: editingFilter.command_group_id,
          action: editingFilter.action,
          remark: editingFilter.remark,
        });
        setSelectedUserKeys((editingFilter.user_ids || []).map(id => id.toString()));
        setSelectedAssetKeys((editingFilter.asset_ids || []).map(id => id.toString()));
        setAttributes(editingFilter.attributes || []);
        if (editingFilter.account_names) {
          const accounts = editingFilter.account_names.split(',').map(s => s.trim()).filter(Boolean);
          setSelectedAccounts(accounts);
        }
      } else {
        // 新建模式：设置默认值
        form.resetFields();
        form.setFieldsValue({
          priority: 50,
          enabled: true,
          user_type: 'all',
          asset_type: 'all',
          account_type: 'all',
          action: 'deny',
        });
        setSelectedUserKeys([]);
        setSelectedAssetKeys([]);
        setSelectedAccounts([]);
        setAttributes([]);
      }
    }
  }, [visible, editingFilter, form]);

  // 步骤配置
  const steps = [
    {
      title: '基本信息',
      icon: <InfoCircleOutlined />,
      description: '设置规则名称和优先级',
    },
    {
      title: '关联命令/命令组',
      icon: <FilterOutlined />,
      description: '选择要过滤的命令',
    },
    {
      title: '关联用户/用户组',
      icon: <UserOutlined />,
      description: '选择应用的用户范围',
    },
    {
      title: '关联资源',
      icon: <DesktopOutlined />,
      description: '选择应用的资源范围',
    },
    {
      title: '确认配置',
      icon: <CheckCircleOutlined />,
      description: '检查并提交配置',
    },
  ];

  // 下一步
  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['name', 'priority', 'enabled']);
      } else if (currentStep === 1) {
        await form.validateFields(['command_group_id', 'action']);
      } else if (currentStep === 2) {
        await form.validateFields(['user_type']);
      } else if (currentStep === 3) {
        await form.validateFields(['asset_type', 'account_type']);
      }
      setCurrentStep(currentStep + 1);
    } catch (error) {
      // 表单验证失败
    }
  };

  // 上一步
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  // 提交
  const handleFinish = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const data: CommandFilterCreateRequest | CommandFilterUpdateRequest = {
        ...values,
        user_ids: values.user_type === 'specific' ? selectedUserKeys.map(key => parseInt(key)) : undefined,
        asset_ids: values.asset_type === 'specific' ? selectedAssetKeys.map(key => parseInt(key)) : undefined,
        attributes: values.user_type === 'attribute' || values.asset_type === 'attribute' ? attributes : undefined,
        account_names: values.account_type === 'specific' ? selectedAccounts.join(',') : undefined,
      };

      await onSubmit(data);
      onCancel(); // 关闭弹窗
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transfer数据源
  const userDataSource: TransferItem[] = users.map(user => ({
    key: user.id.toString(),
    title: user.username,
    description: user.email,
  }));

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
    message.success('已删除属性');
  };

  // 更新属性
  const handleUpdateAttribute = (id: number, field: string, value: any) => {
    setAttributes(attributes.map(attr => 
      attr.id === id ? { ...attr, [field]: value } : attr
    ));
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // 基本信息
        return (
          <Card>
            <Form.Item
              label="规则名称"
              name="name"
              rules={[
                { required: true, message: '请输入规则名称' },
                { max: 100, message: '规则名称最多100个字符' },
              ]}
            >
              <Input placeholder="请输入规则名称，例如：禁止删除文件" size="large" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="优先级"
                  name="priority"
                  rules={[
                    { required: true, message: '请输入优先级' },
                    { type: 'number', min: 1, max: 100, message: '优先级范围为1-100' },
                  ]}
                  extra="数字越小优先级越高"
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="启用状态"
                  name="enabled"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Alert
              message="提示"
              description="优先级决定了规则的执行顺序，当多个规则都匹配时，优先级高的规则将被执行。"
              type="info"
              showIcon
            />
          </Card>
        );

      case 1: // 关联命令/命令组
        return (
          <Card>
            <Form.Item
              label="选择命令组"
              name="command_group_id"
              rules={[{ required: true, message: '请选择命令组' }]}
            >
              <Select placeholder="请选择要过滤的命令组" size="large">
                {commandGroups.map(group => (
                  <Option key={group.id} value={group.id}>
                    <Space>
                      {group.name}
                      {group.is_preset && <Tag color="gold">预设</Tag>}
                      <Text type="secondary">({group.items?.length || 0} 个命令)</Text>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="执行动作"
              name="action"
              rules={[{ required: true, message: '请选择执行动作' }]}
            >
              <Select placeholder="选择匹配后的执行动作" size="large">
                <Option value={FilterAction.DENY}>
                  <Space>
                    <Tag color="red">拒绝</Tag>
                    <span>阻止命令执行</span>
                  </Space>
                </Option>
                <Option value={FilterAction.ALLOW}>
                  <Space>
                    <Tag color="green">允许</Tag>
                    <span>允许命令执行</span>
                  </Space>
                </Option>
                <Option value={FilterAction.ALERT}>
                  <Space>
                    <Tag color="orange">告警</Tag>
                    <span>记录告警但允许执行</span>
                  </Space>
                </Option>
                <Option value={FilterAction.PROMPT_ALERT}>
                  <Space>
                    <Tag color="gold">提示并告警</Tag>
                    <span>提示用户并记录告警</span>
                  </Space>
                </Option>
              </Select>
            </Form.Item>

            <Alert
              message="说明"
              description="选择的命令组中的所有命令都将应用此过滤规则。"
              type="info"
              showIcon
            />
          </Card>
        );

      case 2: // 关联用户/用户组
        return (
          <Card>
            <Form.Item
              label="用户范围"
              name="user_type"
              rules={[{ required: true, message: '请选择用户范围' }]}
            >
              <Select size="large">
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
                        listStyle={{
                          width: 350,
                          height: 300,
                        }}
                      />
                    </Form.Item>
                  );
                } else if (userType === 'attribute') {
                  return (
                    <Form.Item label="用户属性筛选条件">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {attributes.filter(attr => attr.target_type === 'user').map((attr) => (
                          <Space key={attr.id} style={{ width: '100%' }}>
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
                            <Popconfirm
                              title="确定要删除这个属性吗？"
                              onConfirm={() => handleRemoveAttribute(attr.id)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="text"
                                danger
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ))}
                        <Button 
                          type="dashed" 
                          onClick={() => {
                            const newAttr: FilterAttribute = {
                              id: Date.now(),
                              filter_id: 0,
                              target_type: 'user',
                              name: '',
                              value: '',
                            };
                            setAttributes([...attributes, newAttr]);
                          }} 
                          style={{ width: '100%' }}
                        >
                          添加用户属性条件
                        </Button>
                      </Space>
                    </Form.Item>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Card>
        );

      case 3: // 关联资源
        return (
          <Card>
            <Form.Item
              label="资产范围"
              name="asset_type"
              rules={[{ required: true, message: '请选择资产范围' }]}
            >
              <Select size="large">
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
                        listStyle={{
                          width: 350,
                          height: 250,
                        }}
                      />
                    </Form.Item>
                  );
                } else if (assetType === 'attribute') {
                  return (
                    <Form.Item label="资产属性筛选条件">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {attributes.filter(attr => attr.target_type === 'asset').map((attr) => (
                          <Space key={attr.id} style={{ width: '100%' }}>
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
                            <Popconfirm
                              title="确定要删除这个属性吗？"
                              onConfirm={() => handleRemoveAttribute(attr.id)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="text"
                                danger
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ))}
                        <Button 
                          type="dashed" 
                          onClick={() => {
                            const newAttr: FilterAttribute = {
                              id: Date.now(),
                              filter_id: 0,
                              target_type: 'asset',
                              name: '',
                              value: '',
                            };
                            setAttributes([...attributes, newAttr]);
                          }} 
                          style={{ width: '100%' }}
                        >
                          添加资产属性条件
                        </Button>
                      </Space>
                    </Form.Item>
                  );
                }
                return null;
              }}
            </Form.Item>

            <Divider />

            <Form.Item
              label="账号范围"
              name="account_type"
              rules={[{ required: true, message: '请选择账号范围' }]}
            >
              <Select size="large">
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
                        listStyle={{
                          width: 350,
                          height: 200,
                        }}
                      />
                    </Form.Item>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Card>
        );

      case 4: // 确认配置
        return (
          <Card>
            <Title level={4}>规则配置摘要</Title>
            <Divider />
            
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>基本信息：</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag>名称：{form.getFieldValue('name')}</Tag>
                  <Tag>优先级：{form.getFieldValue('priority')}</Tag>
                  <Tag color={form.getFieldValue('enabled') ? 'green' : 'default'}>
                    {form.getFieldValue('enabled') ? '启用' : '禁用'}
                  </Tag>
                </div>
              </div>

              <div>
                <Text strong>命令组与动作：</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">
                    命令组：{commandGroups.find(g => g.id === form.getFieldValue('command_group_id'))?.name}
                  </Tag>
                  <Tag color={getActionColor(form.getFieldValue('action'))}>
                    动作：{getActionText(form.getFieldValue('action'))}
                  </Tag>
                </div>
              </div>

              <div>
                <Text strong>应用范围：</Text>
                <div style={{ marginTop: 8 }}>
                  <div>
                    <UserOutlined /> 用户：
                    {form.getFieldValue('user_type') === 'all' ? '所有用户' : 
                     form.getFieldValue('user_type') === 'specific' ? `指定用户(${selectedUserKeys.length}个)` : 
                     '属性筛选'}
                  </div>
                  <div>
                    <DesktopOutlined /> 资产：
                    {form.getFieldValue('asset_type') === 'all' ? '所有资产' : 
                     form.getFieldValue('asset_type') === 'specific' ? `指定资产(${selectedAssetKeys.length}个)` : 
                     '属性筛选'}
                  </div>
                  <div>
                    <SafetyOutlined /> 账号：
                    {form.getFieldValue('account_type') === 'all' ? '所有账号' : 
                     `指定账号(${selectedAccounts.length}个)`}
                  </div>
                </div>
              </div>

              <Form.Item
                label="备注说明"
                name="remark"
                rules={[{ max: 500, message: '备注最多500个字符' }]}
              >
                <TextArea
                  placeholder="请输入备注信息（可选）"
                  rows={3}
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Space>
          </Card>
        );

      default:
        return null;
    }
  };

  // 获取动作颜色
  const getActionColor = (action: string) => {
    switch (action) {
      case 'deny': return 'red';
      case 'allow': return 'green';
      case 'alert': return 'orange';
      case 'prompt_alert': return 'gold';
      default: return 'default';
    }
  };

  // 获取动作文本
  const getActionText = (action: string) => {
    switch (action) {
      case 'deny': return '拒绝';
      case 'allow': return '允许';
      case 'alert': return '告警';
      case 'prompt_alert': return '提示并告警';
      default: return action;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <FilterOutlined />
          {editingFilter ? '编辑过滤规则' : '新建过滤规则'}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <div style={{ padding: '24px 0' }}>
        <Steps current={currentStep} items={steps} />
      </div>

      <Form form={form} layout="vertical">
        <div style={{ minHeight: 400, marginTop: 24 }}>
          {renderStepContent()}
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>
                上一步
              </Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button type="primary" onClick={handleFinish} loading={loading}>
                {editingFilter ? '更新' : '创建'}
              </Button>
            )}
            <Button onClick={onCancel}>
              取消
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default FilterRuleWizard;