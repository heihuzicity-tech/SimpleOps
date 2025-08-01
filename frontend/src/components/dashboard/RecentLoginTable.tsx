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
  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes > 0 ? minutes + '分' : ''}`;
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
        const isOnline = status === 'online' || status === '在线';
        return (
          <Tag color={isOnline ? 'green' : 'default'}>
            {isOnline ? '在线' : '已断开'}
          </Tag>
        );
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