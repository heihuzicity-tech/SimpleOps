import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  List, 
  Space, 
  Empty,
} from 'antd';
import { 
  CodeOutlined,
} from '@ant-design/icons';
import { RecordingResponse } from '../../services/recordingAPI';

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);


interface Command {
  id: string;
  timestamp: number;
  content: string;
  fullCommand: string;
  line: number;
}

interface CommandTimelineProps {
  recording: RecordingResponse;
  recordingData: string;
  onSeekTo: (time: number) => void;
}

const CommandTimeline: React.FC<CommandTimelineProps> = ({
  recording,
  recordingData,
  onSeekTo,
}) => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);

  // 解析录制数据并提取命令
  useEffect(() => {
    if (recordingData) {
      extractCommands();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingData]);

  const extractCommands = useCallback(() => {
    setLoading(true);
    
    try {
      console.log('开始解析录制数据，数据长度:', recordingData.length);
      
      const lines = recordingData.split('\n').filter(line => line.trim());
      console.log('总行数:', lines.length);
      
      if (lines.length < 2) {
        console.warn('数据行数不足');
        setCommands([]);
        setLoading(false);
        return;
      }

      // 解析头部
      let header;
      try {
        header = JSON.parse(lines[0]);
        console.log('头部信息:', header);
      } catch (e) {
        console.error('头部解析失败:', e);
        setCommands([]);
        setLoading(false);
        return;
      }

      // 解析事件数据
      const events = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          
          // 处理不同的数据格式
          let eventData;
          if (Array.isArray(parsed)) {
            // 标准 asciinema v2 格式: [timestamp, type, data]
            eventData = {
              timestamp: parsed[0],
              type: parsed[1],
              data: parsed[2],
              lineIndex: i
            };
          } else if (parsed.time !== undefined && parsed.type !== undefined && parsed.data !== undefined) {
            // 自定义格式: {time, type, data}
            eventData = {
              timestamp: parsed.time,
              type: parsed.type === 'input' ? 'i' : 'o',
              data: parsed.data,
              lineIndex: i
            };
          } else {
            console.warn(`第${i}行格式未知:`, parsed);
            continue;
          }
          
          events.push(eventData);
          
          // 记录前几个事件用于调试
          if (i <= 5) {
            console.log(`第${i}行事件:`, eventData);
          }
        } catch (e) {
          console.warn(`第${i}行解析失败:`, lines[i].substring(0, 50));
        }
      }

      console.log('解析出的事件总数:', events.length);

      // 简单的命令提取逻辑
      const extractedCommands: Command[] = [];
      let currentCommand = '';
      let commandStartTime = 0;
      let commandIndex = 0;
      
      events.forEach((event) => {
        if (event.type === 'i') {
          const data = event.data.toString();
          
          if (data.includes('\r') || data.includes('\n') || data === '\x0d') {
            // 命令结束
            if (currentCommand.trim().length > 0) {
              // 基本清理
              const cleaned = currentCommand
                .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
                .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
                .trim();
              
              // 检查是否是有效命令
              if (isValidCommand(cleaned)) {
                extractedCommands.push({
                  id: `cmd-${commandIndex}`,
                  timestamp: commandStartTime,
                  content: cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned,
                  fullCommand: cleaned,
                  line: event.lineIndex,
                });
                
                console.log(`提取命令 #${commandIndex + 1}: "${cleaned}"`);
                commandIndex++;
              }
            }
            currentCommand = '';
            commandStartTime = event.timestamp;
          } else {
            // 累积命令
            if (currentCommand === '') {
              commandStartTime = event.timestamp;
            }
            currentCommand += data;
          }
        }
      });
      
      console.log('提取的命令数量:', extractedCommands.length);
      setCommands(extractedCommands);
      
    } catch (error) {
      console.error('提取命令失败:', error);
      setCommands([]);
    } finally {
      setLoading(false);
    }
  }, [recordingData]);

  // 判断是否是有效命令
  const isValidCommand = (command: string): boolean => {
    const trimmed = command.trim();
    
    // 基本长度检查
    if (trimmed.length === 0) return false;
    
    // 常见命令模式
    const validPatterns = [
      /^[a-zA-Z][a-zA-Z0-9_-]*/, // 以字母开头的命令
      /^\/[a-zA-Z0-9_/-]+/, // 路径
      /^\.\.?$/, // . 或 ..
      /^cd\s+/, // cd 命令
      /^ls\b/, // ls 命令
      /^pwd$/, // pwd 命令
      /^docker\s+/, // docker 命令
      /^cat\s+/, // cat 命令
      /^mkdir\s+/, // mkdir 命令
      /^rm\s+/, // rm 命令
    ];
    
    return validPatterns.some(pattern => pattern.test(trimmed));
  };

  // 格式化时间显示 (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 跳转到指定命令
  const handleCommandClick = (command: Command) => {
    onSeekTo(command.timestamp);
  };

  return (
    <Card
      title={
        <Space>
          <CodeOutlined />
          <span>Commands ({commands.length})</span>
        </Space>
      }
      size="small"
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#2d2d2d',
        border: '1px solid #404040',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
      headStyle={{
        backgroundColor: '#3d3d3d',
        color: '#ffffff',
        borderBottom: '1px solid #404040',
        borderRadius: '4px 4px 0 0',
        fontSize: '16px',
        fontWeight: 500,
      }}
      bodyStyle={{ 
        flex: 1, 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#2d2d2d',
        padding: 0,
      }}
    >
      {/* 命令时间轴列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#8c8c8c',
            fontSize: '13px'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderTop: '2px solid #1890ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }} />
            </div>
            解析命令中...
          </div>
        ) : commands.length > 0 ? (
          <List
            size="small"
            dataSource={commands}
            renderItem={(command, index) => {
              return (
                <List.Item
                  key={command.id}
                  style={{ 
                    padding: '8px 16px',
                    margin: 0,
                    borderBottom: '1px solid #404040',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s',
                    minHeight: '44px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#3d3d3d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => handleCommandClick(command)}
                >
                  {/* 单行布局：命令内容 + 时间 */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    width: '100%',
                    gap: '12px',
                  }}>
                    
                    {/* 命令内容 */}
                    <div
                      style={{
                        color: '#ffffff',
                        fontFamily: 'Monaco, "Courier New", monospace',
                        fontSize: '14px',
                        flex: 1,
                        marginRight: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={command.fullCommand}
                    >
                      {command.content}
                    </div>

                    {/* 时间戳 */}
                    <div
                      style={{
                        color: '#888888',
                        fontFamily: 'Monaco, "Courier New", monospace',
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(command.timestamp)}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ 
                color: '#8c8c8c',
                fontSize: '13px'
              }}>
                未检测到命令执行记录
              </span>
            }
            style={{ 
              marginTop: '80px',
              filter: 'invert(1) opacity(0.3)',
            }}
          />
        )}
      </div>

    </Card>
  );
};

export default CommandTimeline;