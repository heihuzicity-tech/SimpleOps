import React, { useEffect, useState } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Switch, 
  Button, 
  Card, 
  Row, 
  Col, 
  Space, 
  Divider,
  Alert,
  Spin
} from 'antd';
import { PlusOutlined, DisconnectOutlined } from '@ant-design/icons';
import { Asset, AssetGroup, Credential } from '../../types';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { ConnectionStatusTag } from './ConnectionStatusTag';

const { Option } = Select;
const { TextArea } = Input;

// 表单模式
export type AssetFormMode = 'create' | 'edit' | 'view';

// 表单数据类型
export interface AssetFormData {
  name: string;
  type: string;
  os_type?: string;
  address: string;
  port: number;
  protocol: string;
  tags?: string;
  status?: number;
  credential_ids?: number[];
  group_ids?: number[];
}

// 组件Props
export interface AssetFormProps {
  mode: AssetFormMode;
  initialValues?: Partial<Asset>;
  groups?: AssetGroup[];
  credentials?: Credential[];
  loading?: boolean;
  onSubmit: (values: AssetFormData) => Promise<void>;
  onCancel: () => void;
  onTestConnection?: (asset: Partial<Asset>, credential: Credential) => Promise<boolean>;
  className?: string;
  style?: React.CSSProperties;
}

// 预定义的协议配置
const protocolConfig = {
  ssh: { name: 'SSH', defaultPort: 22, supportedOS: ['linux', 'windows'] },
  rdp: { name: 'RDP', defaultPort: 3389, supportedOS: ['windows'] },
  vnc: { name: 'VNC', defaultPort: 5900, supportedOS: ['linux', 'windows'] },
  mysql: { name: 'MySQL', defaultPort: 3306, supportedOS: ['linux', 'windows'] },
  postgresql: { name: 'PostgreSQL', defaultPort: 5432, supportedOS: ['linux', 'windows'] },
  telnet: { name: 'Telnet', defaultPort: 23, supportedOS: ['linux', 'windows'] },
};

// 资产类型配置
const assetTypeConfig = {
  server: { name: '服务器', protocols: ['ssh', 'rdp', 'vnc', 'telnet'] },
  database: { name: '数据库', protocols: ['mysql', 'postgresql'] },
  network: { name: '网络设备', protocols: ['ssh', 'telnet'] },
  storage: { name: '存储设备', protocols: ['ssh', 'telnet'] },
};

/**
 * 通用资产表单组件
 * 支持创建、编辑、查看模式，包含连接测试功能
 */
export const AssetForm: React.FC<AssetFormProps> = ({
  mode,
  initialValues,
  groups = [],
  credentials = [],
  loading = false,
  onSubmit,
  onCancel,
  onTestConnection,
  className,
  style,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('server');
  const [selectedProtocol, setSelectedProtocol] = useState<string>('ssh');
  const [availableProtocols, setAvailableProtocols] = useState<string[]>(['ssh']);
  const [testCredentialId, setTestCredentialId] = useState<number | undefined>();
  
  // 连接状态管理
  const connectionStatus = useConnectionStatus();

  // 表单标题
  const getTitle = () => {
    switch (mode) {
      case 'create':
        return '创建资产';
      case 'edit':
        return '编辑资产';
      case 'view':
        return '查看资产';
      default:
        return '资产信息';
    }
  };

  // 监听资产类型变化
  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const typeConfig = assetTypeConfig[type as keyof typeof assetTypeConfig];
    if (typeConfig) {
      setAvailableProtocols(typeConfig.protocols);
      // 如果当前协议不在可用列表中，重置为第一个可用协议
      if (!typeConfig.protocols.includes(selectedProtocol)) {
        const defaultProtocol = typeConfig.protocols[0];
        setSelectedProtocol(defaultProtocol);
        form.setFieldsValue({ 
          protocol: defaultProtocol,
          port: protocolConfig[defaultProtocol as keyof typeof protocolConfig].defaultPort
        });
      }
    }
  };

  // 监听协议变化
  const handleProtocolChange = (protocol: string) => {
    setSelectedProtocol(protocol);
    const protocolInfo = protocolConfig[protocol as keyof typeof protocolConfig];
    if (protocolInfo) {
      form.setFieldsValue({ port: protocolInfo.defaultPort });
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!onTestConnection || !testCredentialId) {
      return;
    }

    try {
      const formValues = await form.validateFields(['name', 'address', 'port', 'protocol']);
      const credential = credentials.find(c => c.id === testCredentialId);
      
      if (!credential) {
        return;
      }

      const testAsset: Partial<Asset> = {
        name: formValues.name,
        address: formValues.address,
        port: formValues.port,
        protocol: formValues.protocol,
        type: selectedType,
      };

      await connectionStatus.testConnection(testAsset as Asset, credential);
    } catch (error) {
      console.error('连接测试失败:', error);
    }
  };

  // 表单提交
  const handleSubmit = async (values: AssetFormData) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      const formValues = {
        ...initialValues,
        credential_ids: initialValues.credentials?.map(c => c.id) || [],
        group_ids: initialValues.groups?.map(g => g.id) || [],
      };
      form.setFieldsValue(formValues);
      
      if (initialValues.type) {
        setSelectedType(initialValues.type);
        handleTypeChange(initialValues.type);
      }
      
      if (initialValues.protocol) {
        setSelectedProtocol(initialValues.protocol);
      }
    }
  }, [initialValues, form]);

  // 获取当前操作系统选项
  const getOSOptions = () => {
    const protocolInfo = protocolConfig[selectedProtocol as keyof typeof protocolConfig];
    return protocolInfo?.supportedOS || ['linux', 'windows'];
  };

  // 只读模式的表单项
  const isReadOnly = mode === 'view';

  return (
    <Card title={getTitle()} className={className} style={style}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isReadOnly}
        initialValues={{
          type: 'server',
          protocol: 'ssh',
          port: 22,
          os_type: 'linux',
          status: 1,
        }}
      >
        <Row gutter={16}>
          {/* 基本信息 */}
          <Col span={24}>
            <Divider orientation="left">基本信息</Divider>
          </Col>
          
          <Col xs={24} sm={12}>
            <Form.Item
              label="资产名称"
              name="name"
              rules={[
                { required: true, message: '请输入资产名称' },
                { min: 1, max: 100, message: '名称长度为1-100个字符' }
              ]}
            >
              <Input placeholder="输入资产名称" />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12}>
            <Form.Item
              label="资产类型"
              name="type"
              rules={[{ required: true, message: '请选择资产类型' }]}
            >
              <Select placeholder="选择资产类型" onChange={handleTypeChange}>
                {Object.entries(assetTypeConfig).map(([key, config]) => (
                  <Option key={key} value={key}>{config.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="操作系统"
              name="os_type"
            >
              <Select placeholder="选择操作系统">
                {getOSOptions().map(os => (
                  <Option key={os} value={os}>
                    {os === 'linux' ? 'Linux' : os === 'windows' ? 'Windows' : os}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="状态"
              name="status"
              valuePropName="checked"
              getValueFromEvent={(checked) => checked ? 1 : 0}
              getValueProps={(value) => ({ checked: value === 1 })}
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Col>

          {/* 连接信息 */}
          <Col span={24}>
            <Divider orientation="left">连接信息</Divider>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="主机地址"
              name="address"
              rules={[
                { required: true, message: '请输入主机地址' },
                { 
                  pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
                  message: '请输入有效的IP地址或域名'
                }
              ]}
            >
              <Input placeholder="输入IP地址或域名" />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="端口"
              name="port"
              rules={[
                { required: true, message: '请输入端口号' },
                { type: 'number', min: 1, max: 65535, message: '端口号范围为1-65535' }
              ]}
            >
              <InputNumber 
                placeholder="输入端口号" 
                style={{ width: '100%' }}
                min={1}
                max={65535}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="协议"
              name="protocol"
              rules={[{ required: true, message: '请选择协议' }]}
            >
              <Select placeholder="选择协议" onChange={handleProtocolChange}>
                {availableProtocols.map(protocol => {
                  const config = protocolConfig[protocol as keyof typeof protocolConfig];
                  return (
                    <Option key={protocol} value={protocol}>
                      {config.name} (默认端口: {config.defaultPort})
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
          </Col>

          {/* 连接测试 */}
          {!isReadOnly && onTestConnection && credentials.length > 0 && (
            <Col xs={24} sm={12}>
              <Form.Item label="连接测试">
                <Space.Compact style={{ display: 'flex' }}>
                  <Select
                    placeholder="选择凭证"
                    value={testCredentialId}
                    onChange={setTestCredentialId}
                    style={{ flex: 1 }}
                  >
                    {credentials.map(credential => (
                      <Option key={credential.id} value={credential.id}>
                        {credential.name} ({credential.username})
                      </Option>
                    ))}
                  </Select>
                  <Button 
                    icon={<DisconnectOutlined />}
                    onClick={handleTestConnection}
                    disabled={!testCredentialId || connectionStatus.status === 'connecting'}
                    loading={connectionStatus.status === 'connecting'}
                  >
                    测试
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          )}

          {/* 连接测试结果 */}
          {connectionStatus.result && (
            <Col span={24}>
              <Alert
                type={connectionStatus.result.success ? 'success' : 'error'}
                message={
                  <Space>
                    <ConnectionStatusTag
                      status={connectionStatus.status}
                      showTooltip={false}
                      latency={connectionStatus.result.latency}
                    />
                    {connectionStatus.result.message}
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />
            </Col>
          )}

          {/* 关联信息 */}
          <Col span={24}>
            <Divider orientation="left">关联信息</Divider>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="关联凭证"
              name="credential_ids"
              tooltip="选择该资产可使用的凭证"
            >
              <Select
                mode="multiple"
                placeholder="选择关联凭证"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {credentials.map(credential => (
                  <Option key={credential.id} value={credential.id}>
                    {credential.name} ({credential.username})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              label="所属分组"
              name="group_ids"
              tooltip="选择资产所属的分组"
            >
              <Select
                mode="multiple"
                placeholder="选择所属分组"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {groups.map(group => (
                  <Option key={group.id} value={group.id}>
                    {group.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          {/* 其他信息 */}
          <Col span={24}>
            <Form.Item
              label="标签"
              name="tags"
              tooltip="可用于资产分类和搜索，JSON格式或逗号分隔"
            >
              <TextArea 
                placeholder="输入标签信息，如：production,web-server 或 {&quot;env&quot;:&quot;prod&quot;,&quot;team&quot;:&quot;ops&quot;}"
                rows={3}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 操作按钮 */}
        {!isReadOnly && (
          <Row>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={onCancel}>
                  取消
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={submitting}
                  icon={mode === 'create' ? <PlusOutlined /> : undefined}
                >
                  {mode === 'create' ? '创建' : '保存'}
                </Button>
              </Space>
            </Col>
          </Row>
        )}
      </Form>
    </Card>
  );
};

export default AssetForm;