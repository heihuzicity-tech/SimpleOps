import React from 'react';
import { Row, Col, Skeleton } from 'antd';
import { 
  FileTextOutlined, 
  HistoryOutlined, 
  CodeOutlined, 
  WarningOutlined 
} from '@ant-design/icons';
import { AuditSummary as AuditSummaryType } from '../../store/dashboardSlice';
import './AuditSummary.css';

interface AuditSummaryProps {
  summary: AuditSummaryType | null;
  loading?: boolean;
}

const AuditSummary: React.FC<AuditSummaryProps> = ({ summary, loading }) => {
  const summaryData = [
    {
      title: '登录日志',
      value: summary?.login_logs || 0,
      icon: <FileTextOutlined />,
      bgColor: '#f6ffed',
      color: '#52c41a',
    },
    {
      title: '操作日志',
      value: summary?.operation_logs || 0,
      icon: <HistoryOutlined />,
      bgColor: '#e6f7ff',
      color: '#1890ff',
    },
    {
      title: '命令记录',
      value: summary?.command_records || 0,
      icon: <CodeOutlined />,
      bgColor: '#fff7e6',
      color: '#fa8c16',
    },
    {
      title: '高危命令',
      value: summary?.danger_commands || 0,
      icon: <WarningOutlined />,
      bgColor: '#fff1f0',
      color: '#ff4d4f',
    },
  ];

  if (loading) {
    return (
      <Row gutter={[16, 16]} className="audit-summary">
        {[1, 2, 3, 4].map((index) => (
          <Col span={12} key={index}>
            <Skeleton.Button 
              active 
              size="large" 
              shape="square" 
              style={{ width: '100%', height: 80 }} 
            />
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[16, 16]} className="audit-summary">
      {summaryData.map((item, index) => (
        <Col span={12} key={index}>
          <div 
            className="audit-item"
            style={{ backgroundColor: item.bgColor }}
          >
            <div 
              className="audit-icon"
              style={{ color: item.color }}
            >
              {item.icon}
            </div>
            <div className="audit-info">
              <div 
                className="audit-value"
                style={{ color: item.color }}
              >
                {item.value.toLocaleString()}
              </div>
              <div className="audit-label">{item.title}</div>
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
};

export default React.memo(AuditSummary);