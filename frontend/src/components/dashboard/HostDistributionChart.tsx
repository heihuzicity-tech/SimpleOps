import React from 'react';
import { Empty, Spin } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
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

  // 自定义标签
  const renderCustomizedLabel = ({
    cx,
    cy,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    if (percent < 0.05) return null; // 小于5%不显示标签
    
    return (
      <text 
        x={cx} 
        y={cy} 
        fill="#333" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize="14"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // 自定义图例
  const renderLegend = () => {
    return (
      <ul className="custom-legend">
        {distribution.map((item, index) => (
          <li key={`item-${index}`} className="legend-item">
            <span 
              className="legend-dot" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="legend-text">
              {item.group_name} ({item.count})
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // 自定义提示框
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{data.name}</p>
          <p className="tooltip-value">
            数量: {data.value} ({(data.payload.percent || 0).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // 为Recharts准备数据，确保有name字段
  const chartData = distribution.map(item => ({
    ...item,
    name: item.group_name,
    value: item.count
  }));

  return (
    <div className="host-distribution-chart">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            innerRadius={40}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={100}
            content={renderLegend}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="chart-center-info">
        <div className="center-value">{total}</div>
        <div className="center-label">主机总数</div>
      </div>
    </div>
  );
};

export default React.memo(HostDistributionChart);