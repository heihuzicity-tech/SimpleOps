import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Spin, Button, Space } from 'antd';
import {
  AuditOutlined,
  EyeOutlined,
  DesktopOutlined,
  CodeOutlined,
  SettingOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuditAPI, AuditStatistics } from '../../services/auditAPI';
import { sshAPI } from '../../services/sshAPI';

const { Title, Text } = Typography;

const AuditOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [realActiveSessionCount, setRealActiveSessionCount] = useState(0);

  // 获取审计统计数据
  const fetchStatistics = async () => {
    setStatsLoading(true);
    try {
      const [auditResponse, sshSessions] = await Promise.all([
        AuditAPI.getAuditStatistics(),
        sshAPI.getSessions()
      ]);
      
      if (auditResponse.success) {
        setStatistics(auditResponse.data);
      }
      
      // 使用实际的SSH会话数量
      setRealActiveSessionCount(sshSessions.filter(session => session.status === 'active').length);
    } catch (error) {
      console.error('获取审计统计失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const auditModules = [
    {
      key: 'online-sessions',
      title: '在线会话审计',
      description: '实时监控正在进行的运维会话，防止运维人员违规操作',
      icon: <EyeOutlined />,
      color: '#1890ff',
      count: realActiveSessionCount,
      path: '/audit/online-sessions'
    },
    {
      key: 'session-audit',
      title: '会话审计',
      description: '查询详细的操作记录，在线审计历史会话，支持会话回放',
      icon: <DesktopOutlined />,
      color: '#52c41a',
      count: statistics?.total_session_records || 0,
      path: '/audit/session-audit'
    },
    {
      key: 'command-audit',
      title: '命令审计',
      description: '记录会话中执行的所有命令，包括命令内容、执行结果和风险等级',
      icon: <CodeOutlined />,
      color: '#fa541c',
      count: statistics?.total_command_logs || 0,
      path: '/audit/command-audit'
    },
    {
      key: 'operation-audit',
      title: '操作审计',
      description: '记录堡垒机用户的所有操作记录，用于进行安全审计和查看',
      icon: <SettingOutlined />,
      color: '#722ed1',
      count: statistics?.total_operation_logs || 0,
      path: '/audit/operation-audit'
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 16 }}>
          <AuditOutlined /> 审计管理
        </Title>
        <Text type="secondary">
          全面的安全审计体系，实时监控和记录所有运维操作，确保系统安全合规
        </Text>
      </Card>

      {/* 统计概览 */}
      <Card title="审计统计概览" style={{ marginBottom: 24 }}>
        <Spin spinning={statsLoading}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="在线会话" 
                value={realActiveSessionCount}
                prefix={<EyeOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="会话记录" 
                value={statistics?.total_session_records || 0}
                prefix={<DesktopOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="命令日志" 
                value={statistics?.total_command_logs || 0}
                prefix={<CodeOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="操作日志" 
                value={statistics?.total_operation_logs || 0}
                prefix={<SettingOutlined />}
              />
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic 
                title="今日会话" 
                value={statistics?.today_sessions || 0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="高危命令" 
                value={statistics?.dangerous_commands || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="异常操作" 
                value={statistics?.failed_operations || 0}
                valueStyle={{ color: '#fa541c' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="审计覆盖率" 
                value="100%"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
        </Spin>
      </Card>

      {/* 审计功能模块 */}
      <Row gutter={[16, 16]}>
        {auditModules.map(module => (
          <Col span={12} key={module.key}>
            <Card
              hoverable
              style={{ height: '100%' }}
              actions={[
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(module.path)}
                >
                  进入审计
                </Button>
              ]}
            >
              <Card.Meta
                avatar={
                  <div style={{ 
                    fontSize: '24px', 
                    color: module.color,
                    backgroundColor: `${module.color}15`,
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {module.icon}
                  </div>
                }
                title={
                  <Space>
                    <Text strong style={{ fontSize: '16px' }}>
                      {module.title}
                    </Text>
                    <Text type="secondary">
                      ({module.count})
                    </Text>
                  </Space>
                }
                description={
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {module.description}
                  </Text>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AuditOverviewPage;