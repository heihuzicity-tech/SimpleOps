import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { 
  DesktopOutlined, 
  CloudServerOutlined, 
  UserOutlined, 
  KeyOutlined 
} from '@ant-design/icons';
import { DashboardStats } from '../../store/dashboardSlice';
import './StatsCards.css';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  const cardData = [
    {
      title: '主机总数',
      value: stats?.hosts.total || 0,
      icon: <DesktopOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
      suffix: stats ? `分组: ${stats.hosts.groups} | 在线: ${stats.hosts.online}` : '',
    },
    {
      title: '在线会话',
      value: stats?.sessions.active || 0,
      icon: <CloudServerOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      suffix: stats ? `SSH: ${stats.sessions.active} | 其他: 0` : '',
    },
    {
      title: '用户总数',
      value: stats?.users.total || 0,
      icon: <UserOutlined />,
      color: '#fa8c16',
      bgColor: '#fff7e6',
      suffix: stats ? `在线: ${stats.users.online} | 今日登录: ${stats.users.today_logins}` : '',
    },
    {
      title: '凭证总数',
      value: (stats?.credentials.passwords || 0) + (stats?.credentials.ssh_keys || 0),
      icon: <KeyOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      suffix: stats ? `密码: ${stats.credentials.passwords} | SSH密钥: ${stats.credentials.ssh_keys}` : '',
    },
  ];

  return (
    <Row gutter={16} className="stats-cards">
      {cardData.map((card, index) => (
        <Col span={6} key={index}>
          <Card 
            className="stat-card"
            loading={loading}
            hoverable
          >
            <div className="stat-card-content">
              <div 
                className="stat-icon"
                style={{ 
                  backgroundColor: card.bgColor,
                  color: card.color 
                }}
              >
                {card.icon}
              </div>
              <div className="stat-info">
                <Statistic
                  title={card.title}
                  value={card.value}
                  valueStyle={{ 
                    fontSize: '32px',
                    fontWeight: 600,
                    color: '#333'
                  }}
                />
                <div className="stat-suffix">
                  {card.suffix}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default StatsCards;