import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Button, Typography, message, Modal } from 'antd';
import { PlusOutlined, SettingOutlined, MinusOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import SidePanel from '../../components/workspace/SidePanel';
import TabContainer from '../../components/workspace/TabContainer';
import ConnectionCreator from '../../components/workspace/ConnectionCreator';
import { Asset } from '../../types';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import { getCurrentUser } from '../../store/authSlice';
import { 
  setActiveTab, 
  closeTab, 
  closeAllTabs, 
  setSidebarCollapsed, 
  createNewTab,
  duplicateTab,
  createSSHConnection
} from '../../store/workspaceSlice';

const { Sider, Content } = Layout;
const { Title } = Typography;

const WorkspaceStandalone: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { assets } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const { user, token, loading } = useSelector((state: RootState) => state.auth);
  const workspaceState = useSelector((state: RootState) => state.workspace);

  // 获取用户信息
  useEffect(() => {
    if (token && !user && !loading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, loading]);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [connectionCreatorVisible, setConnectionCreatorVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // 侧边栏折叠状态
  const handleSidebarToggle = useCallback(() => {
    dispatch(setSidebarCollapsed(!workspaceState.sidebarCollapsed));
  }, [dispatch, workspaceState.sidebarCollapsed]);

  // 新建连接
  const handleNewConnection = useCallback(() => {
    if (assets.length === 0) {
      message.warning('暂无可用主机资源，请先添加主机');
      return;
    }
    
    // 选择第一个可用资产作为默认选择
    const defaultAsset = assets[0];
    setSelectedAsset(defaultAsset);
    setConnectionCreatorVisible(true);
  }, [assets]);

  // 资产选择处理
  const handleAssetSelect = useCallback((asset: Asset) => {
    console.log('选中资产:', asset);
    
    // 检查是否已有相同资产的连接
    const existingTab = workspaceState.tabs.find(tab => tab.assetInfo.id === asset.id);
    if (existingTab) {
      dispatch(setActiveTab(existingTab.id));
      message.info(`切换到已有连接: ${asset.name}`);
      return;
    }

    // 打开连接创建对话框
    setSelectedAsset(asset);
    setConnectionCreatorVisible(true);
  }, [workspaceState.tabs, dispatch]);

  // 标签页切换处理
  const handleTabChange = useCallback((tabId: string) => {
    dispatch(setActiveTab(tabId));
  }, [dispatch]);

  // 标签页关闭处理
  const handleTabClose = useCallback((tabId: string) => {
    dispatch(closeTab(tabId));
    message.info('连接已关闭');
  }, [dispatch]);

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
        dispatch(closeAllTabs());
        message.success('已关闭所有连接');
      }
    });
  }, [workspaceState.tabs.length, dispatch]);

  // 复制标签页
  const handleTabDuplicate = useCallback((tabId: string) => {
    dispatch(duplicateTab(tabId));
    message.success('标签页已复制');
  }, [dispatch]);

  // 重新连接
  const handleTabReconnect = useCallback(async (tabId: string) => {
    const tab = workspaceState.tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      // 重新创建SSH连接
      await dispatch(createSSHConnection({
        asset: {
          id: tab.assetInfo.id,
          name: tab.assetInfo.name,
          address: tab.assetInfo.address,
          port: tab.assetInfo.port,
          protocol: tab.assetInfo.protocol,
          type: 'server',
          status: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          os_type: tab.assetInfo.os_type
        },
        credential: {
          id: tab.credentialInfo.id,
          username: tab.credentialInfo.username,
          type: tab.credentialInfo.type,
          name: tab.credentialInfo.name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        tabId: tab.id
      })).unwrap();
      
      message.success(`重连成功: ${tab.assetInfo.name}`);
    } catch (error: any) {
      message.error(`重连失败: ${error.message || '未知错误'}`);
    }
  }, [workspaceState.tabs, dispatch]);

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

  // 加载资产和凭证数据
  useEffect(() => {
    if (assets.length === 0) {
      dispatch(fetchAssets({ page: 1, page_size: 100, type: 'server' }));
    }
    if (credentials.length === 0) {
      dispatch(fetchCredentials({ page: 1, page_size: 100 }));
    }
  }, [dispatch, assets.length, credentials.length]);

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
            onTabDuplicate={handleTabDuplicate}
            onTabReconnect={handleTabReconnect}
          />
        </Content>
      </Layout>

      {/* 连接创建对话框 */}
      <ConnectionCreator
        visible={connectionCreatorVisible}
        asset={selectedAsset}
        onCancel={() => {
          setConnectionCreatorVisible(false);
          setSelectedAsset(null);
        }}
        onSuccess={(tabId) => {
          dispatch(setActiveTab(tabId));
          setConnectionCreatorVisible(false);
          setSelectedAsset(null);
          message.success('连接创建成功');
        }}
      />

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