import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Input, 
  List, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Empty,
  Spin,
} from 'antd';
import { 
  SearchOutlined, 
  PlayCircleOutlined, 
  ClockCircleOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { RecordingResponse } from '../../services/recordingAPI';

const { Search } = Input;
const { Text } = Typography;

interface SearchResult {
  timestamp: number;
  content: string;
  type: 'input' | 'output';
  line: number;
  preview: string;
}

interface RecordingSearchPlayerProps {
  recording: RecordingResponse;
  recordingData: string;
  onSeekTo: (time: number) => void;
}

const RecordingSearchPlayer: React.FC<RecordingSearchPlayerProps> = ({
  recording,
  recordingData,
  onSeekTo,
}) => {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  // 解析asciicast数据
  useEffect(() => {
    if (recordingData) {
      try {
        const lines = recordingData.split('\n').filter(line => line.trim());
        JSON.parse(lines[0]); // 解析header但不保存
        const events = lines.slice(1).map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);
        
        setParsedData(events);
      } catch (error) {
        console.error('解析录制数据失败:', error);
      }
    }
  }, [recordingData]);

  // 搜索功能
  const handleSearch = async (value: string) => {
    if (!value.trim() || !parsedData.length) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results: SearchResult[] = [];
      const searchTerm = value.toLowerCase();

      parsedData.forEach((event, index) => {
        if (event && event.length >= 3) {
          const [timestamp, type, data] = event;
          const content = data.toString().toLowerCase();
          
          if (content.includes(searchTerm)) {
            // 创建预览文本（前后各20个字符）
            const matchIndex = content.indexOf(searchTerm);
            const start = Math.max(0, matchIndex - 20);
            const end = Math.min(content.length, matchIndex + searchTerm.length + 20);
            const preview = content.substring(start, end);
            
            results.push({
              timestamp,
              content: data.toString(),
              type: type === 'i' ? 'input' : 'output',
              line: index + 1,
              preview,
            });
          }
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setSearching(false);
    }
  };

  // 跳转到指定时间
  const handleJumpTo = (timestamp: number) => {
    onSeekTo(timestamp);
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 高亮搜索文本
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffe58f', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <Card
      title={
        <Space>
          <SearchOutlined />
          <span>搜索与跳转</span>
        </Space>
      }
      size="small"
      style={{ height: '400px', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索命令、输出内容..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          loading={searching}
          enterButton
        />
      </div>

      {/* 搜索结果 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {searching ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : searchResults.length > 0 ? (
          <List
            size="small"
            dataSource={searchResults}
            renderItem={(item, index) => (
              <List.Item
                key={index}
                style={{ 
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                }}
                onClick={() => handleJumpTo(item.timestamp)}
              >
                <div style={{ width: '100%' }}>
                  {/* 时间和类型标签 */}
                  <div style={{ marginBottom: 4 }}>
                    <Space size="small">
                      <Tag 
                        icon={<ClockCircleOutlined />} 
                        color="blue"
                        style={{ fontSize: '12px' }}
                      >
                        {formatTime(item.timestamp)}
                      </Tag>
                      <Tag 
                        icon={<CodeOutlined />}
                        color={item.type === 'input' ? 'green' : 'orange'}
                        style={{ fontSize: '12px' }}
                      >
                        {item.type === 'input' ? '输入' : '输出'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        第{item.line}行
                      </Text>
                    </Space>
                  </div>
                  
                  {/* 内容预览 */}
                  <div style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '12px',
                    backgroundColor: '#f5f5f5',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {highlightText(item.preview, searchText)}
                  </div>
                  
                  {/* 跳转按钮 */}
                  <div style={{ marginTop: 4 }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpTo(item.timestamp);
                      }}
                      style={{ padding: 0, fontSize: '12px' }}
                    >
                      跳转到此时间
                    </Button>
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : searchText ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                未找到包含 "<Text strong>{searchText}</Text>" 的内容
              </span>
            }
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="输入关键字搜索录制内容"
          />
        )}
      </div>

      {/* 统计信息 */}
      {searchResults.length > 0 && (
        <div style={{ 
          marginTop: 8, 
          padding: '8px 0', 
          borderTop: '1px solid #f0f0f0',
          fontSize: '12px',
          color: '#666',
        }}>
          找到 {searchResults.length} 个匹配结果
        </div>
      )}
    </Card>
  );
};

export default RecordingSearchPlayer;