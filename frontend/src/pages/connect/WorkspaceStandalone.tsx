import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Button, Typography, message, Modal } from 'antd';
import { PlusOutlined, SettingOutlined, MinusOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { WorkspaceState, TabInfo } from '../../types/workspace';
import SidePanel from '../../components/workspace/SidePanel';
import TabContainer from '../../components/workspace/TabContainer';
import { Asset } from '../../types';
import { nanoid } from 'nanoid';
import { fetchAssets } from '../../store/assetSlice';
import { getCurrentUser } from '../../store/authSlice';

const { Sider, Content } = Layout;
const { Title } = Typography;

const WorkspaceStandalone: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { assets } = useSelector((state: RootState) => state.asset);
  const { user, token, loading } = useSelector((state: RootState) => state.auth);

  // 获取用户信息
  useEffect(() => {
    if (token && !user && !loading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, loading]);
  
  // 独立工作台状态管理
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    tabs: [],
    activeTabId: '',
    sidebarWidth: 280,
    sidebarCollapsed: false,
    layout: 'horizontal',
    loading: false,
    error: null
  });

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // 侧边栏折叠状态
  const handleSidebarToggle = useCallback(() => {
    setWorkspaceState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  }, []);

  // 新建连接
  const handleNewConnection = useCallback(() => {
    const newTab: TabInfo = {
      id: nanoid(),
      title: `新连接-${Date.now().toString().slice(-4)}`,
      type: 'ssh',
      assetInfo: {
        id: Math.floor(Math.random() * 1000),
        name: `demo-server-${Date.now().toString().slice(-4)}`,
        address: '192.168.1.100',
        port: 22,
        protocol: 'ssh',
        os_type: 'linux'
      },
      credentialInfo: {
        id: 1,
        username: 'root',
        type: 'password',
        name: '演示凭证'
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

    message.success(`已创建新连接: ${newTab.title}`);
  }, []);

  // 资产选择处理
  const handleAssetSelect = useCallback((asset: Asset) => {
    console.log('选中资产:', asset);
    
    // 检查是否已有相同资产的连接
    const existingTab = workspaceState.tabs.find(tab => tab.assetInfo.id === asset.id);
    if (existingTab) {
      setWorkspaceState(prev => ({
        ...prev,
        activeTabId: existingTab.id
      }));
      message.info(`切换到已有连接: ${asset.name}`);
      return;
    }

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
  }, [workspaceState.tabs]);

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

    message.info('连接已关闭');
  }, []);

  // 关闭所有连接
  const handleCloseAll = useCallback(() => {
    if (workspaceState.tabs.length === 0) return;
    
    Modal.confirm({
      title: '确认关闭所有连接？',
      content: `即将关闭 ${workspaceState.tabs.length} 个连接，未保存的数据将丢失。`,
      okText: '确认关闭',
      cancelText: '取消',
      okType: 'danger',
      onOk() {
        setWorkspaceState(prev => ({
          ...prev,
          tabs: [],
          activeTabId: ''
        }));
        message.success('已关闭所有连接');
      }
    });
  }, [workspaceState.tabs.length]);

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
      // Ctrl+W 关闭当前标签页
      if (e.ctrlKey && e.key === 'w' && workspaceState.activeTabId) {
        e.preventDefault();
        handleTabClose(workspaceState.activeTabId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNewConnection, handleSidebarToggle, handleTabClose, workspaceState.activeTabId]);

  // 处理 URL 参数，自动创建连接
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const assetId = searchParams.get('asset');
    const assetName = searchParams.get('name');
    
    if (assetId && assetName) {
      // 确保资产数据已加载
      if (assets.length === 0) {
        dispatch(fetchAssets({ page: 1, page_size: 100, type: 'server' }));
      } else {
        // 查找对应的资产
        const asset = assets.find(a => a.id === parseInt(assetId));
        if (asset) {
          handleAssetSelect(asset);
        } else {
          // 如果找不到资产，创建一个临时资产信息
          const tempAsset: Asset = {
            id: parseInt(assetId),
            name: decodeURIComponent(assetName),
            address: '127.0.0.1',
            port: 22,
            protocol: 'ssh',
            type: 'server',
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            os_type: 'linux'
          };
          handleAssetSelect(tempAsset);
        }
      }
    }
  }, [location.search, assets, dispatch]);

  // 加载资产数据
  useEffect(() => {
    if (assets.length === 0) {
      dispatch(fetchAssets({ page: 1, page_size: 100, type: 'server' }));
    }
  }, [dispatch, assets.length]);

  // 设置页面标题
  useEffect(() => {
    const originalTitle = document.title;
    document.title = '连接工作台 - Bastion';
    
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      {/* 左侧面板 */}
      <Sider
        width={workspaceState.sidebarCollapsed ? 0 : workspaceState.sidebarWidth}
        collapsedWidth={0}
        collapsed={workspaceState.sidebarCollapsed}
        style={{
          background: '#fff',
          borderRight: '1px solid #d9d9d9',
          transition: 'all 0.3s ease'
        }}
      >
        {!workspaceState.sidebarCollapsed && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 侧边栏标题 */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Title level={5} style={{ margin: 0, color: '#262626' }}>
                主机资源
              </Title>
              <Button
                type="text"
                size="small"
                icon={<MenuFoldOutlined />}
                onClick={handleSidebarToggle}
                title="折叠侧边栏 (Ctrl+B)"
              />
            </div>
            
            {/* 侧边栏内容 */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SidePanel
                width={workspaceState.sidebarWidth}
                collapsed={false}
                onAssetSelect={handleAssetSelect}
                onToggleCollapse={handleSidebarToggle}
              />
            </div>
          </div>
        )}
      </Sider>

      {/* 主内容区域 */}
      <Layout style={{ background: '#f0f2f5' }}>
        {/* 顶部工具栏 */}
        <div style={{
          height: '48px',
          background: '#fff',
          borderBottom: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {workspaceState.sidebarCollapsed && (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={handleSidebarToggle}
                title="展开侧边栏 (Ctrl+B)"
              />
            )}
            <Title level={5} style={{ margin: 0, color: '#262626' }}>
              连接工作台
            </Title>
            <span style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {workspaceState.tabs.length > 0 && `${workspaceState.tabs.length} 个连接`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={handleNewConnection}
              title="新建连接 (Ctrl+T)"
            >
              新建
            </Button>
            
            {workspaceState.tabs.length > 0 && (
              <Button
                type="text"
                icon={<MinusOutlined />}
                onClick={handleCloseAll}
                danger
                title="关闭所有连接"
              >
                关闭全部
              </Button>
            )}
            
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => setIsSettingsVisible(true)}
              title="工作台设置"
            />
          </div>
        </div>

        {/* 标签页内容区域 */}
        <Content style={{
          height: 'calc(100vh - 48px)',
          padding: '8px',
          overflow: 'hidden'
        }}>
          <TabContainer
            tabs={workspaceState.tabs}
            activeTabId={workspaceState.activeTabId}
            onTabChange={handleTabChange}
            onTabClose={handleTabClose}
            onNewTab={handleNewConnection}
          />
        </Content>
      </Layout>

      {/* 设置对话框 */}
      <Modal
        title="工作台设置"
        open={isSettingsVisible}
        onCancel={() => setIsSettingsVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <p>工作台设置功能将在后续版本中实现</p>
        </div>
      </Modal>
    </Layout>
  );
};

export default WorkspaceStandalone;