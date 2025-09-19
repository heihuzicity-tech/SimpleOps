import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { message as antMessage, Spin, Alert, Button, Space, Modal, notification } from 'antd';
import { ReloadOutlined, DisconnectOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { updateConnectionStatus } from '../../store/workspaceSlice';
import { sshAPI } from '../../services/sshAPI';
import { WSMessage } from '../../types/ssh';
import { TabInfo } from '../../types/workspace';
import { useActivityDetector } from '../../hooks/useActivityDetector';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';

import '@xterm/xterm/css/xterm.css';

// 定义本地的连接状态类型，匹配workspace中的TabInfo
type WorkspaceConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'error';

interface WorkspaceTerminalProps {
  tab: TabInfo;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

const WorkspaceTerminal: React.FC<WorkspaceTerminalProps> = ({
  tab,
  onReconnect,
  onDisconnect
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const websocket = useRef<WebSocket | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  
  const [localConnectionStatus, setLocalConnectionStatus] = useState<WorkspaceConnectionStatus>(tab.connectionStatus);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const maxReconnectAttempts = 5;
  const [isConnecting, setIsConnecting] = useState(false);

  // 超时管理Hook
  const {
    status: timeoutStatus,
    hasTimeout,
    isExpiring,
    remainingMinutes,
    formatRemainingTime,
    extendSession,
    updateActivity
  } = useSessionTimeout({
    sessionId: tab.sessionId || '',
    onTimeoutWarning: (minutesLeft) => {
      // 显示超时警告通知
      notification.warning({
        key: `timeout-warning-${tab.id}`,
        message: '会话即将超时',
        description: `会话将在${minutesLeft}分钟后自动断开，如需继续使用请点击延长会话。`,
        placement: 'topRight',
        duration: 0,
        btn: (
          <Space>
            <Button size="small" onClick={() => {
              extendSession(30);
              notification.destroy(`timeout-warning-${tab.id}`);
            }}>
              延长30分钟
            </Button>
            <Button size="small" type="link" onClick={() => {
              notification.destroy(`timeout-warning-${tab.id}`);
            }}>
              忽略
            </Button>
          </Space>
        )
      });
    },
    onTimeout: () => {
      // 会话超时，显示通知并断开连接
      notification.error({
        message: '会话已超时',
        description: '会话已自动断开，请重新建立连接。',
        placement: 'topRight'
      });
      handleDisconnect();
    },
    onError: (error) => {
      console.warn('Session timeout error:', error);
    }
  });

  // 活动检测Hook
  const { triggerActivity } = useActivityDetector({
    sessionId: tab.sessionId || '',
    onActivity: (activity) => {
      // 有活动时更新服务端的活动时间
      if (activity.isActive) {
        updateActivity();
      }
    },
    throttleMs: 2000, // 2秒节流
    enableMouseTracking: true,
    enableKeyboardTracking: true
  });

  // 更新连接状态
  const updateStatus = useCallback((status: WorkspaceConnectionStatus, error?: string) => {
    setLocalConnectionStatus(status);
    dispatch(updateConnectionStatus({
      tabId: tab.id,
      status,
      error
    }));
    if (error) {
      setLastError(error);
    }
  }, [dispatch, tab.id]);

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) {
      console.error('Terminal container not found');
      return null;
    }

    // 清理旧的终端实例
    if (terminal.current) {
      terminal.current.dispose();
    }

    const term = new Terminal({
      theme: {
        background: '#1f1f1f',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)'
      },
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      lineHeight: 1.4, // 增加行高，提升可读性
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 1000, // 统一限制scrollback为1000行
      rows: 20, // 减少到20行，为底部留出空间
      cols: 80
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    
    term.open(terminalRef.current);
    fit.fit();

    terminal.current = term;
    fitAddon.current = fit;

    return term;
  }, []);

  // 连接WebSocket
  const connectWebSocket = useCallback(() => {
    if (!tab.sessionId) {
      setLastError('无有效的会话ID');
      updateStatus('error', '无有效的会话ID');
      return;
    }

    setIsConnecting(true);
    updateStatus('connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ssh/ws/${tab.sessionId}`;
      
      const ws = new WebSocket(wsUrl);
      websocket.current = ws;

      ws.onopen = () => {
        console.log('WebSocket连接已建立');
        setIsConnecting(false);
        setReconnectAttempts(0);
        setLastError(null);
        updateStatus('connected');
        
        // 发送初始化消息
        if (terminal.current) {
          const initMessage: WSMessage = {
            type: 'resize',
            rows: terminal.current.rows,
            cols: terminal.current.cols
          };
          ws.send(JSON.stringify(initMessage));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'output':
              if (terminal.current && message.data) {
                terminal.current.write(message.data);
              }
              break;
            
            case 'error':
              console.error('SSH错误:', message.data);
              setLastError(message.data || '连接出现错误');
              updateStatus('error', message.data);
              break;
            
            case 'force_terminate':
              {
                // 🔧 修复：只有当前会话ID匹配时才处理强制终止消息
                const messageSessionId = message.data?.session_id || message.session_id;
                console.log('🔧 工作台收到force_terminate消息:', {
                  messageSessionId,
                  currentSessionId: tab.sessionId,
                  message: message
                });
                
                if (messageSessionId && messageSessionId === tab.sessionId) {
                  const reason = message.data?.reason || '无具体原因';
                  const admin_user = message.data?.admin_user || '未知管理员';
                  
                  console.log(`工作台终端 ${tab.sessionId} 收到强制终止消息，执行关闭`);
                  
                  Modal.warning({
                    title: '会话已被强制终止',
                    content: (
                      <div>
                        <p><strong>会话ID:</strong> {messageSessionId}</p>
                        <p><strong>操作管理员:</strong> {admin_user}</p>
                        <p><strong>终止原因:</strong> {reason}</p>
                        <p>您的连接已被管理员强制关闭。</p>
                      </div>
                    ),
                    onOk: () => {
                      onDisconnect?.();
                    },
                    okText: '确认',
                    maskClosable: false,
                  });
                } else {
                  console.log(`工作台终端 ${tab.sessionId} 收到其他会话 ${messageSessionId} 的强制终止消息，忽略处理`);
                }
              }
              break;
              
            case 'warning':
              {
                const warning_message = message.data || '管理员警告';
                antMessage.warning(warning_message, 5);
              }
              break;
            case 'alert':
              {
                const alert_message = message.data || '系统通知';
                antMessage.info(alert_message, 5);
              }
              break;
            
            case 'close':
              console.log('SSH连接已关闭');
              updateStatus('disconnected');
              break;
          }
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket错误:', event);
        setLastError('WebSocket连接错误');
        updateStatus('error', 'WebSocket连接错误');
      };

      ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        setIsConnecting(false);
        
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts) * 1000; // 指数退避
          console.log(`${delay}ms后尝试重连...`);
          
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, delay);
        } else {
          updateStatus('disconnected');
          if (reconnectAttempts >= maxReconnectAttempts) {
            setLastError('重连次数已达上限');
          }
        }
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      setIsConnecting(false);
      updateStatus('error', '创建WebSocket连接失败');
    }
  }, [tab.sessionId, reconnectAttempts, updateStatus]);

  // 发送输入到服务器
  const sendInput = useCallback((data: string) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type: 'input',
        data
      };
      websocket.current.send(JSON.stringify(message));
      
      // 触发活动检测
      triggerActivity('keyboard');
    }
  }, [triggerActivity]);

  // 处理终端大小调整
  const handleResize = useCallback(() => {
    if (fitAddon.current && terminal.current) {
      fitAddon.current.fit();
      
      if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
        const message: WSMessage = {
          type: 'resize',
          rows: terminal.current.rows,
          cols: terminal.current.cols
        };
        websocket.current.send(JSON.stringify(message));
      }
    }
  }, []);

  // 手动重连
  const handleReconnect = useCallback(() => {
    setReconnectAttempts(0);
    setLastError(null);
    
    // 关闭旧连接
    if (websocket.current) {
      websocket.current.close();
    }
    
    // 重新连接
    connectWebSocket();
    onReconnect?.();
  }, [connectWebSocket, onReconnect]);

  // 手动断开
  const handleDisconnect = useCallback(() => {
    console.log('用户手动断开连接，会话ID:', tab.sessionId);
    if (websocket.current) {
      // 发送关闭通知消息给后端
      try {
        const closeMessage: WSMessage = {
          type: 'close',
          data: { reason: '用户主动关闭标签页' }
        };
        websocket.current.send(JSON.stringify(closeMessage));
      } catch (error) {
        console.warn('发送关闭通知失败:', error);
      }
      websocket.current.close(1000, '用户主动断开');
    }
    updateStatus('disconnected');
    onDisconnect?.();
  }, [updateStatus, onDisconnect, tab.sessionId]);

  // 页面卸载事件处理
  const handleBeforeUnload = useCallback(() => {
    console.log('页面即将卸载，准备清理会话:', tab.sessionId);
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      try {
        const closeMessage: WSMessage = {
          type: 'close',
          data: { reason: '页面卸载' }
        };
        websocket.current.send(JSON.stringify(closeMessage));
      } catch (error) {
        console.warn('页面卸载时发送关闭通知失败:', error);
      }
    }
  }, [tab.sessionId]);

  // 初始化
  useEffect(() => {
    if (!tab.sessionId) {
      setLastError('等待会话创建...');
      return;
    }

    const term = initTerminal();
    if (!term) return;

    // 绑定输入事件
    const disposable = term.onData(sendInput);

    // 窗口大小调整监听
    window.addEventListener('resize', handleResize);
    
    // 页面卸载事件监听
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 建立连接
    connectWebSocket();

    return () => {
      disposable?.dispose();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (websocket.current) {
        // 组件卸载时主动发送关闭通知
        try {
          if (websocket.current.readyState === WebSocket.OPEN) {
            const closeMessage: WSMessage = {
              type: 'close',
              data: { reason: '组件卸载' }
            };
            websocket.current.send(JSON.stringify(closeMessage));
          }
        } catch (error) {
          console.warn('组件卸载时发送关闭通知失败:', error);
        }
        websocket.current.close(1000, '组件卸载');
      }
      
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, [tab.sessionId, initTerminal, sendInput, handleResize, connectWebSocket, handleBeforeUnload]);

  // 处理标签页激活时的大小调整
  useEffect(() => {
    const timer = setTimeout(handleResize, 100);
    return () => clearTimeout(timer);
  }, [handleResize]);

  // 渲染连接状态指示器
  const renderStatusIndicator = () => {
    switch (localConnectionStatus) {
      case 'connecting':
        return (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '200px',
            flexDirection: 'column',
            gap: 16
          }}>
            <Spin size="large" tip="正在建立连接...">
              <div />
            </Spin>
            <div style={{ textAlign: 'center' }}>
              <p>连接到 {tab.assetInfo.name}</p>
              <p style={{ color: '#666', fontSize: '12px' }}>
                {tab.assetInfo.address}:{tab.assetInfo.port}
              </p>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div style={{ padding: '20px' }}>
            <Alert
              message="连接失败"
              description={lastError || '无法连接到目标主机'}
              type="error"
              showIcon
              action={
                <Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleReconnect}>
                    重试
                  </Button>
                  <Button size="small" icon={<DisconnectOutlined />} onClick={handleDisconnect}>
                    断开
                  </Button>
                </Space>
              }
            />
          </div>
        );
      
      case 'disconnected':
        return (
          <div style={{ padding: '20px' }}>
            <Alert
              message="连接已断开"
              description="与目标主机的连接已断开"
              type="warning"
              showIcon
              action={
                <Button size="small" icon={<ReloadOutlined />} onClick={handleReconnect}>
                  重新连接
                </Button>
              }
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  // 如果连接状态异常，显示状态指示器
  if (localConnectionStatus !== 'connected') {
    return renderStatusIndicator();
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* 超时状态显示 */}
      {hasTimeout && isExpiring && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1000,
          background: 'rgba(255, 193, 7, 0.9)',
          color: '#000',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <ClockCircleOutlined />
          <span>剩余 {formatRemainingTime(remainingMinutes)}</span>
          <Button 
            size="small" 
            type="link" 
            style={{ padding: '0 4px', height: 'auto', fontSize: '12px' }}
            onClick={() => extendSession(30)}
          >
            延长
          </Button>
        </div>
      )}
      
      <div
        style={{
          height: '100%',
          width: '100%',
          padding: '8px',
          backgroundColor: '#1f1f1f',
          boxSizing: 'border-box'
        }}
      >
        <div
          ref={terminalRef}
          style={{
            height: 'calc(100% - 40px)', // 减去40px为底部留空间
            width: '100%',
            backgroundColor: '#1f1f1f'
          }}
        />
      </div>
    </div>
  );
};

export default WorkspaceTerminal;