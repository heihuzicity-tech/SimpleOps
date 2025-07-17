import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Input, List, Button, Avatar, Space, Tooltip, Empty, message } from 'antd';
import { 
  SearchOutlined, 
  HistoryOutlined, 
  FolderOutlined, 
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  UserOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchAssets } from '../../store/assetSlice';
import { fetchCredentials } from '../../store/credentialSlice';
import ResourceTree from '../sessions/ResourceTree';
import { ConnectionHistoryItem } from '../../types/workspace';
import { Asset } from '../../types';
import ConnectionHistoryService from '../../services/workspace/connectionHistory';

const { TabPane } = Tabs;
const { Search } = Input;

interface SidePanelProps {
  width: number;
  collapsed: boolean;
  onAssetSelect: (asset: Asset) => void;
  onToggleCollapse: () => void;
  onWidthChange?: (width: number) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  width,
  collapsed,
  onAssetSelect,
  onToggleCollapse,
  onWidthChange
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { assets, total, loading } = useSelector((state: RootState) => state.asset);
  const { credentials } = useSelector((state: RootState) => state.credential);
  
  const [activeTab, setActiveTab] = useState('resources');
  const [searchValue, setSearchValue] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryItem[]>([]);

  // 加载连接历史记录
  const loadConnectionHistory = useCallback(() => {
    try {
      const history = ConnectionHistoryService.getRecentConnections(10);
      setConnectionHistory(history);
    } catch (error) {
      console.error('加载连接历史失败:', error);
    }
  }, []);

  // 加载资产和凭证数据
  useEffect(() => {
    dispatch(fetchAssets({ page: 1, page_size: 100 }));
    dispatch(fetchCredentials({ page: 1, page_size: 100 }));
  }, [dispatch]);

  // 加载连接历史记录
  useEffect(() => {
    loadConnectionHistory();
  }, [loadConnectionHistory]);

  // 处理资源树选择
  const handleResourceSelect = useCallback((selectedKeys: React.Key[], info: any) => {
    console.log('资源树选择:', selectedKeys, info);
    setSelectedKeys(selectedKeys);
    
    if (selectedKeys.length > 0 && info.selected) {
      const selectedKey = selectedKeys[0];
      
      // 如果选择的是具体资产
      if (selectedKey !== 'all' && !isNaN(Number(selectedKey))) {
        const asset = assets.find(a => a.id === Number(selectedKey));
        if (asset) {
          onAssetSelect(asset);
          message.success(`选择了主机: ${asset.name}`);
        }
      } else {
        // 选择的是分组，显示该分组下的资产
        message.info(`选择了分组: ${info.node.title}`);
      }
    }
  }, [assets, onAssetSelect]);

  // 处理历史记录点击
  const handleHistoryClick = useCallback((item: ConnectionHistoryItem) => {
    const asset = assets.find(a => a.id === item.assetId);
    if (asset) {
      onAssetSelect(asset);
      message.success(`快速连接到: ${asset.name}`);
    } else {
      message.warning('该资产已不存在');
    }
  }, [assets, onAssetSelect]);

  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    ConnectionHistoryService.clearHistory();
    setConnectionHistory([]);
    message.success('历史记录已清空');
  }, []);

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  // 渲染资源标签页
  const renderResourcesTab = () => {
    if (collapsed) {
      return (
        <div style={{ 
          padding: '8px 0',
          textAlign: 'center'
        }}>
          <Tooltip title="资源管理" placement="right">
            <Button 
              type="text" 
              icon={<FolderOutlined />}
              onClick={onToggleCollapse}
              style={{ width: '100%' }}
            />
          </Tooltip>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 8 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Search
              placeholder="搜索资源"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ flex: 1 }}
              size="small"
              prefix={<SearchOutlined />}
            />
            <Tooltip title="刷新资源列表">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => dispatch(fetchAssets({ page: 1, page_size: 100 }))}
                loading={loading}
                size="small"
              />
            </Tooltip>
          </Space>
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ResourceTree
            onSelect={handleResourceSelect}
            resourceType="host"
            selectedKeys={selectedKeys}
            totalCount={total}
            searchValue={searchValue}
          />
        </div>
      </div>
    );
  };

  // 渲染历史记录标签页
  const renderHistoryTab = () => {
    if (collapsed) {
      return (
        <div style={{ 
          padding: '8px 0',
          textAlign: 'center'
        }}>
          <Tooltip title="连接历史" placement="right">
            <Button 
              type="text" 
              icon={<HistoryOutlined />}
              onClick={onToggleCollapse}
              style={{ width: '100%' }}
            />
          </Tooltip>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 8 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#666' }}>
              最近连接记录
            </span>
            {connectionHistory.length > 0 && (
              <Button
                type="text"
                onClick={handleClearHistory}
                size="small"
                style={{ fontSize: 12 }}
              >
                清空
              </Button>
            )}
          </Space>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto' }}>
          {connectionHistory.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无连接记录"
              style={{ marginTop: 40 }}
            />
          ) : (
            <List
              size="small"
              dataSource={connectionHistory}
              renderItem={(item) => (
                <List.Item
                  style={{ 
                    padding: '8px 0',
                    cursor: 'pointer',
                    borderRadius: 4,
                    margin: '2px 0'
                  }}
                  onClick={() => handleHistoryClick(item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: 4 
                    }}>
                      <Avatar 
                        size={20} 
                        icon={<CloudServerOutlined />} 
                        style={{ 
                          backgroundColor: '#1890ff',
                          marginRight: 8,
                          fontSize: 10
                        }}
                      />
                      <span style={{ 
                        fontSize: 12, 
                        fontWeight: 500,
                        color: '#333'
                      }}>
                        {item.assetName}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: '#666',
                      marginLeft: 28,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>
                        <UserOutlined style={{ marginRight: 4 }} />
                        {item.username}
                      </span>
                      <span>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {formatTime(item.connectedAt.toString())}
                      </span>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      </div>
    );
  };

  // 折叠状态时的渲染
  if (collapsed) {
    return (
      <div style={{ 
        width: 60,
        height: '100%',
        backgroundColor: '#fafafa',
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16
      }}>
        <Tooltip title="展开侧边栏" placement="right">
          <Button 
            type="text" 
            icon={<FolderOutlined />}
            onClick={onToggleCollapse}
            style={{ marginBottom: 16 }}
          />
        </Tooltip>
        
        <Tooltip title="连接历史" placement="right">
          <Button 
            type="text" 
            icon={<HistoryOutlined />}
            onClick={() => {
              onToggleCollapse();
              setActiveTab('history');
            }}
            style={{ marginBottom: 16 }}
          />
        </Tooltip>
      </div>
    );
  }

  // 正常状态时的渲染
  return (
    <div style={{ 
      width: width, 
      height: '100%',
      backgroundColor: '#fafafa',
      borderRight: '1px solid #f0f0f0'
    }}>
      <Card 
        size="small" 
        style={{ 
          height: '100%', 
          border: 'none',
          borderRadius: 0
        }}
        styles={{ 
          body: { 
            padding: '16px 12px',
            height: '100%'
          } 
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          style={{ height: '100%' }}
          items={[
            {
              key: 'resources',
              label: (
                <span>
                  <FolderOutlined />
                  资源
                </span>
              ),
              children: renderResourcesTab()
            },
            {
              key: 'history',
              label: (
                <span>
                  <HistoryOutlined />
                  历史
                </span>
              ),
              children: renderHistoryTab()
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default SidePanel;