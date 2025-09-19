import React, { useEffect, Suspense } from 'react';
import { Layout, Row, Col, Card, Spin, Alert, Space } from 'antd';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchDashboardData } from '../store/dashboardSlice';
import ErrorBoundary from '../components/ErrorBoundary';
import './DashboardPage.css';

// 懒加载组件
const StatsCards = React.lazy(() => import('../components/dashboard/StatsCards'));
const RecentLoginTable = React.lazy(() => import('../components/dashboard/RecentLoginTable'));
const HostDistributionChart = React.lazy(() => import('../components/dashboard/HostDistributionChart'));
const AuditSummary = React.lazy(() => import('../components/dashboard/AuditSummary'));

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
              <button onClick={() => dispatch(fetchDashboardData())}>重新加载</button>
            </Space>
          }
        />
      </Content>
    );
  }

  return (
    <ErrorBoundary>
      <Content className="dashboard-page">
      {/* 统计卡片 */}
      <Suspense fallback={<ComponentLoader />}>
        <StatsCards stats={data?.stats || null} loading={loading} />
      </Suspense>

      {/* 审计统计概览 - 移至上方 */}
      <Row gutter={24} style={{ marginBottom: 24, padding: '0 24px' }}>
        <Col span={24}>
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
      </Row>

      {/* 主要内容区域 */}
      <Row gutter={24} className="dashboard-content" style={{ padding: '0 24px' }}>
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
            title="资产统计" 
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
    </Content>
    </ErrorBoundary>
  );
};

export default DashboardPage;