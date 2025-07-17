import React, { useState, useCallback } from 'react';
import { Tabs, Button, Empty, Typography, Badge, Dropdown, message } from 'antd';
import { PlusOutlined, CloseOutlined, MoreOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { TabInfo } from '../../types/workspace';
import WorkspaceTerminal from './WorkspaceTerminal';

const { TabPane } = Tabs;
const { Title, Paragraph } = Typography;

interface TabContainerProps {
  tabs: TabInfo[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabDuplicate: (tabId: string) => void;
  onTabReconnect: (tabId: string) => void;
}

const TabContainer: React.FC<TabContainerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onNewTab,
  onTabDuplicate,
  onTabReconnect
}) => {
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);

  // 获取标签页右键菜单项
  const getTabContextMenu = useCallback((tab: TabInfo): MenuProps['items'] => [
    {
      key: 'reconnect',
      label: '重新连接',
      icon: <ReloadOutlined />,
      disabled: tab.connectionStatus === 'connecting',
      onClick: () => {
        onTabReconnect(tab.id);
        message.info(`正在重新连接到 ${tab.assetInfo.name}`);
      }
    },
    {
      key: 'duplicate',
      label: '复制标签页',
      icon: <CopyOutlined />,
      onClick: () => {
        onTabDuplicate(tab.id);
        message.success(`已复制标签页: ${tab.title}`);
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'close',
      label: '关闭标签页',
      icon: <CloseOutlined />,
      onClick: () => {
        onTabClose(tab.id);
      }
    },
    {
      key: 'close-others',
      label: '关闭其他标签页',
      disabled: tabs.length <= 1,
      onClick: () => {
        const otherTabs = tabs.filter(t => t.id !== tab.id);
        otherTabs.forEach(t => onTabClose(t.id));
        message.success(`已关闭 ${otherTabs.length} 个其他标签页`);
      }
    }
  ], [tabs, onTabClose, onTabDuplicate, onTabReconnect]);

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
    <Dropdown
      menu={{ items: getTabContextMenu(tab) }}
      trigger={['contextMenu']}
    >
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
    </Dropdown>
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
              <WorkspaceTerminal
                tab={tab}
                onReconnect={() => {
                  console.log(`重新连接到 ${tab.assetInfo.name}`);
                }}
                onDisconnect={() => {
                  console.log(`断开与 ${tab.assetInfo.name} 的连接`);
                }}
              />
            </div>
          </TabPane>
        ))}
      </Tabs>
    </div>
  );
};

export default TabContainer;