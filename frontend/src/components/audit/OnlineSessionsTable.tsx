import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Input,
  Row,
  Col,
  Tooltip,
  Modal,
  Form,
  message,
  Alert,
  Breadcrumb,
  Select,
  Space,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, ActiveSession, TerminateSessionRequest } from '../../services/auditAPI';
import { getWebSocketClient, WS_MESSAGE_TYPES, WSMessage } from '../../services/websocketClient';

const { TextArea } = Input;

interface OnlineSessionsTableProps {
  className?: string;
}

const OnlineSessionsTable: React.FC<OnlineSessionsTableProps> = ({ className }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ActiveSession[]>([]);
  const [searchText, setSearchText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('登录用户');
  
  // 终止会话模态框
  const [terminateVisible, setTerminateVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [terminateForm] = Form.useForm();

  // WebSocket客户端
  const wsClient = getWebSocketClient();

  // 获取活跃会话列表
  const fetchActiveSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AuditAPI.getActiveSessions({});
      
      if (response.success) {
        // 去重处理：基于session_id去除重复项
        const sessions = response.data.sessions || [];
        const uniqueSessions = sessions.filter((session: any, index: number, self: any[]) => 
          index === self.findIndex((s: any) => s.session_id === session.session_id)
        );
        
        setData(uniqueSessions);
      }
    } catch (error) {
      console.error('获取活跃会话失败:', error);
      message.error('获取活跃会话失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化WebSocket连接
  const initWebSocket = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      await wsClient.connect();
      setWsConnected(true);

      // 订阅消息
      wsClient.subscribe(WS_MESSAGE_TYPES.MONITORING_UPDATE, handleMonitoringUpdate);
      wsClient.subscribe(WS_MESSAGE_TYPES.SESSION_START, handleSessionStart);
      wsClient.subscribe(WS_MESSAGE_TYPES.SESSION_END, handleSessionEnd);

      // 监听连接状态变化
      wsClient.onConnectionStateChange(setWsConnected);

    } catch (error) {
      console.error('WebSocket连接失败:', error);
      setWsConnected(false);
    }
  }, []);

  // 处理监控更新消息
  const handleMonitoringUpdate = useCallback((message: WSMessage) => {
    const { active_sessions } = message.data;
    if (active_sessions) {
      // 去重处理：基于session_id去除重复项
      const uniqueSessions = active_sessions.filter((session: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.session_id === session.session_id)
      );
      
      setData(uniqueSessions);
    }
  }, []);

  // 处理会话开始消息
  const handleSessionStart = useCallback(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  // 处理会话结束消息
  const handleSessionEnd = useCallback((message: WSMessage) => {
    const sessionId = message.data?.session_id || message.session_id;
    if (sessionId) {
      // 🚀 立即从本地状态中移除会话，无需等待API
      // 使用幂等操作，避免重复处理同一个会话
      setData(prevData => {
        const exists = prevData.some(session => session.session_id === sessionId);
        if (exists) {
          console.log(`会话 ${sessionId} 已立即从列表中移除 (${message.data?.reason || '用户操作'})`);
          return prevData.filter(session => session.session_id !== sessionId);
        } else {
          console.log(`会话 ${sessionId} 已不在列表中，跳过移除操作`);
          return prevData;
        }
      });
    } else {
      // 如果没有session_id，则刷新整个列表
      fetchActiveSessions();
    }
  }, [fetchActiveSessions]);

  // 初始加载
  useEffect(() => {
    fetchActiveSessions();
  }, []);

  // WebSocket连接管理
  useEffect(() => {
    if (data.length > 0 && !wsConnected) {
      initWebSocket();
    } else if (data.length === 0 && wsConnected) {
      wsClient.disconnect();
      setWsConnected(false);
    }
  }, [data.length, wsConnected]);

  // 终止会话
  const handleTerminateSession = async () => {
    if (!selectedSession) return;

    try {
      const values = await terminateForm.validateFields();
      const request: TerminateSessionRequest = {
        reason: values.reason,
        force: true, // 强制终止
      };

      await AuditAPI.terminateSession(selectedSession.session_id, request);
      message.success('会话已强制下线');
      setTerminateVisible(false);
      terminateForm.resetFields();
      fetchActiveSessions();
    } catch (error: any) {
      console.error('终止会话失败:', error);
      
      // 更详细的错误处理
      if (error.response?.status === 401) {
        message.error('认证失败，请重新登录');
      } else if (error.response?.status === 403) {
        message.error('权限不足，无法终止此会话');
      } else if (error.response?.status === 404) {
        message.error('会话不存在或已结束');
      } else if (error.response?.status === 500) {
        const errorMsg = error.response?.data?.message || '服务器内部错误';
        message.error(`服务器错误: ${errorMsg}`);
      } else {
        const errorMsg = error.response?.data?.message || error.message || '未知错误';
        message.error(`强制下线失败: ${errorMsg}`);
      }
    }
  };

  // 格式化持续时间
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${seconds}秒`;
    }
  };

  // 过滤数据
  const filteredData = data.filter(item => {
    if (!searchText) return true;
    
    const searchTextLower = searchText.toLowerCase();
    
    // 根据下拉框选择的类型进行过滤
    if (selectedUser === '登录用户') {
      return item.username.toLowerCase().includes(searchTextLower);
    } else if (selectedUser === '主机') {
      return item.asset_name.toLowerCase().includes(searchTextLower) ||
             item.asset_address.includes(searchText);
    } else {
      // 默认全局搜索
      return item.username.toLowerCase().includes(searchTextLower) ||
             item.asset_name.toLowerCase().includes(searchTextLower) ||
             item.asset_address.includes(searchText);
    }
  });

  // 表格列定义（响应式设计）
  const columns: ColumnsType<ActiveSession> = [
    {
      title: '登录用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      fixed: 'left',
      render: (username: string) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>{username}</span>
      ),
    },
    {
      title: '主机',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'asset_address',
      key: 'asset_address',
      width: 130,
      responsive: ['md'],
    },
    {
      title: '系统用户',
      dataIndex: 'system_user',
      key: 'system_user',
      width: 100,
      responsive: ['lg'],
      render: (user: string) => user || 'root',
    },
    {
      title: '资源类型',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      responsive: ['sm'],
      render: (protocol: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          ssh: { text: '主机', color: '#52c41a' },
          rdp: { text: '桌面', color: '#1890ff' },
          vnc: { text: 'VNC', color: '#fa8c16' },
        };
        const type = typeMap[protocol] || { text: protocol, color: 'default' };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      responsive: ['md'],
      render: (time: string) => (
        <span>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          danger
          size="small"
          onClick={() => {
            setSelectedSession(record);
            setTerminateVisible(true);
          }}
        >
          强制下线
        </Button>
      ),
    },
  ];

  return (
    <div className={className}>
      {/* 整合的页面内容 */}
      <Card 
        size="small"
        styles={{ body: { padding: '1rem 1.5rem' } }}
      >
        {/* 页面头部 - 面包屑 */}
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            items={[
              { title: '审计管理' },
              { title: '在线会话' },
            ]}
          />
        </div>
        
        {/* 搜索和操作区域 */}
        <Row justify="space-between" align="middle" gutter={[16, 8]}>
          <Col xs={24} sm={18} md={18} lg={20} xl={20}>
            <Space.Compact style={{ display: 'flex', width: '100%', maxWidth: 500 }}>
              <Select
                value={selectedUser}
                onChange={setSelectedUser}
                style={{ width: 120 }}
                placeholder="登录用户"
              >
                <Select.Option value="登录用户">登录用户</Select.Option>
                <Select.Option value="主机">主机</Select.Option>
              </Select>
              <Input.Search
                placeholder="请输入关键字搜索"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={(value) => setSearchText(value)}
                allowClear
                style={{ flex: 1 }}
                enterButton={<SearchOutlined />}
              />
            </Space.Compact>
          </Col>
          
          {/* 右侧 - 操作按钮 */}
          <Col xs={24} sm={6} md={6} lg={4} xl={4}>
            <div style={{ textAlign: 'right' }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchActiveSessions}
                loading={loading}
                type="primary"
              >
                刷新
              </Button>
            </div>
          </Col>
        </Row>

        {/* 分隔线 */}
        <div style={{ margin: '16px 0', borderTop: '1px solid #f0f0f0' }} />

        {/* 会话列表 */}
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="session_id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条数据`,
            pageSize: 10,
            responsive: true,
            showLessItems: true,
          }}
          scroll={{ 
            x: 'max-content',
            y: 'calc(100vh - 350px)'
          }}
          size="middle"
        />
      </Card>

      {/* 强制下线确认模态框 */}
      <Modal
        title="强制下线"
        open={terminateVisible}
        onOk={handleTerminateSession}
        onCancel={() => setTerminateVisible(false)}
        okText="确认下线"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="警告"
          description={`即将强制下线用户 ${selectedSession?.username} 的会话，此操作不可撤销。`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={terminateForm} layout="vertical">
          <Form.Item
            name="reason"
            label="下线原因"
            rules={[{ required: true, message: '请输入下线原因' }]}
          >
            <TextArea rows={3} placeholder="请输入强制下线的原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OnlineSessionsTable;