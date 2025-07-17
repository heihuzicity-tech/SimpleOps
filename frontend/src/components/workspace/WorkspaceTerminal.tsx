import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { message, Spin, Alert, Button, Space } from 'antd';
import { ReloadOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { updateConnectionStatus } from '../../store/workspaceSlice';
import { sshAPI } from '../../services/sshAPI';
import { WSMessage } from '../../types/ssh';
import { TabInfo } from '../../types/workspace';

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
      cursorBlink: true,
      allowTransparency: true,
      rows: 24,
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
    }
  }, []);

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
    if (websocket.current) {
      websocket.current.close(1000, '用户主动断开');
    }
    updateStatus('disconnected');
    onDisconnect?.();
  }, [updateStatus, onDisconnect]);

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

    // 建立连接
    connectWebSocket();

    return () => {
      disposable?.dispose();
      window.removeEventListener('resize', handleResize);
      
      if (websocket.current) {
        websocket.current.close();
      }
      
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, [tab.sessionId, initTerminal, sendInput, handleResize, connectWebSocket]);

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
            <Spin size="large" tip="正在建立连接..." />
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
      <div
        ref={terminalRef}
        style={{
          height: '100%',
          width: '100%',
          padding: '8px',
          backgroundColor: '#1f1f1f'
        }}
      />
    </div>
  );
};

export default WorkspaceTerminal;