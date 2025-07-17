import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Card, Empty, Button, Typography, message } from 'antd';
import { PlusOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { WorkspaceState, TabInfo } from '../../types/workspace';

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
    preferences: {
      autoReconnect: true,
      maxTabs: 10,
      defaultTerminalSize: { width: 80, height: 24 },
      theme: 'light',
      fontSize: 14
    }
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
    message.info('新建连接功能将在后续版本中实现');
  }, []);

  // 资产选择处理
  const handleAssetSelect = useCallback((asset: any) => {
    console.log('选中资产:', asset);
    message.info(`选中了资产: ${asset?.name || '未知资产'}`);
  }, []);

  // 渲染侧边栏内容
  const renderSidebarContent = () => {
    if (workspaceState.sidebarCollapsed) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 16
        }}>
          <Button 
            type="text" 
            icon={<PlusOutlined />} 
            onClick={handleNewConnection}
            style={{ marginBottom: 16 }}
          />
          <Button 
            type="text" 
            icon={<SettingOutlined />}
            style={{ marginBottom: 16 }}
          />
        </div>
      );
    }

    return (
      <Card 
        size="small" 
        style={{ height: '100%', border: 'none' }}
        styles={{ body: { padding: '16px' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0, marginBottom: 8 }}>资源管理</Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleNewConnection}
            style={{ width: '100%' }}
          >
            新建连接
          </Button>
        </div>
        
        <div style={{ 
          height: 'calc(100% - 80px)',
          border: '1px dashed #d9d9d9',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa'
        }}>
          <div style={{ textAlign: 'center', color: '#999' }}>
            <Paragraph>资源树组件</Paragraph>
            <Paragraph>将在Day 2集成</Paragraph>
          </div>
        </div>
      </Card>
    );
  };

  // 渲染主内容区域
  const renderMainContent = () => {
    if (workspaceState.tabs.length === 0) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#fafafa'
        }}>
          <Empty
            description={
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ color: '#666' }}>
                  欢迎使用连接工作台
                </Title>
                <Paragraph style={{ fontSize: 16, color: '#999', marginBottom: 24 }}>
                  从左侧选择主机资源开始连接，或点击下方按钮创建新的连接
                </Paragraph>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<PlusOutlined />} 
                  onClick={handleNewConnection}
                >
                  新建连接
                </Button>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ textAlign: 'center', color: '#999' }}>
          <Paragraph>标签页容器</Paragraph>
          <Paragraph>将在Day 3实现</Paragraph>
        </div>
      </div>
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
        <Sider
          width={workspaceState.sidebarCollapsed ? 60 : workspaceState.sidebarWidth}
          collapsed={workspaceState.sidebarCollapsed}
          collapsedWidth={60}
          style={{ 
            borderRight: '1px solid #f0f0f0',
            backgroundColor: '#fafafa'
          }}
        >
          {renderSidebarContent()}
        </Sider>
        
        <Content style={{ 
          height: '100%', 
          backgroundColor: '#fff',
          position: 'relative'
        }}>
          {renderMainContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default WorkspaceLayout;