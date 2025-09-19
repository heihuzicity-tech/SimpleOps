import React, { useState, useEffect } from 'react';
import { Modal, Select, Form, Spin, Empty, Tag, Space, Typography, Divider } from 'antd';
import { LockOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons';
import { Credential } from '../../types';
import SessionTimeoutConfig from '../ssh/SessionTimeoutConfig';

const { Option } = Select;
const { Text } = Typography;

interface CredentialSelectorProps {
  visible: boolean;
  asset: any;
  credentials: Credential[];
  loading?: boolean;
  onSelect: (credentialId: number, timeoutMinutes?: number) => void;
  onCancel: () => void;
}

// 内部表单组件
const CredentialForm: React.FC<{
  availableCredentials: Credential[];
  assetCredentials: Credential[];
  timeoutMinutes: number;
  onCredentialChange: (credentialId: number, credential: Credential | null) => void;
  onTimeoutChange: (minutes: number) => void;
  onFormReady: (form: any) => void;
  initialCredentialId?: number;
}> = ({
  availableCredentials,
  assetCredentials,
  timeoutMinutes,
  onCredentialChange,
  onTimeoutChange,
  onFormReady,
  initialCredentialId
}) => {
  const [form] = Form.useForm();
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  
  useEffect(() => {
    onFormReady(form);
    if (initialCredentialId) {
      form.setFieldsValue({ credentialId: initialCredentialId });
      const credential = availableCredentials.find(c => c.id === initialCredentialId);
      setSelectedCredential(credential || null);
    }
  }, [form, onFormReady, initialCredentialId, availableCredentials]);
  
  const handleCredentialChange = (credentialId: number) => {
    const credential = availableCredentials.find(c => c.id === credentialId);
    setSelectedCredential(credential || null);
    onCredentialChange(credentialId, credential || null);
  };
  const getCredentialTypeIcon = (type: string) => {
    switch (type) {
      case 'password':
        return <LockOutlined />;
      case 'key':
        return <KeyOutlined />;
      default:
        return <UserOutlined />;
    }
  };
  
  const getCredentialTypeTag = (type: string) => {
    switch (type) {
      case 'password':
        return <Tag color="blue">密码</Tag>;
      case 'key':
        return <Tag color="green">密钥</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  return (
    <>
      <Form form={form} layout="vertical">
        <Form.Item
          name="credentialId"
          label="连接凭证"
          rules={[{ required: true, message: '请选择连接凭证' }]}
        >
          <Select 
            placeholder="请选择连接凭证"
            onChange={handleCredentialChange}
            size="large"
          >
            {availableCredentials.map(cred => (
              <Option key={cred.id} value={cred.id}>
                <Space>
                  {getCredentialTypeIcon(cred.type)}
                  <span>{cred.name}</span>
                  <Text type="secondary">({cred.username})</Text>
                  {assetCredentials.some(ac => ac.id === cred.id) && (
                    <Tag color="green" style={{ marginLeft: 8 }}>关联</Tag>
                  )}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <Divider>会话配置</Divider>
        
        <SessionTimeoutConfig
          value={timeoutMinutes}
          onChange={onTimeoutChange}
        />
      </Form>
      
      {selectedCredential && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#f5f5f5', 
          borderRadius: 4 
        }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text strong>凭证详情</Text>
            <Space>
              <Text type="secondary">类型:</Text>
              {getCredentialTypeTag(selectedCredential.type)}
            </Space>
            <Space>
              <Text type="secondary">用户名:</Text>
              <Text code>{selectedCredential.username}</Text>
            </Space>
            <Space>
              <Text type="secondary">创建时间:</Text>
              <Text>{new Date(selectedCredential.created_at).toLocaleString()}</Text>
            </Space>
          </Space>
        </div>
      )}
      
      {assetCredentials.length === 0 && availableCredentials.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text type="warning">
            提示：该资产暂无关联凭证，显示所有可用凭证供选择
          </Text>
        </div>
      )}
    </>
  );
};

export const CredentialSelector: React.FC<CredentialSelectorProps> = ({
  visible,
  asset,
  credentials,
  loading = false,
  onSelect,
  onCancel
}) => {
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [formInstance, setFormInstance] = useState<any>(null);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [initialCredentialId, setInitialCredentialId] = useState<number | undefined>();
  
  // 获取与资产关联的凭证
  const assetCredentials = credentials.filter(cred => 
    cred.assets && cred.assets.some((a: any) => a.id === asset?.id)
  );
  
  // 如果没有关联凭证，显示所有凭证
  const availableCredentials = assetCredentials.length > 0 ? assetCredentials : credentials;
  
  // 如果没有可用凭证，不渲染 Form
  const shouldRenderForm = availableCredentials.length > 0;
  
  useEffect(() => {
    if (!visible) {
      setSelectedCredential(null);
      setTimeoutMinutes(30); // 重置超时时间为默认值
      setInitialCredentialId(undefined);
      // 重置表单
      if (formInstance) {
        formInstance.resetFields();
      }
    } else if (shouldRenderForm && availableCredentials.length === 1) {
      // 如果只有一个凭证，自动选中
      setInitialCredentialId(availableCredentials[0].id);
    }
  }, [visible, availableCredentials, shouldRenderForm, formInstance]);
  
  const handleOk = async () => {
    if (!shouldRenderForm || !formInstance) {
      return;
    }
    try {
      const values = await formInstance.validateFields();
      onSelect(values.credentialId, timeoutMinutes);
    } catch (error) {
      // 表单验证失败
    }
  };
  
  const handleCredentialChange = (credentialId: number, credential: Credential | null) => {
    setSelectedCredential(credential);
  };
  
  const handleFormReady = (form: any) => {
    setFormInstance(form);
  };
  
  return (
    <Modal
      title={
        <Space>
          <LockOutlined />
          <span>选择连接凭证 - {asset?.name}</span>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="连接"
      cancelText="取消"
      width={560}
    >
      <Spin spinning={loading}>
        {!shouldRenderForm ? (
          <Empty 
            description="暂无可用凭证"
            style={{ margin: '20px 0' }}
          />
        ) : (
          <CredentialForm
            availableCredentials={availableCredentials}
            assetCredentials={assetCredentials}
            timeoutMinutes={timeoutMinutes}
            onCredentialChange={handleCredentialChange}
            onTimeoutChange={setTimeoutMinutes}
            onFormReady={handleFormReady}
            initialCredentialId={initialCredentialId}
          />
        )}
      </Spin>
    </Modal>
  );
};

export default CredentialSelector;