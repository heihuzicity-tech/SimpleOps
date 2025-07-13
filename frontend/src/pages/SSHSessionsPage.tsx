import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Space, Tag, Modal, message, Row, Col } from 'antd';
import { PlusOutlined, ReloadOutlined, DesktopOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchSessions, closeSession } from '../store/sshSessionSlice';
import SSHConnectionModal from '../components/ssh/SSHConnectionModal';
import WebTerminal from '../components/ssh/WebTerminal';
import { SSHSessionResponse } from '../types/ssh';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

const SSHSessionsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { sessions, loading } = useSelector((state: RootState) => state.sshSession);
  
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [activeTerminals, setActiveTerminals] = useState<Set<string>>(new Set());

  useEffect(() => {
    dispatch(fetchSessions());
    // 每30秒刷新会话列表
    const interval = setInterval(() => {
      dispatch(fetchSessions());
    }, 30000);
    
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleCreateConnection = () => {
    setShowConnectionModal(true);
  };

  const handleSessionCreated = (sessionId: string) => {
    // 自动打开新创建的终端
    setActiveTerminals(prev => new Set(prev).add(sessionId));
    dispatch(fetchSessions());
  };

  const handleOpenTerminal = (sessionId: string) => {
    setActiveTerminals(prev => new Set(prev).add(sessionId));
  };

  const handleCloseTerminal = (sessionId: string) => {
    setActiveTerminals(prev => {
      const newSet = new Set(prev);
      newSet.delete(sessionId);
      return newSet;
    });
  };

  const handleCloseSession = async (sessionId: string) => {
    Modal.confirm({
      title: '确认关闭会话',
      content: '关闭会话将断开SSH连接，确定要继续吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await dispatch(closeSession(sessionId));
          handleCloseTerminal(sessionId);
          message.success('会话已关闭');
        } catch (error) {
          message.error('关闭会话失败');
        }
      },
    });
  };

  const getStatusTag = (status: SSHSessionResponse['status']) => {
    const statusConfig = {
      active: { color: 'success', text: '活跃' },
      connecting: { color: 'processing', text: '连接中' },
      closed: { color: 'default', text: '已关闭' },
      error: { color: 'error', text: '错误' },
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<SSHSessionResponse> = [
    {
      title: '会话ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace' }}>
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '资产信息',
      key: 'asset',
      render: (_, record) => (
        <div>
          <div>{record.asset_name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.asset_addr}
          </div>
        </div>
      ),
    },
    {
      title: '登录用户',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '开始时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === 'active' && (
            <Button
              size="small"
              type="primary"
              icon={<DesktopOutlined />}
              onClick={() => handleOpenTerminal(record.id)}
              disabled={activeTerminals.has(record.id)}
            >
              {activeTerminals.has(record.id) ? '已打开' : '打开终端'}
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleCloseSession(record.id)}
            disabled={record.status === 'closed'}
          >
            关闭
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>SSH会话管理</Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => dispatch(fetchSessions())}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateConnection}
            >
              创建连接
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个会话`,
          }}
        />
      </Card>

      {/* 活跃终端显示区域 */}
      {activeTerminals.size > 0 && (
        <div style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
            {Array.from(activeTerminals).map(sessionId => (
              <Col span={24} key={sessionId}>
                <WebTerminal
                  sessionId={sessionId}
                  onClose={() => handleCloseTerminal(sessionId)}
                  onError={(error) => {
                    message.error(`终端错误: ${error.message}`);
                    handleCloseTerminal(sessionId);
                  }}
                />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 创建连接弹窗 */}
      <SSHConnectionModal
        open={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onSessionCreated={handleSessionCreated}
      />
    </div>
  );
};

export default SSHSessionsPage; 