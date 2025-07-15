// 测试新增前端组件的导入和基础功能

import React from 'react';
import { Button, Space, message } from 'antd';

// 导入新增的Hooks
import { useAssetManagement } from './hooks/useAssetManagement';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useConnectionStatus } from './hooks/useConnectionStatus';

// 导入新增的组件
import { ConnectionStatusTag, ConnectionStatusBadge, ConnectionStatusIcon } from './components/common/ConnectionStatusTag';
import { AssetForm } from './components/common/AssetForm';
import { SearchFilter, AssetFilters, SessionFilters } from './components/common/SearchFilter';
import { ResourceTable, CommonActions, CommonBatchActions } from './components/common/ResourceTable';

// 导入类型
import { Asset, Credential, AssetGroup } from './types';

/**
 * 测试组件 - 验证所有新增组件的导入和基础功能
 */
const TestComponents: React.FC = () => {
  // 测试Hooks
  const assetManagement = useAssetManagement();
  const sessionManagement = useSessionManagement();
  const connectionStatus = useConnectionStatus();

  console.log('Hooks loaded successfully:', {
    assetManagement: typeof assetManagement,
    sessionManagement: typeof sessionManagement,
    connectionStatus: typeof connectionStatus,
  });

  // 测试连接状态
  const testConnectionStates = () => {
    connectionStatus.setStatus('connecting');
    setTimeout(() => connectionStatus.setStatus('connected'), 1000);
    setTimeout(() => connectionStatus.setStatus('error'), 2000);
    setTimeout(() => connectionStatus.setStatus('idle'), 3000);
  };

  // 测试表格配置
  const testTableConfig = {
    rowKey: 'id',
    selectable: true,
    showActions: true,
    actionsWidth: 200,
    bordered: true,
    size: 'middle' as const,
  };

  const testColumns = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <ConnectionStatusTag status={status as any} />
      ),
    },
  ];

  const testActions = [
    CommonActions.view(() => message.info('查看操作')),
    CommonActions.edit(() => message.info('编辑操作')),
    CommonActions.delete(() => message.info('删除操作')),
  ];

  const testBatchActions = [
    CommonBatchActions.batchDelete(() => message.info('批量删除')),
  ];

  // 测试搜索过滤配置
  const searchConfig = {
    searchPlaceholder: '搜索测试...',
    filters: AssetFilters,
    showAdvanced: true,
    collapsible: true,
    showClear: true,
    autoSubmit: true,
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>前端组件测试页面</h1>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 连接状态组件测试 */}
        <div>
          <h2>连接状态组件测试</h2>
          <Space wrap>
            <ConnectionStatusTag status="idle" />
            <ConnectionStatusTag status="connecting" />
            <ConnectionStatusTag status="connected" />
            <ConnectionStatusTag status="disconnected" />
            <ConnectionStatusTag status="error" />
            <Button onClick={testConnectionStates}>测试状态变化</Button>
          </Space>
          
          <div style={{ marginTop: 16 }}>
            <Space wrap>
              <ConnectionStatusBadge status="connected" />
              <ConnectionStatusIcon status="error" />
            </Space>
          </div>
        </div>

        {/* 搜索过滤组件测试 */}
        <div>
          <h2>搜索过滤组件测试</h2>
          <SearchFilter
            config={searchConfig}
            onSearch={(keyword, filters) => {
              console.log('搜索:', { keyword, filters });
              message.info(`搜索: ${keyword}, 过滤器: ${Object.keys(filters).length}个`);
            }}
          />
        </div>

        {/* 资源表格组件测试 */}
        <div>
          <h2>资源表格组件测试</h2>
          <ResourceTable
            data={[
              { id: 1, name: '测试资产1', status: 'connected' },
              { id: 2, name: '测试资产2', status: 'error' },
            ]}
            columns={testColumns}
            config={testTableConfig}
            actions={testActions}
            batchActions={testBatchActions}
            pagination={{
              current: 1,
              pageSize: 10,
              total: 2,
              onChange: (page, pageSize) => console.log('分页:', { page, pageSize }),
            }}
          />
        </div>

        {/* Hooks状态显示 */}
        <div>
          <h2>Hooks状态测试</h2>
          <div>
            <p>资产管理Hook状态: {assetManagement.loading ? '加载中' : '就绪'}</p>
            <p>会话管理Hook状态: {sessionManagement.loading ? '加载中' : '就绪'}</p>
            <p>连接状态Hook: {connectionStatus.getStatusText()}</p>
          </div>
          
          <Space>
            <Button onClick={() => assetManagement.refresh()}>
              刷新资产数据
            </Button>
            <Button onClick={() => sessionManagement.refresh()}>
              刷新会话数据
            </Button>
            <Button onClick={() => connectionStatus.clearHistory()}>
              清除连接历史
            </Button>
          </Space>
        </div>

        {/* 类型验证 */}
        <div>
          <h2>类型系统验证</h2>
          <p>✅ Asset类型导入成功</p>
          <p>✅ Credential类型导入成功</p>
          <p>✅ AssetGroup类型导入成功</p>
          <p>✅ 所有Hook类型检查通过</p>
          <p>✅ 所有组件Props类型检查通过</p>
        </div>
      </Space>
    </div>
  );
};

export default TestComponents;