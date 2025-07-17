import React from 'react';
import { Tabs, Button, Empty, Typography, Badge } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { TabInfo } from '../../types/workspace';

const { TabPane } = Tabs;
const { Title, Paragraph } = Typography;

interface TabContainerProps {
  tabs: TabInfo[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

const TabContainer: React.FC<TabContainerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onNewTab
}) => {
  // 渲染连接状态指示器
  const StatusIndicator: React.FC<{ status: TabInfo['connectionStatus'] }> = ({ status }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'connected':
          return { color: '#52c41a', text: '已连接' };
        case 'connecting':
          return { color: '#1890ff', text: '连接中' };
        case 'disconnected':
          return { color: '#d9d9d9', text: '已断开' };
        case 'error':
          return { color: '#ff4d4f', text: '连接错误' };
        default:
          return { color: '#d9d9d9', text: '未连接' };
      }
    };

    const { color } = getStatusConfig();

    return (
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          marginRight: 6
        }}
        title={getStatusConfig().text}
      />
    );
  };

  // 渲染标签页标题
  const renderTabTitle = (tab: TabInfo) => (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 4,
        maxWidth: 150
      }}
    >
      <StatusIndicator status={tab.connectionStatus} />
      <span 
        style={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '12px'
        }}
        title={tab.title}
      >
        {tab.title}
      </span>
      {tab.modified && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#faad14',
            marginLeft: 2
          }}
          title="有未保存的更改"
        />
      )}
    </div>
  );

  // 渲染空状态页面
  const renderEmptyState = () => (
    <div style={{ 
      height: 'calc(100vh - 160px)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#fafafa',
      borderRadius: '6px'
    }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ color: '#595959', marginBottom: 8 }}>
              欢迎使用连接工作台
            </Title>
            <Paragraph style={{ color: '#8c8c8c', marginBottom: 16 }}>
              从左侧选择主机资源开始连接，或者点击下方按钮创建新的连接
            </Paragraph>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={onNewTab}
              size="large"
            >
              新建连接
            </Button>
          </div>
        }
      />
    </div>
  );

  // 如果没有标签页，显示空状态
  if (tabs.length === 0) {
    return renderEmptyState();
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        type="editable-card"
        activeKey={activeTabId}
        onChange={onTabChange}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            onTabClose(targetKey);
          }
        }}
        hideAdd
        size="small"
        style={{ 
          flex: 'none',
          marginBottom: 0,
        }}
        tabBarStyle={{
          marginBottom: 0,
          backgroundColor: '#fafafa',
          paddingLeft: 8,
          paddingRight: 8
        }}
        tabBarExtraContent={{
          right: (
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={onNewTab}
              style={{ marginRight: 8 }}
              title="新建连接"
            >
              新建
            </Button>
          )
        }}
      >
        {tabs.map(tab => (
          <TabPane
            key={tab.id}
            tab={renderTabTitle(tab)}
            closable={tab.closable}
          >
            <div style={{ 
              height: 'calc(100vh - 200px)',
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              {/* 临时内容 - 后续会替换为 WebTerminal 组件 */}
              <div style={{ 
                padding: 16,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16
              }}>
                <Badge 
                  status={
                    tab.connectionStatus === 'connected' ? 'success' :
                    tab.connectionStatus === 'connecting' ? 'processing' :
                    tab.connectionStatus === 'error' ? 'error' : 'default'
                  } 
                  text={
                    tab.connectionStatus === 'connected' ? '终端已连接' :
                    tab.connectionStatus === 'connecting' ? '正在连接终端...' :
                    tab.connectionStatus === 'error' ? '连接失败' : '等待连接'
                  }
                />
                <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                  <p><strong>主机:</strong> {tab.assetInfo.name}</p>
                  <p><strong>地址:</strong> {tab.assetInfo.address}:{tab.assetInfo.port}</p>
                  <p><strong>用户:</strong> {tab.credentialInfo.username}</p>
                  <p><strong>协议:</strong> {tab.assetInfo.protocol?.toUpperCase() || 'SSH'}</p>
                  {tab.sessionId && (
                    <p><strong>会话ID:</strong> {tab.sessionId}</p>
                  )}
                </div>
                <div style={{ 
                  background: '#f0f0f0', 
                  padding: '8px 12px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  终端组件将在后续集成
                </div>
              </div>
            </div>
          </TabPane>
        ))}
      </Tabs>
    </div>
  );
};

export default TabContainer;