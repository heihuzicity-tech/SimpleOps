import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, message, Row, Col, InputNumber } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import { createSession } from '../../store/sshSessionSlice';
import { SSHSessionRequest } from '../../types/ssh';

interface SSHConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string) => void;
}

const SSHConnectionModal: React.FC<SSHConnectionModalProps> = ({
  open,
  onClose,
  onSessionCreated,
}) => {
  const [form] = Form.useForm();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | undefined>();

  const { assets } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);

  // 根据选择的资产过滤可用凭证
  const availableCredentials = selectedAssetId
    ? credentials.filter(cred => 
        cred.assets?.some(asset => asset.id === selectedAssetId)
      )
    : [];

  useEffect(() => {
    if (open) {
      dispatch(fetchAssets({}));
      dispatch(fetchCredentials({}));
      form.resetFields();
      setSelectedAssetId(undefined);
    }
  }, [open, dispatch, form]);

  const handleAssetChange = (assetId: number) => {
    setSelectedAssetId(assetId);
    form.setFieldsValue({ credentialId: undefined });
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const sessionRequest: SSHSessionRequest = {
        asset_id: values.assetId,
        credential_id: values.credentialId,
        protocol: 'ssh',
        width: values.width || 80,
        height: values.height || 24,
      };

      const result = await dispatch(createSession(sessionRequest));
      if (createSession.fulfilled.match(result)) {
        message.success('SSH会话创建成功');
        onSessionCreated(result.payload.id);
        onClose();
      } else {
        throw new Error(result.error?.message || '创建会话失败');
      }
    } catch (error: any) {
      message.error(error.message || '连接失败，请检查资产和凭证配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="创建SSH连接"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          width: 80,
          height: 24,
        }}
      >
        <Form.Item
          name="assetId"
          label="选择资产"
          rules={[{ required: true, message: '请选择要连接的资产' }]}
        >
          <Select
            placeholder="请选择资产"
            onChange={handleAssetChange}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false)
            }
          >
            {assets.map(asset => (
              <Select.Option key={asset.id} value={asset.id}>
                {asset.name} ({asset.address}:{asset.port})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="credentialId"
          label="选择凭证"
          rules={[{ required: true, message: '请选择登录凭证' }]}
        >
          <Select
            placeholder={selectedAssetId ? "请选择凭证" : "请先选择资产"}
            disabled={!selectedAssetId}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false)
            }
          >
            {availableCredentials.map(credential => (
              <Select.Option key={credential.id} value={credential.id}>
                {credential.username}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="width"
              label="终端宽度"
              rules={[{ required: true, message: '请输入终端宽度' }]}
            >
              <InputNumber
                min={50}
                max={200}
                placeholder="80"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="height"
              label="终端高度"
              rules={[{ required: true, message: '请输入终端高度' }]}
            >
              <InputNumber
                min={20}
                max={100}
                placeholder="24"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button
            style={{ marginRight: 8 }}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={!selectedAssetId || availableCredentials.length === 0}
          >
            创建连接
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SSHConnectionModal;