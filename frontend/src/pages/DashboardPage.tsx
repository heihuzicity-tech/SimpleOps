import React, { useEffect } from 'react';
import { Layout, Row, Col, Card, Spin, Alert, Space } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchDashboardData } from '../store/dashboardSlice';
import StatsCards from '../components/dashboard/StatsCards';
import RecentLoginTable from '../components/dashboard/RecentLoginTable';
import HostDistributionChart from '../components/dashboard/HostDistributionChart';
import AuditSummary from '../components/dashboard/AuditSummary';
import QuickAccessList from '../components/dashboard/QuickAccessList';
import './DashboardPage.css';

const { Content } = Layout;

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
  const handleRefresh = () => {
    dispatch(fetchDashboardData());
  };

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
      <StatsCards stats={data?.stats || null} loading={loading} />

      {/* 主要内容区域 */}
      <Row gutter={24} className="dashboard-content">
        <Col span={16}>
          <Card 
            title="最近登录历史" 
            className="content-card"
          >
            <RecentLoginTable 
              recentLogins={data?.recent_logins || []} 
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card 
            title="主机分组分布" 
            className="content-card"
          >
            <HostDistributionChart 
              distribution={data?.host_distribution || []} 
              loading={loading}
            />
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
            <AuditSummary 
              summary={data?.audit_summary || null} 
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title="我的主机 - 快速访问" 
            className="content-card"
          >
            <QuickAccessList 
              hosts={data?.quick_access || []} 
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </Content>
  );
};

export default DashboardPage;