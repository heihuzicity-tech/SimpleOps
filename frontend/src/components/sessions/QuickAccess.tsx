import React from 'react';
import { Card, Space, Button, Typography, Tag, Tooltip, Empty } from 'antd';
import { 
  LinkOutlined, 
  DeleteOutlined,
  ClockCircleOutlined,
  LinuxOutlined,
  WindowsOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { useRecentConnections } from '../../hooks/useRecentConnections';

const { Text } = Typography;

interface QuickAccessProps {
  onConnect: (connection: any) => void;
  className?: string;
}

const QuickAccess: React.FC<QuickAccessProps> = ({ onConnect, className }) => {
  const { 
    recentConnections, 
    removeRecentConnection, 
    clearRecentConnections 
  } = useRecentConnections();
  
  const getOsIcon = (osType: string) => {
    return osType === 'linux' ? 
      <LinuxOutlined style={{ color: '#52c41a' }} /> : 
      <WindowsOutlined style={{ color: '#1890ff' }} />;
  };
  
  if (recentConnections.length === 0) {
    return (
      <Card 
        size="small" 
        title={
          <Space>
            <ClockCircleOutlined />
            <span>快速访问</span>
          </Space>
        }
        className={className}
        style={{ marginBottom: 16 }}
      >
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无最近连接记录"
          style={{ margin: '12px 0' }}
        />
      </Card>
    );
  }
  
  return (
    <Card 
      size="small" 
      title={
        <Space>
          <ClockCircleOutlined />
          <span>快速访问</span>
          <Text type="secondary">({recentConnections.length})</Text>
        </Space>
      }
      extra={
        <Tooltip title="清空所有记录">
          <Button 
            type="text" 
            size="small" 
            icon={<ClearOutlined />}
            onClick={clearRecentConnections}
          />
        </Tooltip>
      }
      className={className}
      style={{ marginBottom: 16 }}
    >
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        flexWrap: 'wrap',
        maxHeight: 120,
        overflowY: 'auto'
      }}>
        {recentConnections.map(connection => (
          <div
            key={connection.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              background: '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 200,
              maxWidth: 300,
            }}
          >
            <Space size="small" style={{ flex: 1 }}>
              {getOsIcon(connection.os_type)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontWeight: 500, 
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {connection.name}
                </div>
                <div style={{ 
                  fontSize: 11, 
                  color: '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {connection.address}:{connection.port}
                </div>
              </div>
              
              <Space size={4}>
                <Tag color="cyan" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                  {connection.protocol?.toUpperCase()}
                </Tag>
                
                {connection.connectionCount > 1 && (
                  <Tag color="orange" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                    {connection.connectionCount}次
                  </Tag>
                )}
              </Space>
              
              <Space size={2}>
                <Tooltip title={`连接到 ${connection.name}`}>
                  <Button
                    type="text"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnect(connection);
                    }}
                    style={{ padding: '2px 4px', height: 20 }}
                  />
                </Tooltip>
                
                <Tooltip title="移除此记录">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentConnection(connection.id);
                    }}
                    style={{ padding: '2px 4px', height: 20 }}
                    danger
                  />
                </Tooltip>
              </Space>
            </Space>
          </div>
        ))}
      </div>
      
      <div style={{ 
        marginTop: 8, 
        padding: '4px 0',
        borderTop: '1px solid #f0f0f0',
        fontSize: 11,
        color: '#999',
        textAlign: 'center'
      }}>
        显示最近 {recentConnections.length} 条连接记录
      </div>
    </Card>
  );
};

export default QuickAccess;