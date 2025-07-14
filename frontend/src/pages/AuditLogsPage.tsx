import React, { useState, useEffect } from 'react';
import { Card, Typography, Tabs, Row, Col, Statistic, Spin } from 'antd';
import {
  AuditOutlined,
  SettingOutlined,
  DesktopOutlined,
  CodeOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import OperationLogsTable from '../components/audit/OperationLogsTable';
import CommandLogsTable from '../components/audit/CommandLogsTable';
import OnlineSessionsTable from '../components/audit/OnlineSessionsTable';
import SessionAuditTable from '../components/audit/SessionAuditTable';
import { AuditAPI, AuditStatistics } from '../services/auditAPI';
import { sshAPI } from '../services/sshAPI';

const { Title } = Typography;

const AuditLogsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('online');
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

  return (
    <div>
      {/* 页面标题和统计概览 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          <AuditOutlined /> 审计管理
        </Title>
        
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

      {/* 审计管理详情 */}
      <div>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ 
            background: '#fff', 
            margin: 0, 
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0' 
          }}
          items={[
            {
              key: 'online',
              label: (
                <span>
                  <EyeOutlined />
                  在线会话
                </span>
              ),
              children: (
                <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: 'calc(100vh - 300px)' }}>
                  <OnlineSessionsTable />
                </div>
              ),
            },
            {
              key: 'session',
              label: (
                <span>
                  <DesktopOutlined />
                  会话审计
                </span>
              ),
              children: (
                <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: 'calc(100vh - 300px)' }}>
                  <SessionAuditTable />
                </div>
              ),
            },
            {
              key: 'command',
              label: (
                <span>
                  <CodeOutlined />
                  命令审计
                </span>
              ),
              children: (
                <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: 'calc(100vh - 300px)' }}>
                  <CommandLogsTable />
                </div>
              ),
            },
            {
              key: 'operation',
              label: (
                <span>
                  <SettingOutlined />
                  操作审计
                </span>
              ),
              children: (
                <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: 'calc(100vh - 300px)' }}>
                  <OperationLogsTable />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default AuditLogsPage; 