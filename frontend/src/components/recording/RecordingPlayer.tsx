import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Slider, Select, Spin, message, Row, Col, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { RecordingResponse, RecordingAPI } from '../../services/recordingAPI';
// import { formatDuration, formatFileSize } from '../../utils/format';
import CommandTimeline from './CommandTimeline';

const { Option } = Select;
const { Text } = Typography;

interface RecordingPlayerProps {
  recording: RecordingResponse;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// AsciinemaPlayer类型定义
interface AsciinemaPlayerType {
  create: (src: string, element: HTMLElement, options?: AsciinemaPlayerOptions) => AsciinemaPlayerInstance;
}

interface AsciinemaPlayerOptions {
  autoPlay?: boolean;
  loop?: boolean;
  startAt?: number;
  speed?: number;
  theme?: string;
  poster?: string;
  fit?: string;
  fontSize?: string;
}

interface AsciinemaPlayerInstance {
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getSpeed(): number;
  setSpeed(speed: number): void;
  dispose(): void;
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
}

declare global {
  interface Window {
    AsciinemaPlayer: AsciinemaPlayerType;
  }
}

const RecordingPlayer: React.FC<RecordingPlayerProps> = ({ recording, onFullscreenChange }) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<AsciinemaPlayerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recordingData, setRecordingData] = useState<string>('');

  // 加载asciicast数据
  const loadRecordingData = async () => {
    setLoading(true);
    try {
      const data = await RecordingAPI.getRecordingFile(recording.id);
      setRecordingData(data);
    } catch (error) {
      console.error('加载录制数据失败:', error);
      message.error('加载录制数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载asciinema-player
  const loadAsciinemaPlayer = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.AsciinemaPlayer) {
        resolve();
        return;
      }

      // 加载CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.2.0/dist/bundle/asciinema-player.css';
      document.head.appendChild(link);

      // 加载JS
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.2.0/dist/bundle/asciinema-player.min.js';
      script.onload = () => {
        console.log('asciinema-player v3.2.0加载完成');
        resolve();
      };
      script.onerror = () => reject(new Error('加载asciinema-player失败'));
      document.head.appendChild(script);
    });
  };

  // 初始化播放器
  const initializePlayer = async () => {
    if (!playerRef.current || !recordingData) {
      console.warn('播放器初始化条件不满足:', { hasPlayerRef: !!playerRef.current, hasData: !!recordingData });
      return;
    }

    try {
      console.log('开始加载asciinema播放器...');
      await loadAsciinemaPlayer();
      
      console.log('验证录制数据格式...');
      // 验证数据格式
      if (!validateAsciinemaData(recordingData)) {
        throw new Error('无效的asciicast数据格式');
      }

      // 转换为asciinema v2标准格式
      let asciinemaData = recordingData;
      try {
        const lines = recordingData.trim().split('\n');
        const processedLines = [];
        
        console.log('开始转换为asciinema v2格式...');
        
        // 处理每一行
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          try {
            const parsed = JSON.parse(line);
            
            if (i === 0) {
              // 头部行保持不变
              processedLines.push(JSON.stringify(parsed));
              console.log('头部行已保留:', parsed);
            } else {
              // 数据行转换为asciinema v2数组格式
              if (parsed.time !== undefined && parsed.type && parsed.data !== undefined) {
                const time = typeof parsed.time === 'number' ? parsed.time : parseFloat(parsed.time) || 0;
                const eventType = parsed.type === 'input' ? 'i' : 'o'; // output -> 'o', input -> 'i'
                const data = String(parsed.data || '');
                
                // asciinema v2格式: [timestamp, type, data]
                const asciinemaEvent = [time, eventType, data];
                processedLines.push(JSON.stringify(asciinemaEvent));
                
                if (i <= 3) { // 只记录前几行用于调试
                  console.log(`转换第${i}行:`, {
                    原始: { time: parsed.time, type: parsed.type, data: data.substring(0, 30) + '...' },
                    转换后: asciinemaEvent
                  });
                }
              } else {
                console.warn(`跳过第${i}行格式不完整:`, parsed);
              }
            }
          } catch (parseError) {
            console.warn(`跳过第${i}行解析失败:`, line.substring(0, 50));
          }
        }
        
        console.log(`格式转换完成: ${lines.length} -> ${processedLines.length} 行`);
        asciinemaData = processedLines.join('\n');
        
        // 验证转换后的格式
        const convertedLines = asciinemaData.split('\n');
        if (convertedLines.length > 1) {
          try {
            const sampleEvent = JSON.parse(convertedLines[1]);
            console.log('转换后示例事件:', sampleEvent, '类型:', Array.isArray(sampleEvent) ? '数组✓' : '对象✗');
          } catch (e) {
            console.error('转换后格式验证失败:', e);
          }
        }
        
      } catch (convertError) {
        console.error('格式转换失败，使用原始数据:', convertError);
      }
      
      // 创建blob URL
      const blob = new Blob([asciinemaData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      console.log('Blob创建成功:', { 
        size: blob.size, 
        type: blob.type,
        url: url 
      });

      // 验证Blob内容（调试用）
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          console.log('Blob内容验证:', {
            length: content.length,
            firstLine: content.split('\n')[0],
            lastChars: content.slice(-50)
          });
        };
        reader.readAsText(blob);
      } catch (blobError) {
        console.warn('Blob验证失败:', blobError);
      }

      console.log('创建播放器实例...');
      // 创建播放器实例 - 使用最小有效配置
      const player = window.AsciinemaPlayer.create(url, playerRef.current, {
        autoPlay: false,
        loop: false,
        fit: 'width',  // 恢复为width，再用CSS控制高度
        fontSize: '14px',
        theme: 'asciinema'
      });

      if (!player) {
        throw new Error('播放器创建失败');
      }

      console.log('播放器创建成功');
      playerInstanceRef.current = player;

      // 强制设置播放器样式以填满容器
      setTimeout(() => {
        const playerElement = playerRef.current?.querySelector('.asciinema-player');
        const terminalElement = playerRef.current?.querySelector('.asciinema-terminal');
        if (playerElement && playerRef.current) {
          const containerHeight = playerRef.current.clientHeight;
          (playerElement as HTMLElement).style.width = '100%';
          (playerElement as HTMLElement).style.height = '100%';
          
          // 同时调整终端元素的尺寸
          if (terminalElement) {
            (terminalElement as HTMLElement).style.height = `${containerHeight - 32}px`; // 减去控制栏高度
          }
          
          console.log('播放器样式已设置为填满容器', { containerHeight });
        }
      }, 500);

      // 等待播放器完全加载后再设置事件监听器
      setTimeout(() => {
        try {
          console.log('设置事件监听器...');
          
          // 简化的事件处理
          const updateTime = () => {
            try {
              if (player && player.getCurrentTime && player.getDuration) {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                if (typeof currentTime === 'number' && typeof duration === 'number') {
                  setCurrentTime(currentTime);
                  setDuration(duration);
                }
              }
            } catch (e) {
              // 静默处理时间更新错误
            }
          };

          // 不使用事件监听器，改用轮询方式获取状态
          const pollInterval = setInterval(() => {
            updateTime();
          }, 1000);

          // 保存轮询ID用于清理
          (player as any)._pollInterval = pollInterval;

          console.log('播放器初始化完成');
        } catch (eventError) {
          console.warn('设置事件监听器失败，使用基础模式:', eventError);
        }
      }, 1000);

      // 清理blob URL
      return () => URL.revokeObjectURL(url);
    } catch (error) {
      console.error('初始化播放器失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`初始化播放器失败: ${errorMessage}`);
    }
  };

  // 验证asciicast数据格式
  const validateAsciinemaData = (data: string): boolean => {
    try {
      const lines = data.trim().split('\n');
      console.log('原始数据行数:', lines.length);
      console.log('前3行数据:', lines.slice(0, 3));
      
      if (lines.length < 1) {
        console.error('数据为空');
        return false;
      }

      // 验证头部
      const header = JSON.parse(lines[0]);
      console.log('头部解析结果:', header);
      
      if (!header.version || !header.width || !header.height) {
        console.error('头部格式无效:', header);
        return false;
      }

      // 验证几行数据格式
      if (lines.length > 1) {
        try {
          const sampleRecord = JSON.parse(lines[1]);
          console.log('示例数据记录:', sampleRecord);
          
          if (!sampleRecord.hasOwnProperty('time') || !sampleRecord.hasOwnProperty('type') || !sampleRecord.hasOwnProperty('data')) {
            console.warn('数据记录格式可能不完整:', sampleRecord);
          }
        } catch (recordError) {
          console.error('数据记录解析失败:', recordError);
          console.log('问题行内容:', lines[1]);
        }
      }

      console.log('数据验证通过:', { 
        version: header.version, 
        size: `${header.width}x${header.height}`,
        lines: lines.length,
        header: header
      });
      
      return true;
    } catch (parseError) {
      console.error('数据解析失败:', parseError);
      console.log('问题数据:', data.substring(0, 200) + '...');
      return false;
    }
  };

  // 播放/暂停
  const togglePlay = () => {
    if (!playerInstanceRef.current) return;
    
    try {
      if (playing) {
        playerInstanceRef.current.pause();
        setPlaying(false);
      } else {
        playerInstanceRef.current.play();
        setPlaying(true);
      }
    } catch (error) {
      console.warn('播放控制失败:', error);
    }
  };

  // 跳转到指定时间
  const seekTo = (time: number) => {
    if (!playerInstanceRef.current) return;
    playerInstanceRef.current.seek(time);
    setCurrentTime(time);
  };

  // 快进/快退
  const skipTime = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seekTo(newTime);
  };

  // 设置播放速度
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (playerInstanceRef.current) {
      playerInstanceRef.current.setSpeed(newSpeed);
    }
  };

  // 重新开始
  const restart = () => {
    seekTo(0);
  };

  // 页面内全屏切换
  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenChange?.(newFullscreenState);
  };

  // 组件加载时获取录制数据
  useEffect(() => {
    loadRecordingData();
  }, [recording.id]);

  // 录制数据加载后初始化播放器
  useEffect(() => {
    if (recordingData) {
      initializePlayer();
    }

    // 清理函数
    return () => {
      if (playerInstanceRef.current) {
        // 清理轮询
        if ((playerInstanceRef.current as any)._pollInterval) {
          clearInterval((playerInstanceRef.current as any)._pollInterval);
        }
        
        try {
          playerInstanceRef.current.dispose();
        } catch (error) {
          console.warn('播放器清理失败:', error);
        }
        
        playerInstanceRef.current = null;
      }
    };
  }, [recordingData, speed]);

  // 时间格式化函数
  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载录制数据中...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: isFullscreen ? '100%' : 'calc(85vh - 32px)',  // 全屏时100%，非全屏时固定高度
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'   // 防止内容溢出
    }}>
      <Row gutter={isFullscreen ? 4 : 8} style={{ 
        flex: 1, 
        minHeight: 0, 
        alignItems: 'stretch',
        display: 'flex',
        overflow: 'hidden'  // 防止内容溢出
      }}>
        {/* 左侧播放器 */}
        <Col span={isFullscreen ? 19 : 17} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 播放器容器 */}
          <Card 
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              marginBottom: 6,
              minHeight: 0
            }} 
            bodyStyle={{ 
              padding: '4px', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div 
              ref={playerRef} 
              style={{ 
                width: '100%', 
                flex: 1,
                minHeight: '400px',
                backgroundColor: '#000',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            />
          </Card>

          {/* 播放控制 */}
          <Card style={{ flexShrink: 0 }} bodyStyle={{ padding: '6px' }}>
            {/* 进度条 */}
            <div style={{ marginBottom: 6 }}>
              <Slider
                min={0}
                max={duration}
                value={currentTime}
                onChange={seekTo}
                step={0.1}
                tooltip={{
                  formatter: (value) => formatTimeDisplay(value || 0),
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>{formatTimeDisplay(currentTime)}</Text>
                <Text type="secondary" style={{ fontSize: '11px' }}>{formatTimeDisplay(duration)}</Text>
              </div>
            </div>

            {/* 控制按钮 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '2px 4px',
              minHeight: '36px'
            }}>
              {/* 左侧播放控制按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Button
                  type="primary"
                  size="small"
                  icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={togglePlay}
                  style={{ minWidth: '60px', height: '28px', fontSize: '12px' }}
                >
                  {playing ? '暂停' : '播放'}
                </Button>
                <Button
                  size="small"
                  icon={<StepBackwardOutlined />}
                  onClick={() => skipTime(-10)}
                  title="后退10秒"
                  style={{ height: '28px', minWidth: '28px' }}
                />
                <Button
                  size="small"
                  icon={<StepForwardOutlined />}
                  onClick={() => skipTime(10)}
                  title="前进10秒"
                  style={{ height: '28px', minWidth: '28px' }}
                />
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={restart}
                  title="重新开始"
                  style={{ height: '28px', minWidth: '28px' }}
                />
              </div>

              {/* 右侧速度和全屏控制 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>
                  速度:
                </span>
                <Select
                  size="small"
                  value={speed}
                  onChange={handleSpeedChange}
                  style={{ width: 58, fontSize: '11px' }}
                >
                  <Option value={0.25}>0.25x</Option>
                  <Option value={0.5}>0.5x</Option>
                  <Option value={0.75}>0.75x</Option>
                  <Option value={1}>1x</Option>
                  <Option value={1.25}>1.25x</Option>
                  <Option value={1.5}>1.5x</Option>
                  <Option value={2}>2x</Option>
                  <Option value={4}>4x</Option>
                </Select>
                
                <Button
                  size="small"
                  icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleFullscreen}
                  title={isFullscreen ? '退出全屏' : '全屏'}
                  style={{ height: '28px', minWidth: '28px' }}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧命令时间轴 */}
        <Col span={isFullscreen ? 5 : 7} style={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',  // 确保Col占满高度
          minHeight: 0,    // 允许flex收缩
        }}>
          <CommandTimeline
            recording={recording}
            recordingData={recordingData}
            onSeekTo={seekTo}
          />
        </Col>
      </Row>
    </div>
  );
};

export default RecordingPlayer;