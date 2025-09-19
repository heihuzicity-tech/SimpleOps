import React, { useMemo } from 'react';
import { Table, Tag, Space } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { RecentLogin } from '../../store/dashboardSlice';
import moment from 'moment';
import 'moment/locale/zh-cn';

moment.locale('zh-cn');

interface RecentLoginTableProps {
  recentLogins: RecentLogin[];
  loading?: boolean;
}

const RecentLoginTable: React.FC<RecentLoginTableProps> = ({ recentLogins, loading }) => {
  // 格式化时长（输入是秒）
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0秒';
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}分${secs > 0 ? secs + '秒' : ''}`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins > 0 ? mins + '分' : ''}`;
  };

  const columns: ColumnsType<RecentLogin> = useMemo(() => [
    {
      title: '登录用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '资源凭证',
      key: 'resource',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <span>{record.credential_name}</span>
          <span style={{ color: '#8c8c8c' }}>@</span>
          <span style={{ color: '#1890ff' }}>{record.asset_address}</span>
        </Space>
      ),
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '执行时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => formatDuration(duration),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        // 判断是否在线状态
        const isOnline = status === 'active' || status === 'online' || status === '在线';
        
        // 根据不同状态显示不同的标签
        let color = 'default';
        let text = '已断开';
        
        if (isOnline) {
          color = 'green';
          text = '在线';
        } else if (status === 'closed' || status === '用户正常退出') {
          color = 'default';
          text = '已断开';
        } else if (status === 'timeout' || status === 'SSH会话异常结束' || status === 'terminated') {
          color = 'red';
          text = '异常断开';
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
  ], []);

  return (
    <Table
      columns={columns}
      dataSource={recentLogins}
      rowKey="id"
      loading={loading}
      pagination={{
        pageSize: 5,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条记录`,
      }}
      size="small"
      scroll={{ x: 720 }}
    />
  );
};

export default React.memo(RecentLoginTable);