import React, { useState } from 'react';
import {
  Button,
  Space,
  Dropdown,
  Modal,
  message,
  Typography,
  Input,
  Divider,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  FolderOutlined,
  MoreOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { RecordingResponse } from '../../services/recordingAPI';
import { formatFileSize } from '../../utils/format';

const { Text } = Typography;
const { TextArea } = Input;

interface BatchOperationToolbarProps {
  selectedRecordings: RecordingResponse[];
  onClearSelection: () => void;
  onBatchDelete: (reason: string) => Promise<void>;
  onBatchDownload: () => Promise<void>;
  onBatchArchive: (reason: string) => Promise<void>;
  loading?: boolean;
}

const BatchOperationToolbar: React.FC<BatchOperationToolbarProps> = ({
  selectedRecordings,
  onClearSelection,
  onBatchDelete,
  onBatchDownload,
  onBatchArchive,
  loading = false,
}) => {
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [operationLoading, setOperationLoading] = useState(false);

  const selectedCount = selectedRecordings.length;
  const totalSize = selectedRecordings.reduce((sum, item) => sum + item.file_size, 0);

  // 计算操作权限
  const canDelete = selectedRecordings.every(r => r.can_delete);
  const canDownload = selectedRecordings.every(r => r.can_download);
  const canArchive = selectedRecordings.every(r => r.can_delete); // 假设归档需要删除权限

  const handleBatchDelete = async () => {
    if (!reason.trim()) {
      message.error('请填写删除原因');
      return;
    }

    setOperationLoading(true);
    try {
      await onBatchDelete(reason.trim());
      setDeleteModalVisible(false);
      setReason('');
      message.success(`成功删除 ${selectedCount} 个录制文件`);
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleBatchDownload = async () => {
    setOperationLoading(true);
    try {
      await onBatchDownload();
      message.success(`正在准备下载 ${selectedCount} 个文件...`);
    } catch (error) {
      console.error('批量下载失败:', error);
      message.error('批量下载失败');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleBatchArchive = async () => {
    if (!reason.trim()) {
      message.error('请填写归档原因');
      return;
    }

    setOperationLoading(true);
    try {
      await onBatchArchive(reason.trim());
      setArchiveModalVisible(false);
      setReason('');
      message.success(`成功归档 ${selectedCount} 个录制文件`);
    } catch (error) {
      console.error('批量归档失败:', error);
      message.error('批量归档失败');
    } finally {
      setOperationLoading(false);
    }
  };

  const moreMenuItems: MenuProps['items'] = [
    {
      key: 'archive',
      label: '批量归档',
      icon: <FolderOutlined />,
      disabled: !canArchive || selectedCount === 0,
      onClick: () => setArchiveModalVisible(true),
    },
    {
      key: 'export',
      label: '导出列表',
      disabled: selectedCount === 0,
      onClick: () => {
        // TODO: 实现导出功能
        message.info('导出功能开发中');
      },
    },
  ];

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div style={{
        padding: '12px 16px',
        background: '#f0f9ff',
        border: '1px solid #91d5ff',
        borderRadius: '6px',
        marginBottom: '16px',
      }}>
        <Space split={<Divider type="vertical" />} size="large">
          <Text strong>
            已选择 <Text style={{ color: '#1890ff' }}>{selectedCount}</Text> 项
          </Text>
          <Text>
            总大小: <Text code>{formatFileSize(totalSize)}</Text>
          </Text>
          
          <Space>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteModalVisible(true)}
              disabled={!canDelete || loading}
              loading={operationLoading}
            >
              批量删除
            </Button>
            
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleBatchDownload}
              disabled={!canDownload || loading}
              loading={operationLoading}
            >
              批量下载
            </Button>
            
            <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
              <Button icon={<MoreOutlined />}>
                更多操作
              </Button>
            </Dropdown>
            
            <Button onClick={onClearSelection}>
              取消选择
            </Button>
          </Space>
        </Space>
      </div>

      {/* 删除确认对话框 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            确认批量删除
          </Space>
        }
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setReason('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setDeleteModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger
            loading={operationLoading}
            onClick={handleBatchDelete}
          >
            确认删除
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>您即将删除 <Text strong type="danger">{selectedCount}</Text> 个录制文件</Text>
          <br />
          <Text type="secondary">总大小: {formatFileSize(totalSize)}</Text>
        </div>
        
        <Text strong style={{ color: '#ff4d4f' }}>
          此操作不可恢复，请谨慎操作！
        </Text>
        
        <div style={{ marginTop: '16px' }}>
          <Text>删除原因 <Text type="danger">*</Text>:</Text>
          <TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入删除原因，此信息将记录到审计日志中"
            rows={3}
            maxLength={200}
            showCount
            style={{ marginTop: '8px' }}
          />
        </div>
      </Modal>

      {/* 归档确认对话框 */}
      <Modal
        title="批量归档"
        open={archiveModalVisible}
        onCancel={() => {
          setArchiveModalVisible(false);
          setReason('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setArchiveModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={operationLoading}
            onClick={handleBatchArchive}
          >
            确认归档
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>您即将归档 <Text strong>{selectedCount}</Text> 个录制文件</Text>
          <br />
          <Text type="secondary">归档后文件将移动到归档存储中</Text>
        </div>
        
        <div>
          <Text>归档原因 <Text type="danger">*</Text>:</Text>
          <TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入归档原因"
            rows={3}
            maxLength={200}
            showCount
            style={{ marginTop: '8px' }}
          />
        </div>
      </Modal>
    </>
  );
};

export default BatchOperationToolbar;