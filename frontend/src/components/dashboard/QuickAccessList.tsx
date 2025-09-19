import React, { useCallback } from 'react';
import { List, Button, Space, Tag, Empty, message, Skeleton } from 'antd';
import { LinkOutlined, DesktopOutlined } from '@ant-design/icons';
import { QuickAccessHost } from '../../store/dashboardSlice';
import { useNavigate } from 'react-router-dom';
import './QuickAccessList.css';

interface QuickAccessListProps {
  hosts: QuickAccessHost[];
  loading?: boolean;
}

const QuickAccessList: React.FC<QuickAccessListProps> = ({ hosts, loading }) => {
  const navigate = useNavigate();

  const handleConnect = useCallback((host: QuickAccessHost) => {
    // 导航到连接页面
    message.info(`正在连接到 ${host.name}...`);
    // 实际连接逻辑应该通过创建会话API
    navigate('/connect/hosts', { 
      state: { 
        assetId: host.id, 
        credentialId: host.credential_id 
      } 
    });
  }, [navigate]);

  if (loading) {
    return (
      <List
        className="quick-access-list"
        dataSource={[1, 2, 3]}
        renderItem={() => (
          <List.Item>
            <Skeleton active paragraph={{ rows: 2 }} />
          </List.Item>
        )}
      />
    );
  }

  if (!hosts || hosts.length === 0) {
    return (
      <div className="quick-access-empty">
        <Empty 
          description="暂无快速访问主机" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <List
      className="quick-access-list"
      dataSource={hosts}
      renderItem={(host) => (
        <List.Item
          className="quick-access-item"
          actions={[
            <Button
              type="primary"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => handleConnect(host)}
            >
              连接
            </Button>
          ]}
        >
          <div className="host-info">
            <div className="host-header">
              <DesktopOutlined className="host-icon" />
              <span className="host-name">{host.name}</span>
            </div>
            <div className="host-details">
              <Space size="small">
                <span className="host-credential">
                  {host.username}@{host.address}
                </span>
                <Tag color="blue">{host.os || 'Linux'}</Tag>
              </Space>
            </div>
            {host.last_access && (
              <div className="host-meta">
                访问次数: {host.access_count}
              </div>
            )}
          </div>
        </List.Item>
      )}
    />
  );
};

export default React.memo(QuickAccessList);