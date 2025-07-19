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
  EyeOutlined,
  PoweroffOutlined,
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

  // 终端镜像功能
  const [mirrorVisible, setMirrorVisible] = useState(false);
  const [mirrorSession, setMirrorSession] = useState<ActiveSession | null>(null);

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

  // 统一的会话去重处理函数
  const deduplicateSessions = useCallback((sessions: any[]) => {
    const uniqueSessions = new Map();
    sessions.forEach(session => {
      const sessionId = session.session_id;
      if (sessionId && !uniqueSessions.has(sessionId)) {
        uniqueSessions.set(sessionId, session);
      }
    });
    return Array.from(uniqueSessions.values());
  }, []);

  // 处理监控更新消息 - 使用增量更新策略
  const handleMonitoringUpdate = useCallback((message: WSMessage) => {
    const { active_sessions } = message.data;
    if (active_sessions && Array.isArray(active_sessions)) {
      setData(prevData => {
        // 合并新数据和现有数据，然后去重
        const allSessions = [...prevData, ...active_sessions];
        const uniqueSessions = deduplicateSessions(allSessions);
        
        // 只有数据确实发生变化时才更新状态
        if (JSON.stringify(uniqueSessions) !== JSON.stringify(prevData)) {
          console.log(`监控更新：接收到 ${active_sessions.length} 个会话，合并后共 ${uniqueSessions.length} 个唯一会话`);
          return uniqueSessions;
        }
        return prevData;
      });
    }
  }, [deduplicateSessions]);

  // 处理会话开始消息 - 使用增量添加策略
  const handleSessionStart = useCallback((message: WSMessage) => {
    const newSession = message.data;
    if (newSession && newSession.session_id) {
      setData(prevData => {
        // 检查会话是否已存在
        const exists = prevData.some(session => session.session_id === newSession.session_id);
        if (!exists) {
          console.log(`新会话开始：${newSession.session_id}`);
          return deduplicateSessions([...prevData, newSession]);
        }
        return prevData;
      });
    } else {
      // 如果消息格式不正确，回退到API刷新
      fetchActiveSessions();
    }
  }, [deduplicateSessions, fetchActiveSessions]);

  // 处理会话结束消息 - 立即移除策略
  const handleSessionEnd = useCallback((message: WSMessage) => {
    const sessionId = message.data?.session_id || message.session_id;
    if (sessionId) {
      setData(prevData => {
        const exists = prevData.some(session => session.session_id === sessionId);
        if (exists) {
          console.log(`会话结束：${sessionId} (${message.data?.reason || '正常结束'})`);
          return prevData.filter(session => session.session_id !== sessionId);
        }
        console.log(`会话 ${sessionId} 已不在列表中，跳过移除操作`);
        return prevData;
      });
    } else {
      // 如果没有session_id，则刷新整个列表
      console.warn('收到会话结束消息但无session_id，执行全量刷新');
      fetchActiveSessions();
    }
  }, [fetchActiveSessions]);

  // 初始加载
  useEffect(() => {
    fetchActiveSessions();
  }, []);

  // WebSocket连接管理和重连后状态同步
  useEffect(() => {
    if (!wsConnected) {
      // 总是尝试连接WebSocket，不依赖data.length
      initWebSocket();
    }
  }, [wsConnected]);

  // WebSocket重连后同步状态
  useEffect(() => {
    if (wsConnected) {
      // WebSocket连接成功后，刷新会话列表确保状态一致
      const timer = setTimeout(() => {
        console.log('WebSocket重连成功，执行状态同步');
        fetchActiveSessions();
      }, 1000); // 延迟1秒确保连接完全建立

      return () => clearTimeout(timer);
    }
  }, [wsConnected, fetchActiveSessions]);

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
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => {
              setMirrorSession(record);
              setMirrorVisible(true);
            }}
          >
            监控
          </Button>
          <Button
            type="link"
            icon={<PoweroffOutlined />}
            danger
            size="small"
            onClick={() => {
              setSelectedSession(record);
              setTerminateVisible(true);
            }}
          >
            下线
          </Button>
        </Space>
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

      {/* 终端镜像模态框 */}
      <Modal
        title={`实时监控 - ${mirrorSession?.username}@${mirrorSession?.asset_name}`}
        open={mirrorVisible}
        onCancel={() => setMirrorVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMirrorVisible(false)}>
            关闭
          </Button>
        ]}
        width="80%"
        style={{ top: 20 }}
        bodyStyle={{ 
          padding: 0, 
          backgroundColor: '#000',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#f0f0f0', 
          borderBottom: '1px solid #d9d9d9',
          fontSize: '12px',
          color: '#666'
        }}>
          <Space split={<span>|</span>}>
            <span>会话ID: {mirrorSession?.session_id}</span>
            <span>开始时间: {mirrorSession?.start_time ? dayjs(mirrorSession.start_time).format('YYYY-MM-DD HH:mm:ss') : ''}</span>
            <span>状态: 只读监控</span>
          </Space>
        </div>
        
        <div style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          color: '#fff', 
          padding: '16px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: '14px',
          lineHeight: '1.4',
          overflow: 'auto'
        }}>
          {mirrorSession ? (
            <div>
              <div style={{ marginBottom: '16px', color: '#00ff00' }}>
                📺 正在实时监控会话...
              </div>
              <div style={{ color: '#888' }}>
                • 用户: {mirrorSession.username}<br/>
                • 主机: {mirrorSession.asset_name} ({mirrorSession.asset_address})<br/>
                • 协议: {mirrorSession.protocol?.toUpperCase()}<br/>
                • 系统用户: {'root'}<br/>
              </div>
              <div style={{ 
                marginTop: '24px', 
                padding: '16px',
                border: '1px solid #333',
                borderRadius: '4px',
                backgroundColor: '#111'
              }}>
                <div style={{ color: '#00ff00', marginBottom: '8px' }}>
                  [终端实时输出]
                </div>
                <div style={{ color: '#ccc', fontSize: '12px' }}>
                  此功能将显示会话的实时终端输出...<br/>
                  (需要连接到会话的WebSocket流)
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666' }}>
              请选择要监控的会话
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default OnlineSessionsTable;