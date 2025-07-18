import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout, Button, Typography, message, Modal, Tabs } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import CredentialSelector from '../../components/sessions/CredentialSelector';
import WebTerminal from '../../components/ssh/WebTerminal';
import ResourceTree from '../../components/sessions/ResourceTree';
import { Asset } from '../../types';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import { getCurrentUser } from '../../store/authSlice';
import { createSession } from '../../store/sshSessionSlice';
import { performConnectionTest } from '../../services/connectionTest';

const { Sider, Content } = Layout;
const { Title } = Typography;

interface TabInfo {
  id: string;
  title: string;
  sessionId: string;
  assetInfo: Asset;
  credentialInfo: any;
  closable: boolean;
}

const WorkspaceStandalone: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { assets } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  const { user, token, loading } = useSelector((state: RootState) => state.auth);

  // 获取用户信息
  useEffect(() => {
    if (token && !user && !loading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, loading]);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [credentialSelectorVisible, setCredentialSelectorVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const autoConnectProcessedRef = useRef(false);
  const processedUrlRef = useRef('');

  // 侧边栏折叠状态
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed]);

  // 新建连接
  const handleNewConnection = useCallback(() => {
    if (assets.length === 0) {
      message.warning('暂无可用主机资源，请先添加主机');
      return;
    }
    
    // 不设置默认资产，让用户从左侧选择
    message.info('请从左侧主机资源列表中选择要连接的主机');
  }, [assets]);

  // 主机选择处理 - 直接使用资产数据
  const handleHostSelect = useCallback((asset: Asset) => {
    console.log('选中主机:', asset);
    
    // 允许同一个主机打开多个标签页，直接打开凭证选择
    setSelectedAsset(asset);
    setCredentialSelectorVisible(true);
  }, []);

  // 处理树形菜单选择
  const handleTreeSelect = useCallback((selectedKeys: React.Key[], info: any) => {
    console.log('树形选择:', selectedKeys, info);
    
    // 检查是否选中了具体的主机资产
    if (selectedKeys.length > 0) {
      const selectedKey = selectedKeys[0] as string;
      
      // 检查是否是主机资产（以 asset- 开头）
      if (selectedKey.startsWith('asset-')) {
        const assetId = parseInt(selectedKey.replace('asset-', ''));
        const asset = assets.find(a => a.id === assetId);
        
        if (asset) {
          handleHostSelect(asset);
        }
      }
    }
  }, [assets, handleHostSelect]);

  // 处理凭证选择 - 使用现有的简单逻辑
  const handleCredentialSelect = useCallback(async (credentialId: number) => {
    if (!selectedAsset || connecting) return;

    setCredentialSelectorVisible(false);
    setConnecting(true);

    try {
      // 使用静默模式进行连接测试
      const testResult = await performConnectionTest(dispatch, selectedAsset, credentialId, true);

      if (!testResult.success) {
        message.error(testResult.message);
        return;
      }

      // 测试通过，创建会话
      const response = await dispatch(createSession({
        asset_id: selectedAsset.id,
        credential_id: credentialId,
        protocol: selectedAsset.protocol || 'ssh'
      })).unwrap();

      // 创建新标签页，使用时间戳确保唯一性
      const credential = credentials.find(c => c.id === credentialId);
      const timestamp = Date.now();
      const newTab: TabInfo = {
        id: `${response.id}-${timestamp}`,
        title: `${selectedAsset.name}@${credential?.username}`,
        sessionId: response.id,
        assetInfo: selectedAsset,
        credentialInfo: credential,
        closable: true
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);

      // 连接成功，但不显示提示消息
    } catch (error: any) {
      message.error(`连接失败: ${error.message}`);
    } finally {
      setConnecting(false);
      setSelectedAsset(null);
    }
  }, [selectedAsset, credentials, dispatch, connecting]);

  // 标签页切换处理
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // 标签页关闭处理
  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // 如果关闭的是当前活跃标签页，切换到其他标签页
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTabId('');
        }
      }
      
      return newTabs;
    });
    
    // 连接已关闭，但不显示提示消息
  }, [activeTabId]);



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
      if (e.ctrlKey && e.key === 'w' && activeTabId) {
        e.preventDefault();
        handleTabClose(activeTabId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNewConnection, handleSidebarToggle, handleTabClose, activeTabId]);

  // 加载资产和凭证数据 - 只有在用户已登录且有token时才加载
  useEffect(() => {
    if (token && user) {
      if (assets.length === 0) {
        dispatch(fetchAssets({ page: 1, page_size: 100, type: 'server' }));
      }
      if (credentials.length === 0) {
        dispatch(fetchCredentials({ page: 1, page_size: 100 }));
      }
    }
  }, [dispatch, token, user, assets.length, credentials.length]);

  // 处理URL参数自动连接
  useEffect(() => {
    // 检查数据是否完整加载
    if (!token || !user || assets.length === 0 || credentials.length === 0) {
      return;
    }

    const currentUrl = location.search;
    const searchParams = new URLSearchParams(currentUrl);
    const assetId = searchParams.get('assetId');
    const assetName = searchParams.get('name');
    const assetAddress = searchParams.get('address');
    
    // 检查是否有相关参数
    if (!assetId && !assetName && !assetAddress) {
      return;
    }

    // 检查是否已经处理过相同URL
    if (autoConnectProcessedRef.current || processedUrlRef.current === currentUrl) {
      return;
    }

    // 标记为已处理
    autoConnectProcessedRef.current = true;
    processedUrlRef.current = currentUrl;
    
    // 立即清除URL参数，防止重复处理
    const newUrl = window.location.pathname;
    window.history.replaceState(null, '', newUrl);
    
    let targetAsset: Asset | undefined;
    
    if (assetId) {
      // 根据资产ID查找资产
      targetAsset = assets.find(asset => asset.id === parseInt(assetId));
      if (!targetAsset) {
        message.error(`未找到ID为 ${assetId} 的主机资源`);
        return;
      }
    } else if (assetName && assetAddress) {
      // 根据主机名或地址查找资产
      targetAsset = assets.find(asset => 
        asset.name === assetName || asset.address === assetAddress
      );
      if (!targetAsset) {
        message.error(`未找到主机: ${assetName || assetAddress}`);
        return;
      }
    }

    if (targetAsset) {
      console.log('自动连接主机:', targetAsset);
      
      // 直接打开凭证选择对话框，不显示额外提示
      setTimeout(() => {
        setSelectedAsset(targetAsset!);
        setCredentialSelectorVisible(true);
      }, 100);
    }
  }, [token, user, assets, credentials, location.search]);

  // 设置页面标题
  useEffect(() => {
    const originalTitle = document.title;
    document.title = '连接工作台 - Bastion';
    
    return () => {
      document.title = originalTitle;
    };
  }, []);

  // 渲染空状态
  const renderEmptyState = () => (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>欢迎使用连接工作台</h2>
        <p>从左侧选择主机资源开始连接</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button type="primary" onClick={handleNewConnection}>
            选择主机连接
          </Button>
        </div>
      </div>
    </div>
  );

  // 渲染标签页
  const renderTabs = () => {
    if (tabs.length === 0) {
      return renderEmptyState();
    }

    const tabItems = tabs.map(tab => ({
      key: tab.id,
      label: tab.title,
      closable: tab.closable,
      children: (
        <div style={{ height: 'calc(100vh - 40px)' }}>
          <WebTerminal
            sessionId={tab.sessionId}
            onClose={() => handleTabClose(tab.id)}
            onError={(error) => {
              console.error(`Terminal error for tab ${tab.id}:`, error);
              message.error(`连接错误: ${error.message}`);
            }}
          />
        </div>
      )
    }));

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {/* 折叠状态下的绝对定位按钮 */}
        {sidebarCollapsed && (
          <Button
            type="primary"
            icon={<MenuUnfoldOutlined />}
            onClick={handleSidebarToggle}
            title="展开侧边栏 (Ctrl+B)"
            size="small"
            style={{
              position: 'absolute',
              top: '6px',
              left: '6px',
              zIndex: 1000,
              borderRadius: '4px',
              height: '28px',
              width: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          />
        )}
        
        <Tabs
          type="editable-card"
          activeKey={activeTabId}
          onChange={handleTabChange}
          onEdit={(targetKey, action) => {
            if (action === 'remove') {
              handleTabClose(targetKey as string);
            }
          }}
          hideAdd
          size="small"
          style={{ 
            height: '100%',
            margin: 0
          }}
          tabBarStyle={{
            margin: 0,
            marginBottom: 4,
            paddingLeft: sidebarCollapsed ? 40 : 4,
            paddingRight: 4,
            position: 'relative'
          }}
          items={tabItems}
        />
      </div>
    );
  };

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      {/* 左侧面板 */}
      <Sider
        width={sidebarCollapsed ? 0 : 240}
        collapsedWidth={0}
        collapsed={sidebarCollapsed}
        style={{
          background: '#fff',
          borderRight: '1px solid #d9d9d9',
          transition: 'all 0.3s ease'
        }}
      >
        {!sidebarCollapsed && (
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
            <div style={{ flex: 1, overflow: 'hidden', padding: '8px' }}>
              <ResourceTree 
                resourceType="host"
                onSelect={handleTreeSelect}
                totalCount={assets.filter(a => a.type === 'server').length}
                hideSearch={true}
                showHostDetails={true}
              />
            </div>
          </div>
        )}
      </Sider>

      {/* 主内容区域 */}
      <Layout style={{ background: '#f0f2f5' }}>
        {/* 标签页内容区域 - 移除顶部工具栏，节省空间 */}
        <Content style={{
          height: '100vh',
          padding: sidebarCollapsed ? '4px 4px 4px 0' : '4px',
          overflow: 'hidden'
        }}>
          {renderTabs()}
        </Content>
      </Layout>

      {/* 凭证选择对话框 */}
      <CredentialSelector
        visible={credentialSelectorVisible}
        asset={selectedAsset}
        credentials={credentials}
        onSelect={handleCredentialSelect}
        onCancel={() => {
          setCredentialSelectorVisible(false);
          setSelectedAsset(null);
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