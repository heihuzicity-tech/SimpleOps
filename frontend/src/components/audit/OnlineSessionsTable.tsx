import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
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
  CopyOutlined,
  FullscreenOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, ActiveSession, TerminateSessionRequest } from '../../services/auditAPI';
import { getWebSocketClient, WS_MESSAGE_TYPES, WSMessage } from '../../services/websocketClient';

import '@xterm/xterm/css/xterm.css';

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
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  
  // xterm.js 终端引用
  const mirrorTerminalRef = useRef<HTMLDivElement>(null);
  const mirrorTerminal = useRef<Terminal | null>(null);
  const mirrorFitAddon = useRef<FitAddon | null>(null);
  
  // 终端主题和配置
  const [terminalTheme, setTerminalTheme] = useState<'dark' | 'light'>('dark');
  const [terminalFontSize, setTerminalFontSize] = useState(13);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // WebSocket客户端
  const wsClient = getWebSocketClient();

  // 获取活跃会话列表
  const fetchActiveSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await AuditAPI.getActiveSessions({});
      
      if (response.success) {
        // 去重处理：基于session_id去除重复项
        // 使用统一的 PaginatedResult 格式
        const sessions = response.data.items || [];
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

      // 监听连接状态变化
      wsClient.onConnectionStateChange(setWsConnected);

    } catch (error) {
      console.error('WebSocket连接失败:', error);
      setWsConnected(false);
    }
  }, [wsClient]);

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

  // 初始化监控终端
  const initMirrorTerminal = useCallback(() => {
    if (!mirrorTerminalRef.current) {
      return null;
    }

    // 清理旧的终端实例
    if (mirrorTerminal.current) {
      mirrorTerminal.current.dispose();
    }

    // 动态主题配置
    const themes = {
      dark: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      light: {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#000000',
        selectionBackground: '#b3d4fc',
        black: '#000000',
        red: '#cd3131',
        green: '#008000',
        yellow: '#808000',
        blue: '#0000cd',
        magenta: '#cd00cd',
        cyan: '#008080',
        white: '#c0c0c0',
        brightBlack: '#808080',
        brightRed: '#ff0000',
        brightGreen: '#00ff00',
        brightYellow: '#ffff00',
        brightBlue: '#0000ff',
        brightMagenta: '#ff00ff',
        brightCyan: '#00ffff',
        brightWhite: '#ffffff'
      }
    };

    const term = new Terminal({
      theme: themes[terminalTheme],
      fontSize: terminalFontSize,
      fontFamily: 'Monaco, Menlo, "SF Mono", "Ubuntu Mono", "Courier New", monospace',
      lineHeight: 1.3,
      cursorBlink: false,
      allowTransparency: false,
      scrollback: 5000,
      disableStdin: true,
      rows: 28, // 减少行数为底部留出空间
      cols: 120,
      convertEol: true, // 转换换行符
      wordSeparator: ' ()[]{},\"\' \t\r\n', // 优化单词选择
      rightClickSelectsWord: true, // 右键选择单词
      scrollSensitivity: 5, // 提高滚动灵敏度
      fastScrollSensitivity: 10 // 快速滚动灵敏度
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    
    term.open(mirrorTerminalRef.current);
    
    // 延迟调整大小，确保DOM已完全渲染
    setTimeout(() => {
      fit.fit();
    }, 100);

    mirrorTerminal.current = term;
    mirrorFitAddon.current = fit;

    return term;
  }, [terminalTheme, terminalFontSize]);

  // 处理终端输出消息 - 实时显示终端数据
  const handleTerminalOutput = useCallback((message: WSMessage) => {
    const { session_id, output } = message.data;
    
    // 只处理当前监控的会话输出
    if (mirrorSession && session_id === mirrorSession.session_id) {
      // 如果有真实终端，写入终端
      if (mirrorTerminal.current && output) {
        mirrorTerminal.current.write(output);
      }
      
      // 同时保存到状态作为备用
      setTerminalOutput(prevOutput => {
        const newOutput = prevOutput + output;
        return newOutput.length > 10000 ? newOutput.slice(-8000) : newOutput;
      });
    }
  }, [mirrorSession]);

  // 处理终端大小调整
  const handleMirrorTerminalResize = useCallback(() => {
    if (mirrorFitAddon.current && mirrorTerminal.current) {
      setTimeout(() => {
        mirrorFitAddon.current?.fit();
      }, 100);
    }
  }, []);

  // 复制终端内容
  const copyTerminalContent = useCallback(() => {
    if (mirrorTerminal.current) {
      const selection = mirrorTerminal.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).then(() => {
          message.success('已复制选中内容');
        }).catch(err => {
          console.error('复制失败:', err);
          message.error('复制失败');
        });
      } else {
        // 如果没有选中内容，复制所有终端内容
        navigator.clipboard.writeText(terminalOutput).then(() => {
          message.success('已复制全部终端内容');
        }).catch(err => {
          console.error('复制失败:', err);
          message.error('复制失败');
        });
      }
    }
  }, [terminalOutput]);

  // 切换全屏模式
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    // 延迟调整终端大小
    setTimeout(() => {
      handleMirrorTerminalResize();
    }, 300);
  }, [handleMirrorTerminalResize]);

  // 初始加载
  useEffect(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  // 定时刷新会话列表（主要为了更新超时状态）
  useEffect(() => {
    const timer = setInterval(() => {
      fetchActiveSessions();
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(timer);
  }, [fetchActiveSessions]);

  // WebSocket连接管理和重连后状态同步
  useEffect(() => {
    if (!wsConnected) {
      // 总是尝试连接WebSocket，不依赖data.length
      initWebSocket();
    }
  }, [wsConnected, initWebSocket]);

  // WebSocket重连后同步状态
  useEffect(() => {
    if (wsConnected) {
      // WebSocket连接成功后，设置消息订阅
      wsClient.subscribe(WS_MESSAGE_TYPES.MONITORING_UPDATE, handleMonitoringUpdate);
      wsClient.subscribe(WS_MESSAGE_TYPES.SESSION_START, handleSessionStart);
      wsClient.subscribe(WS_MESSAGE_TYPES.SESSION_END, handleSessionEnd);
      wsClient.subscribe('terminal_output', handleTerminalOutput);

      // 刷新会话列表确保状态一致
      const timer = setTimeout(() => {
        console.log('WebSocket重连成功，执行状态同步');
        fetchActiveSessions();
      }, 1000); // 延迟1秒确保连接完全建立

      return () => clearTimeout(timer);
    }
  }, [wsConnected, wsClient, fetchActiveSessions, handleMonitoringUpdate, handleSessionStart, handleSessionEnd, handleTerminalOutput]);

  // 监控模态框窗口大小调整
  useEffect(() => {
    if (mirrorVisible) {
      const handleResize = () => handleMirrorTerminalResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [mirrorVisible, handleMirrorTerminalResize]);
  
  // 终端主题或字体大小变化时重新初始化
  useEffect(() => {
    if (mirrorVisible && mirrorSession) {
      // 延迟重新初始化，保持当前输出
      const currentOutput = terminalOutput;
      setTimeout(() => {
        const newTerminal = initMirrorTerminal();
        if (newTerminal && currentOutput) {
          newTerminal.write(currentOutput);
        }
      }, 100);
    }
  }, [terminalTheme, terminalFontSize]);

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
      title: '会话超时',
      key: 'session_timeout',
      width: 120,
      responsive: ['lg'],
      render: (_, record) => {
        // 从会话记录中获取超时信息
        const timeoutMinutes = record.timeout_minutes;
        const lastActivity = record.last_activity;
        
        if (!timeoutMinutes || timeoutMinutes === 0) {
          return <Tag color="blue">无限制</Tag>;
        }

        // 计算剩余时间
        const now = dayjs();
        const lastActivityTime = dayjs(lastActivity || record.start_time);
        const timeoutTime = lastActivityTime.add(timeoutMinutes, 'minute');
        const remainingMinutes = timeoutTime.diff(now, 'minute');

        if (remainingMinutes <= 0) {
          return <Tag color="red">已超时</Tag>;
        } else if (remainingMinutes <= 5) {
          return (
            <Tag color="orange">
              剩余 {remainingMinutes}分钟
            </Tag>
          );
        } else if (remainingMinutes <= 15) {
          return (
            <Tag color="yellow">
              剩余 {remainingMinutes < 60 ? `${remainingMinutes}分钟` : `${Math.floor(remainingMinutes / 60)}小时${remainingMinutes % 60}分钟`}
            </Tag>
          );
        } else {
          const hours = Math.floor(remainingMinutes / 60);
          const minutes = remainingMinutes % 60;
          const timeStr = hours > 0 
            ? (minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`)
            : `${remainingMinutes}分钟`;
          return <Tag color="green">剩余 {timeStr}</Tag>;
        }
      },
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
              setTerminalOutput(''); // 清空之前的输出
              setMirrorVisible(true);
              // 延迟初始化终端，确保模态框已显示
              setTimeout(() => {
                initMirrorTerminal();
              }, 200);
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

      {/* 终端镜像模态框 - 优化版本 */}
      <Modal
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            fontSize: '14px'
          }}>
            <span>
              📺 实时监控 - {mirrorSession?.username}@{mirrorSession?.asset_name}
            </span>
            <Button 
              type="text" 
              size="small" 
              onClick={handleMirrorTerminalResize}
              style={{ fontSize: '12px' }}
            >
              🔄 调整大小
            </Button>
          </div>
        }
        open={mirrorVisible}
        onCancel={() => {
          if (mirrorTerminal.current) {
            mirrorTerminal.current.dispose();
            mirrorTerminal.current = null;
          }
          setMirrorVisible(false);
          setMirrorSession(null);
          setTerminalOutput('');
        }}
        footer={[
          <div key="footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <span style={{ fontSize: '12px', color: '#666' }}>
                💡 提示: 双击选择单词，右键选择整行，Ctrl+A全选
              </span>
            </Space>
            <Space>
              <Button size="small" onClick={() => {
                if (mirrorTerminal.current) {
                  mirrorTerminal.current.clear();
                }
                setTerminalOutput('');
              }}>
                清空屏幕
              </Button>
              <Button onClick={() => {
                if (mirrorTerminal.current) {
                  mirrorTerminal.current.dispose();
                  mirrorTerminal.current = null;
                }
                setMirrorVisible(false);
                setMirrorSession(null);
                setTerminalOutput('');
                setIsFullscreen(false);
              }}>
                关闭
              </Button>
            </Space>
          </div>
        ]}
        width={isFullscreen ? '95%' : '85%'}
        style={{ top: isFullscreen ? 5 : 10 }}
        styles={{
          body: { 
            padding: 0, 
            backgroundColor: terminalTheme === 'dark' ? '#1e1e1e' : '#ffffff',
            height: isFullscreen ? 'calc(100vh - 80px)' : 'calc(100vh - 150px)',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        destroyOnHidden={true}
      >
        {/* 压缩的会话信息条 */}
        <div style={{ 
          padding: '6px 12px', 
          backgroundColor: terminalTheme === 'dark' ? '#2d2d2d' : '#f5f5f5', 
          borderBottom: '1px solid #d9d9d9',
          fontSize: '11px',
          color: terminalTheme === 'dark' ? '#ccc' : '#666',
          lineHeight: '1.2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space split={<span style={{ color: '#ccc' }}>|</span>} size={8}>
            <span><strong>会话:</strong> {mirrorSession?.session_id?.slice(-8) || 'N/A'}</span>
            <span><strong>时间:</strong> {mirrorSession?.start_time ? dayjs(mirrorSession.start_time).format('HH:mm:ss') : 'N/A'}</span>
            <span><strong>协议:</strong> {mirrorSession?.protocol?.toUpperCase() || 'SSH'}</span>
            <span style={{ color: '#52c41a' }}><strong>状态:</strong> 实时监控中</span>
          </Space>
          
          <Space size={4}>
            <span style={{ fontSize: '10px' }}>主题:</span>
            <Button 
              size="small" 
              type={terminalTheme === 'dark' ? 'primary' : 'default'}
              onClick={() => setTerminalTheme('dark')}
              style={{ padding: '0 6px', height: '20px', fontSize: '10px' }}
            >
              深色
            </Button>
            <Button 
              size="small" 
              type={terminalTheme === 'light' ? 'primary' : 'default'}
              onClick={() => setTerminalTheme('light')}
              style={{ padding: '0 6px', height: '20px', fontSize: '10px' }}
            >
              浅色
            </Button>
            <span style={{ fontSize: '10px', marginLeft: '8px' }}>字号:</span>
            <Button 
              size="small" 
              onClick={() => setTerminalFontSize(prev => Math.max(10, prev - 1))}
              style={{ padding: '0 4px', height: '20px', fontSize: '10px' }}
            >
              -
            </Button>
            <span style={{ fontSize: '10px', width: '20px', textAlign: 'center' }}>{terminalFontSize}</span>
            <Button 
              size="small" 
              onClick={() => setTerminalFontSize(prev => Math.min(20, prev + 1))}
              style={{ padding: '0 4px', height: '20px', fontSize: '10px' }}
            >
              +
            </Button>
          </Space>
        </div>
        
        {/* 真实的xterm.js终端容器 */}
        <div style={{ 
          flex: 1, 
          backgroundColor: terminalTheme === 'dark' ? '#1e1e1e' : '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${terminalTheme === 'dark' ? '#333' : '#d9d9d9'}`,
          minHeight: 0 // 重要: 确保flex布局正确工作
        }}>
          <div
            ref={mirrorTerminalRef}
            style={{
              width: '100%',
              height: '100%',
              padding: '12px 16px 32px 16px', // 关键修复: 增加底部padding(32px)避免截断
              boxSizing: 'border-box',
              backgroundColor: terminalTheme === 'dark' ? '#1e1e1e' : '#ffffff',
              overflow: 'hidden' // 让xterm.js处理滚动
            }}
          />
          
          {/* 初始化提示 */}
          {!mirrorTerminal.current && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#666',
              textAlign: 'center',
              fontSize: '13px'
            }}>
              <div style={{ marginBottom: '8px', color: terminalTheme === 'dark' ? '#00ff00' : '#007acc' }}>
                🔄 正在初始化终端监控...
              </div>
              <div style={{ fontSize: '11px' }}>
                {mirrorSession ? (
                  <>
                    监控目标: {mirrorSession.username}@{mirrorSession.asset_name}<br/>
                    <small>实时终端输出将在此显示</small>
                  </>
                ) : (
                  '请等待会话连接'
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default OnlineSessionsTable;