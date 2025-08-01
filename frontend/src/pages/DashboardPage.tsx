import React, { useEffect, Suspense, useCallback } from 'react';
import { Layout, Row, Col, Card, Spin, Alert, Space } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchDashboardData } from '../store/dashboardSlice';
import ErrorBoundary from '../components/ErrorBoundary';
import './DashboardPage.css';

// 懒加载组件
const StatsCards = React.lazy(() => import('../components/dashboard/StatsCards'));
const RecentLoginTable = React.lazy(() => import('../components/dashboard/RecentLoginTable'));
const HostDistributionChart = React.lazy(() => import('../components/dashboard/HostDistributionChart'));
const AuditSummary = React.lazy(() => import('../components/dashboard/AuditSummary'));
const QuickAccessList = React.lazy(() => import('../components/dashboard/QuickAccessList'));

const { Content } = Layout;

// 组件加载时的占位组件
const ComponentLoader: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: 100 
  }}>
    <Spin />
  </div>
);

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  
  const { 
    data, 
    loading, 
    error 
  } = useAppSelector((state) => state.dashboard);

  // 初始化加载数据
  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading && !data) {
    return (
      <Content className="dashboard-page">
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </Content>
    );
  }

  if (error && !data) {
    return (
      <Content className="dashboard-page">
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <button onClick={handleRefresh}>重新加载</button>
            </Space>
          }
        />
      </Content>
    );
  }

  return (
    <ErrorBoundary>
      <Content className="dashboard-page">
      <div className="dashboard-header">
        <h1>堡垒机仪表盘</h1>
        <div className="dashboard-actions">
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <SyncOutlined spin={loading} />
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <Suspense fallback={<ComponentLoader />}>
        <StatsCards stats={data?.stats || null} loading={loading} />
      </Suspense>

      {/* 主要内容区域 */}
      <Row gutter={24} className="dashboard-content">
        <Col span={16}>
          <Card 
            title="最近登录历史" 
            className="content-card"
          >
            <Suspense fallback={<ComponentLoader />}>
              <RecentLoginTable 
                recentLogins={data?.recent_logins || []} 
                loading={loading}
              />
            </Suspense>
          </Card>
        </Col>
        <Col span={8}>
          <Card 
            title="主机分组分布" 
            className="content-card"
          >
            <Suspense fallback={<ComponentLoader />}>
              <HostDistributionChart 
                distribution={data?.host_distribution || []} 
                loading={loading}
              />
            </Suspense>
          </Card>
        </Col>
      </Row>

      {/* 底部区域 */}
      <Row gutter={24} className="dashboard-bottom">
        <Col span={12}>
          <Card 
            title="审计统计概览" 
            className="content-card"
          >
            <Suspense fallback={<ComponentLoader />}>
              <AuditSummary 
                summary={data?.audit_summary || null} 
                loading={loading}
              />
            </Suspense>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title="我的主机 - 快速访问" 
            className="content-card"
          >
            <Suspense fallback={<ComponentLoader />}>
              <QuickAccessList 
                hosts={data?.quick_access || []} 
                loading={loading}
              />
            </Suspense>
          </Card>
        </Col>
      </Row>
    </Content>
    </ErrorBoundary>
  );
};

export default DashboardPage;