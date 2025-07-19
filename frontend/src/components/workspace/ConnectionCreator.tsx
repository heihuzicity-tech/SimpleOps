import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Steps, Form, Button, Space, Alert, Typography, Card, Tag } from 'antd';
import { 
  CloudServerOutlined, 
  UserOutlined, 
  KeyOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { createNewTab, createSSHConnection } from '../../store/workspaceSlice';
import { CredentialSelector } from '../sessions/CredentialSelector';
import { Asset, Credential } from '../../types';

const { Step } = Steps;
const { Title, Text } = Typography;

interface ConnectionCreatorProps {
  visible: boolean;
  asset: Asset | null;
  onCancel: () => void;
  onSuccess?: (tabId: string) => void;
}

const ConnectionCreator: React.FC<ConnectionCreatorProps> = ({
  visible,
  asset,
  onCancel,
  onSuccess
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { credentials, loading: credentialLoading } = useSelector((state: RootState) => state.credential);
  const { tabs, loading: workspaceLoading } = useSelector((state: RootState) => state.workspace);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [createdTabId, setCreatedTabId] = useState<string | null>(null);
  const [previousTabCount, setPreviousTabCount] = useState(0);

  // 重置状态
  const resetState = useCallback(() => {
    setCurrentStep(0);
    setSelectedCredential(null);
    setConnectionError(null);
    setCreatedTabId(null);
  }, []);

  // 处理取消
  const handleCancel = useCallback(() => {
    resetState();
    onCancel();
  }, [resetState, onCancel]);

  // 处理凭证选择
  const handleCredentialSelect = useCallback((credentialId: number) => {
    const credential = credentials.find(c => c.id === credentialId);
    if (credential) {
      setSelectedCredential(credential);
      setCurrentStep(1);
    }
  }, [credentials]);

  // 处理连接创建
  const handleCreateConnection = useCallback(async () => {
    if (!asset || !selectedCredential) return;

    try {
      setConnectionError(null);
      setCurrentStep(2);

      // 记录当前标签页数量
      setPreviousTabCount(tabs.length);
      
      // 创建新标签页
      dispatch(createNewTab({
        asset,
        credential: selectedCredential
      }));
      
    } catch (error: any) {
      setConnectionError(error.message || '连接创建失败');
      setCurrentStep(1); // 返回到凭证选择步骤
    }
  }, [asset, selectedCredential, dispatch, tabs.length]);

  // 监听tabs变化，处理新创建的标签页
  useEffect(() => {
    if (currentStep === 2 && tabs.length > previousTabCount) {
      const newTab = tabs[tabs.length - 1];
      if (newTab && asset && selectedCredential) {
        setCreatedTabId(newTab.id);
        
        // 创建SSH连接
        dispatch(createSSHConnection({
          asset,
          credential: selectedCredential,
          tabId: newTab.id
        })).unwrap()
        .then(() => {
          setCurrentStep(3);
          // 延迟关闭弹窗并切换到新标签页
          setTimeout(() => {
            onSuccess?.(newTab.id);
            handleCancel();
          }, 1500);
        })
        .catch((error: any) => {
          setConnectionError(error.message || '连接创建失败');
          setCurrentStep(1); // 返回到凭证选择步骤
        });
      }
    }
  }, [tabs.length, currentStep, previousTabCount, asset, selectedCredential, dispatch, onSuccess, handleCancel]);

  // 清理状态
  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  // 获取步骤配置
  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'finish';
    if (step === currentStep) {
      if (step === 2 && workspaceLoading) return 'process';
      if (step === 2 && connectionError) return 'error';
      return 'process';
    }
    return 'wait';
  };

  // 渲染资产信息
  const renderAssetInfo = () => {
    if (!asset) return null;

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <CloudServerOutlined style={{ color: '#1890ff' }} />
              <Title level={5} style={{ margin: 0 }}>{asset.name}</Title>
            </Space>
            <Tag color={asset.os_type === 'linux' ? 'green' : 'blue'}>
              {asset.os_type?.toUpperCase() || 'UNKNOWN'}
            </Tag>
          </div>
          <Text type="secondary">
            {asset.address}:{asset.port || 22} | {asset.protocol || 'SSH'}
          </Text>
        </Space>
      </Card>
    );
  };

  // 渲染凭证信息
  const renderCredentialInfo = () => {
    if (!selectedCredential) return null;

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              {selectedCredential.type === 'ssh_key' ? (
                <KeyOutlined style={{ color: '#722ed1' }} />
              ) : (
                <UserOutlined style={{ color: '#52c41a' }} />
              )}
              <Title level={5} style={{ margin: 0 }}>{selectedCredential.name}</Title>
            </Space>
            <Tag color={selectedCredential.type === 'ssh_key' ? 'purple' : 'green'}>
              {selectedCredential.type === 'ssh_key' ? 'SSH密钥' : '用户密码'}
            </Tag>
          </div>
          <Text type="secondary">
            用户名: {selectedCredential.username}
          </Text>
        </Space>
      </Card>
    );
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            {renderAssetInfo()}
            <CredentialSelector
              visible={true}
              asset={asset}
              credentials={credentials}
              loading={credentialLoading}
              onSelect={handleCredentialSelect}
              onCancel={() => {}}
            />
          </div>
        );

      case 1:
        return (
          <div>
            {renderAssetInfo()}
            {renderCredentialInfo()}
            
            <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
              <Alert
                message="确认连接信息"
                description="请确认以上资产和凭证信息无误，点击确认创建连接。"
                type="info"
                showIcon
              />
              
              {connectionError && (
                <Alert
                  message="连接失败"
                  description={connectionError}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setConnectionError(null)}
                />
              )}
            </Space>
          </div>
        );

      case 2:
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {renderAssetInfo()}
            {renderCredentialInfo()}
            <Alert
              message="正在建立连接"
              description="正在连接到目标主机，请稍候..."
              type="info"
              showIcon
            />
          </div>
        );

      case 3:
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {renderAssetInfo()}
            {renderCredentialInfo()}
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircleOutlined 
                style={{ 
                  color: '#52c41a', 
                  fontSize: 48, 
                  marginBottom: 16 
                }} 
              />
              <div style={{ 
                fontSize: 16, 
                fontWeight: 500, 
                color: '#262626',
                marginBottom: 8 
              }}>
                连接建立中...
              </div>
              <div style={{ 
                fontSize: 14, 
                color: '#8c8c8c' 
              }}>
                正在跳转到工作台
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 获取步骤标题
  const getStepTitle = (step: number) => {
    const titles = ['选择凭证', '确认信息', '建立连接', '连接成功'];
    return titles[step] || '';
  };

  return (
    <Modal
      title={`连接到 ${asset?.name || '主机'}`}
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={
        <Space>
          <Button onClick={handleCancel}>
            取消
          </Button>
          {currentStep === 1 && (
            <>
              <Button onClick={() => setCurrentStep(0)}>
                上一步
              </Button>
              <Button
                type="primary"
                onClick={handleCreateConnection}
                loading={workspaceLoading}
                disabled={!selectedCredential}
              >
                确认连接
              </Button>
            </>
          )}
        </Space>
      }
      destroyOnClose
      maskClosable={false}
    >
      <div style={{ marginBottom: 24 }}>
        <Steps current={currentStep} size="small">
          {[0, 1, 2, 3].map(step => (
            <Step
              key={step}
              title={getStepTitle(step)}
              status={getStepStatus(step)}
            />
          ))}
        </Steps>
      </div>

      {renderStepContent()}
    </Modal>
  );
};

export default ConnectionCreator;