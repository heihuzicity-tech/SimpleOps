import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { message, Tag } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { setConnectionStatus, updateSessionStatus } from '../../store/sshSessionSlice';
import { sshAPI } from '../../services/sshAPI';
import { WSMessage, ConnectionStatus } from '../../types/ssh';
import '@xterm/xterm/css/xterm.css';

// const { Text } = Typography; // 暂时未使用

interface WebTerminalProps {
  sessionId: string;
  onClose: () => void;
  onError?: (error: Error) => void;
  showHeader?: boolean; // 是否显示头部
  style?: React.CSSProperties;
}

const WebTerminal: React.FC<WebTerminalProps> = ({
  sessionId,
  onClose,
  onError,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const websocket = useRef<WebSocket | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  
  const [connectionStatus, setLocalConnectionStatus] = useState<ConnectionStatus>('disconnected');
  // const [isFullscreen, setIsFullscreen] = useState(false); // 暂时未使用
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const [isConnecting, setIsConnecting] = useState(false);

  // 更新连接状态
  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setLocalConnectionStatus(status);
    dispatch(setConnectionStatus({ sessionId, status }));
  }, [dispatch, sessionId]);

  // 初始化终端 - 移除useCallback避免依赖问题
  const initTerminal = () => {
    if (!terminalRef.current) {
      console.error('Terminal container not found');
      return null;
    }

    // 防止重复初始化
    if (terminal.current) {
      console.log('Terminal already initialized');
      return terminal.current;
    }

    try {
      // 创建终端实例
      terminal.current = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          selectionBackground: '#264f78',
        },
        scrollback: 1000,
        tabStopWidth: 4,
        cols: 80,
        rows: 24,
      });

      // 添加插件
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.loadAddon(new WebLinksAddon());

      // 挂载到DOM
      terminal.current.open(terminalRef.current);
      
      // 等待DOM更新后再调用fit
      setTimeout(() => {
        if (fitAddon.current && terminal.current) {
          fitAddon.current.fit();
        }
      }, 10);

      // 监听数据输入
      terminal.current.onData((data) => {
        if (websocket.current?.readyState === WebSocket.OPEN) {
          const message: WSMessage = {
            type: 'input',
            data: data,
          };
          websocket.current.send(JSON.stringify(message));
        }
      });

      // 监听终端大小变化
      terminal.current.onResize(({ cols, rows }) => {
        if (websocket.current?.readyState === WebSocket.OPEN) {
          const message: WSMessage = {
            type: 'resize',
            cols,
            rows,
          };
          websocket.current.send(JSON.stringify(message));
        }
      });

      console.log('Terminal initialized successfully');
      return terminal.current;
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      return null;
    }
  };

  // 连接WebSocket
  const connectWebSocket = useCallback(() => {
    if (!terminal.current) {
      console.error('Terminal not initialized, cannot connect WebSocket');
      return;
    }

    // 如果正在连接，不要重复连接
    if (isConnecting) {
      console.log('WebSocket connection already in progress, skipping...');
      return;
    }

    // 如果已有连接且处于连接状态，不要重复连接
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping...');
      return;
    }

    // 如果已有连接，先关闭
    if (websocket.current) {
      websocket.current.close();
      websocket.current = null;
    }

    setIsConnecting(true);
    updateConnectionStatus('connecting');
    
    try {
      const wsUrl = sshAPI.getWebSocketURL(sessionId);
      console.log('Connecting to WebSocket:', wsUrl);
      
      websocket.current = new WebSocket(wsUrl);

      websocket.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnecting(false);
        updateConnectionStatus('connected');
        setReconnectAttempts(0);
        // ✅ 修复：移除WebSocket连接成功的消息，由页面统一处理
        // message.success('SSH连接已建立', 2);
        
        // 发送初始终端大小
        if (terminal.current && fitAddon.current) {
          setTimeout(() => {
            if (fitAddon.current && terminal.current) {
              try {
                fitAddon.current.fit();
                const { cols, rows } = terminal.current;
                const resizeMessage: WSMessage = {
                  type: 'resize',
                  cols,
                  rows,
                };
                websocket.current?.send(JSON.stringify(resizeMessage));
                console.log(`Terminal size sent: ${cols}x${rows}`);
                
                // ✅ 修复：不发送初始化命令，让后端处理
                // 不需要前端发送初始化命令，后端会处理
                console.log('WebSocket connected, terminal ready');
              } catch (error) {
                console.error('Failed to send terminal size:', error);
              }
            }
          }, 50); // 减少延迟从100ms到50ms
        }
      };

      websocket.current.onmessage = (event) => {
        try {
          const wsMessage: WSMessage = JSON.parse(event.data);
          
          switch (wsMessage.type) {
            case 'output':
              if (wsMessage.data && terminal.current) {
                terminal.current.write(wsMessage.data);
              }
              break;
            case 'error':
              console.error('Terminal error:', wsMessage.error);
              message.error(wsMessage.error || 'Terminal error');
              break;
            case 'pong':
              // 心跳响应
              break;
            default:
              console.warn('Unknown message type:', wsMessage.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnecting(false);
        updateConnectionStatus('disconnected');
        
        // ✅ 修复：检查关闭原因，避免组件卸载时的重连
        const isNormalClose = event.code === 1000 || event.code === 1001;
        const isComponentUnmounting = event.reason === 'Component unmounting';
        
        if (isNormalClose || isComponentUnmounting) {
          // 正常关闭或组件卸载，不要重连
          console.log('WebSocket closed normally, not reconnecting');
          dispatch(updateSessionStatus({ sessionId, status: 'closed' }));
          return;
        }
        
        // 只有在非正常关闭且重连次数未超限时才重连
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`WebSocket will reconnect in ${Math.pow(2, reconnectAttempts) * 1000}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            updateConnectionStatus('reconnecting');
            connectWebSocket();
          }, Math.pow(2, reconnectAttempts) * 1000); // 指数退避
        } else {
          message.error('连接已断开，重连次数超限');
          dispatch(updateSessionStatus({ sessionId, status: 'closed' }));
        }
      };

      websocket.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        updateConnectionStatus('error');
        message.error('WebSocket连接失败');
        onError?.(new Error('WebSocket连接错误'));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
      updateConnectionStatus('error');
      onError?.(error as Error);
    }
  }, [sessionId, updateConnectionStatus, onError, isConnecting]);

  // 窗口大小变化时重新调整终端大小
  const handleResize = useCallback(() => {
    if (fitAddon.current) {
      setTimeout(() => {
        fitAddon.current?.fit();
      }, 100);
    }
  }, []);

  // 切换全屏模式 - 暂时未使用
  // const toggleFullscreen = useCallback(() => {
  //   setIsFullscreen(prev => !prev);
  //   setTimeout(() => {
  //     handleResize();
  //   }, 100);
  // }, [handleResize]);

  // 关闭终端 - 暂时未使用
  // const handleClose = useCallback(async () => {
  //   try {
  //     // 关闭WebSocket连接
  //     if (websocket.current) {
  //       websocket.current.close(1000);
  //       websocket.current = null;
  //     }

  //     // 关闭会话
  //     await sshAPI.closeSession(sessionId);
      
  //     onClose();
  //   } catch (error) {
  //     console.error('Failed to close session:', error);
  //     onClose(); // 即使关闭失败也要清理UI
  //   }
  // }, [sessionId, onClose]);

  // 发送心跳
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (websocket.current?.readyState === WebSocket.OPEN) {
        const message: WSMessage = { type: 'ping' };
        websocket.current.send(JSON.stringify(message));
      }
    }, 30000); // 30秒心跳

    return () => clearInterval(heartbeat);
  }, []);

  // 窗口大小变化监听
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // 组件挂载时初始化
  useEffect(() => {
    let isComponentMounted = true;
    let initializationComplete = false;
    
    // 确保DOM已经渲染
    const initializeTerminal = async () => {
      // 防止重复初始化
      if (initializationComplete) {
        console.log('Terminal already initialized, skipping...');
        return;
      }
      
      // 等待DOM元素可用
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (!isComponentMounted) return;
      
      const term = initTerminal();
      if (term && isComponentMounted) {
        console.log('Terminal initialized, waiting before WebSocket connection...');
        initializationComplete = true;
        
        // 等待终端完全渲染后再建立WebSocket连接
        setTimeout(() => {
          if (isComponentMounted && !websocket.current && !isConnecting) {
            connectWebSocket();
          }
        }, 200);
      } else {
        console.error('Failed to initialize terminal');
        if (isComponentMounted) {
          updateConnectionStatus('error');
        }
      }
    };

    initializeTerminal();

    return () => {
      isComponentMounted = false;
      initializationComplete = false;
      console.log('Cleaning up WebTerminal component...');
      
      // 清理资源
      if (websocket.current) {
        websocket.current.close(1000, 'Component unmounting');
        websocket.current = null;
      }
      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
      if (fitAddon.current) {
        fitAddon.current = null;
      }
    };
  }, [sessionId]); // ✅ 修复：移除函数依赖，只依赖sessionId

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'processing';
      case 'reconnecting': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected': return '已连接';
      case 'connecting': return '连接中...';
      case 'reconnecting': return `重连中... (${reconnectAttempts}/${maxReconnectAttempts})`;
      case 'error': return '连接错误';
      default: return '未连接';
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e1e',
        position: 'relative',
      }}
    >
      {/* 状态条 */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 16,
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '4px 12px',
        borderRadius: 4,
      }}>
        <Tag color={getStatusColor(connectionStatus)}>
          {getStatusText(connectionStatus)}
        </Tag>
      </div>
      
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          background: '#1e1e1e',
        }}
      />
    </div>
  );
};

export default WebTerminal;