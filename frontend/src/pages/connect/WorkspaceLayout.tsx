import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Card, Empty, Button, Typography, message } from 'antd';
import { PlusOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { WorkspaceState, TabInfo } from '../../types/workspace';
import SidePanel from '../../components/workspace/SidePanel';
import TabContainer from '../../components/workspace/TabContainer';
import { Asset } from '../../types';
import { addTestConnectionHistory } from '../../utils/testData';
import { runWorkspaceTests, quickTest } from '../../utils/testWorkspace';
import { nanoid } from 'nanoid';

const { Header, Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

const WorkspaceLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  // 本地状态管理（后续会移到Redux）
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    tabs: [],
    activeTabId: '',
    sidebarWidth: 280,
    sidebarCollapsed: false,
    layout: 'horizontal',
    loading: false,
    error: null
  });

  // 侧边栏折叠状态
  const handleSidebarToggle = useCallback(() => {
    setWorkspaceState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  }, []);

  // 侧边栏宽度调整
  // 移除了 handleSidebarResize 因为使用 Ant Design Sider 组件暂时不支持动态调整宽度
  // const handleSidebarResize = useCallback((width: number) => {
  //   setWorkspaceState(prev => ({
  //     ...prev,
  //     sidebarWidth: Math.max(200, Math.min(400, width))
  //   }));
  // }, []);

  // 新建连接
  const handleNewConnection = useCallback(() => {
    // 创建一个示例标签页用于测试
    const newTab: TabInfo = {
      id: nanoid(),
      title: `测试连接-${Date.now().toString().slice(-4)}`,
      type: 'ssh',
      assetInfo: {
        id: Math.floor(Math.random() * 1000),
        name: `test-server-${Date.now().toString().slice(-4)}`,
        address: '192.168.1.100',
        port: 22,
        protocol: 'ssh',
        os_type: 'linux'
      },
      credentialInfo: {
        id: 1,
        username: 'root',
        type: 'password',
        name: '测试凭证'
      },
      closable: true,
      modified: false,
      connectionStatus: 'idle',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    setWorkspaceState(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id
    }));

    message.success(`已创建新标签页: ${newTab.title}`);
  }, []);

  // 资产选择处理
  const handleAssetSelect = useCallback((asset: Asset) => {
    console.log('选中资产:', asset);
    
    // 创建基于真实资产的连接标签页
    const newTab: TabInfo = {
      id: nanoid(),
      title: `${asset.name}`,
      type: 'ssh',
      assetInfo: {
        id: asset.id,
        name: asset.name,
        address: asset.address,
        port: asset.port || 22,
        protocol: asset.protocol || 'ssh',
        os_type: asset.os_type
      },
      credentialInfo: {
        id: 1,
        username: 'root',
        type: 'password',
        name: '默认凭证'
      },
      closable: true,
      modified: false,
      connectionStatus: 'connecting',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    setWorkspaceState(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id
    }));

    // 模拟连接过程
    setTimeout(() => {
      setWorkspaceState(prev => ({
        ...prev,
        tabs: prev.tabs.map(tab => 
          tab.id === newTab.id 
            ? { ...tab, connectionStatus: 'connected' as const, sessionId: `session_${nanoid()}` }
            : tab
        )
      }));
      message.success(`成功连接到 ${asset.name}`);
    }, 2000);
    
    message.info(`正在连接到 ${asset.name}...`);
  }, []);

  // 标签页切换处理
  const handleTabChange = useCallback((tabId: string) => {
    setWorkspaceState(prev => ({
      ...prev,
      activeTabId: tabId
    }));
  }, []);

  // 标签页关闭处理
  const handleTabClose = useCallback((tabId: string) => {
    setWorkspaceState(prev => {
      const tabIndex = prev.tabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prev;

      const newTabs = prev.tabs.filter(tab => tab.id !== tabId);
      let newActiveTabId = prev.activeTabId;

      // 如果关闭的是当前活跃标签页，切换到其他标签页
      if (prev.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newActiveIndex = Math.max(0, tabIndex - 1);
          newActiveTabId = newTabs[newActiveIndex]?.id || '';
        } else {
          newActiveTabId = '';
        }
      }

      return {
        ...prev,
        tabs: newTabs,
        activeTabId: newActiveTabId
      };
    });

    message.info('标签页已关闭');
  }, []);

  // 渲染主内容区域
  const renderMainContent = () => {
    return (
      <TabContainer
        tabs={workspaceState.tabs}
        activeTabId={workspaceState.activeTabId}
        onTabChange={handleTabChange}
        onTabClose={handleTabClose}
        onNewTab={handleNewConnection}
      />
    );
  };

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T 新建连接
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        handleNewConnection();
      }
      // Ctrl+B 切换侧边栏
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handleSidebarToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNewConnection, handleSidebarToggle]);

  return (
    <Layout style={{ height: '100vh' }}>
      {/* 顶部标题栏 */}
      <Header style={{ 
        background: '#fff', 
        padding: '0 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            type="text" 
            icon={workspaceState.sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={handleSidebarToggle}
            style={{ marginRight: 16 }}
          />
          <Title level={4} style={{ margin: 0 }}>
            连接工作台
          </Title>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button 
            type="text"
            onClick={() => {
              addTestConnectionHistory();
              message.success('测试数据已添加');
            }}
            style={{ color: '#1890ff' }}
          >
            添加测试数据
          </Button>
          <Button 
            type="text"
            onClick={() => quickTest()}
            style={{ color: '#52c41a' }}
          >
            快速测试
          </Button>
          <Button 
            type="text"
            onClick={async () => {
              message.loading('正在运行完整测试...', 0);
              try {
                await runWorkspaceTests();
                message.destroy();
              } catch (error) {
                message.destroy();
                message.error('测试运行失败');
              }
            }}
            style={{ color: '#722ed1' }}
          >
            完整测试
          </Button>
          <Button 
            type="text" 
            icon={<SettingOutlined />}
            onClick={() => message.info('设置功能将在后续版本中实现')}
          />
          <Button 
            type="text"
            onClick={() => navigate('/connect/hosts')}
          >
            返回主机管理
          </Button>
        </div>
      </Header>

      {/* 主体内容 */}
      <Layout style={{ height: 'calc(100vh - 64px)' }}>
        <SidePanel
          width={workspaceState.sidebarWidth}
          collapsed={workspaceState.sidebarCollapsed}
          onAssetSelect={handleAssetSelect}
          onToggleCollapse={handleSidebarToggle}
        />
        
        <Content style={{ 
          height: '100%', 
          backgroundColor: '#f5f5f5',
          position: 'relative',
          padding: '8px'
        }}>
          {renderMainContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default WorkspaceLayout;