import React from 'react';
import { Empty, Spin, Progress } from 'antd';
import { HostDistribution } from '../../store/dashboardSlice';
import './HostDistributionChart.css';

interface HostDistributionChartProps {
  distribution: HostDistribution[];
  loading?: boolean;
}

const COLORS = ['#52c41a', '#fa8c16', '#1890ff', '#722ed1', '#eb2f96', '#13c2c2'];

const HostDistributionChart: React.FC<HostDistributionChartProps> = ({ distribution, loading }) => {
  if (loading) {
    return (
      <div className="chart-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!distribution || distribution.length === 0) {
    return (
      <div className="chart-empty">
        <Empty description="暂无数据" />
      </div>
    );
  }

  // 计算总数
  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  // 模拟资产类型数据（实际应该从后端获取）
  const assetTypes = [
    { name: '主机', count: total, color: '#52c41a', icon: '💻' },
    { name: '数据库', count: 0, color: '#fa8c16', icon: '🗄️' },
    { name: '网络设备', count: 0, color: '#1890ff', icon: '🌐' }
  ];

  return (
    <div className="asset-distribution">
      <div className="asset-total">
        <span className="total-label">资产总数</span>
        <span className="total-value">{total}</span>
      </div>
      
      <div className="asset-list">
        {assetTypes.map((asset, index) => (
          <div key={index} className="asset-item">
            <div className="asset-icon">{asset.icon}</div>
            <div className="asset-info">
              <div className="asset-name">{asset.name}</div>
              <div className="asset-count" style={{ color: asset.color }}>
                {asset.count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(HostDistributionChart);