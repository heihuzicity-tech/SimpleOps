import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Tag,
  Tooltip,
  message,
  Card,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DesktopOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import {
  CommandInterceptLog,
  InterceptLogListRequest,
} from '../../types';
import { commandFilterService } from '../../services/commandFilterService';
import { RangePickerProps } from 'antd/lib/date-picker';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const InterceptLogTable: React.FC = () => {
  const [logs, setLogs] = useState<CommandInterceptLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userFilter, setUserFilter] = useState<number | undefined>();
  const [policyFilter, setPolicyFilter] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[string?, string?]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // 统计数据
  const [statistics, setStatistics] = useState({
    todayCount: 0,
    weekCount: 0,
    totalCount: 0,
  });

  useEffect(() => {
    loadLogs();
    loadStatistics();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: InterceptLogListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        session_id: searchKeyword || undefined,
        user_id: userFilter,
        policy_id: policyFilter,
        start_time: dateRange[0],
        end_time: dateRange[1],
      };
      
      const response = await commandFilterService.interceptLog.getInterceptLogs(params);
      if (response.data) {
        setLogs(response.data.data || []);
        setTotal(response.data.total || 0);
      }
    } catch (error: any) {
      console.error('加载拦截日志失败:', error);
      message.error('加载拦截日志失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      // 获取今日统计
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
      
      const todayResponse = await commandFilterService.interceptLog.getInterceptLogs({
        start_time: todayStart,
        end_time: todayEnd,
        page: 1,
        page_size: 1,
      });

      // 获取本周统计
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekResponse = await commandFilterService.interceptLog.getInterceptLogs({
        start_time: weekStart,
        end_time: todayEnd,
        page: 1,
        page_size: 1,
      });

      // 获取总数
      const totalResponse = await commandFilterService.interceptLog.getInterceptLogs({
        page: 1,
        page_size: 1,
      });

      setStatistics({
        todayCount: todayResponse.data?.total || 0,
        weekCount: weekResponse.data?.total || 0,
        totalCount: totalResponse.data?.total || 0,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    loadLogs();
  };

  const handleReset = () => {
    setSearchKeyword('');
    setUserFilter(undefined);
    setPolicyFilter(undefined);
    setDateRange([]);
    setPagination({ current: 1, pageSize: 10 });
    setTimeout(loadLogs, 100);
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates, dateStrings) => {
    setDateRange(dateStrings as [string?, string?]);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '会话ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text}>
          <code style={{ fontSize: '12px' }}>
            {text.substring(0, 8)}...
          </code>
        </Tooltip>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: CommandInterceptLog) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          <span style={{ color: '#999', fontSize: '12px' }}>
            (ID: {record.user_id})
          </span>
        </Space>
      ),
    },
    {
      title: '目标主机',
      key: 'asset',
      render: (_: any, record: CommandInterceptLog) => (
        <Space>
          <DesktopOutlined />
          <div>
            <div>{record.asset_name || '未知主机'}</div>
            {record.asset_addr && (
              <div style={{ color: '#999', fontSize: '12px' }}>
                {record.asset_addr}
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '被拦截命令',
      dataIndex: 'command',
      key: 'command',
      render: (text: string) => (
        <Tooltip title={text}>
          <code style={{ 
            backgroundColor: '#fff2f0',
            color: '#cf1322',
            padding: '2px 6px',
            borderRadius: '3px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '12px',
            maxWidth: '200px',
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {text}
          </code>
        </Tooltip>
      ),
    },
    {
      title: '触发策略',
      key: 'policy',
      render: (_: any, record: CommandInterceptLog) => (
        <div>
          <div>
            <SecurityScanOutlined style={{ marginRight: 4 }} />
            {record.policy_name}
          </div>
          <Tag 
            color={record.policy_type === 'command' ? 'blue' : 'green'}
          >
            {record.policy_type === 'command' ? '单个命令' : '命令组'}
          </Tag>
        </div>
      ),
    },
    {
      title: '拦截时间',
      dataIndex: 'intercept_time',
      key: 'intercept_time',
      render: (text: string) => (
        <div>
          <div>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(text).toLocaleString()}
          </div>
          <div style={{ color: '#999', fontSize: '12px' }}>
            {getRelativeTime(text)}
          </div>
        </div>
      ),
    },
    {
      title: '告警状态',
      key: 'alert',
      render: (_: any, record: CommandInterceptLog) => (
        <div>
          {record.alert_level && (
            <Tag 
              color={
                record.alert_level === 'high' ? 'red' : 
                record.alert_level === 'medium' ? 'orange' : 'blue'
              }
            >
              {record.alert_level.toUpperCase()}
            </Tag>
          )}
          <div style={{ fontSize: '12px', marginTop: 2 }}>
            {record.alert_sent ? (
              <Tag color="green">已发送告警</Tag>
            ) : (
              <Tag color="default">未发送告警</Tag>
            )}
          </div>
        </div>
      ),
    },
  ];

  // 获取相对时间
  const getRelativeTime = (timestamp: string) => {
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    if (diff < 60 * 1000) {
      return '刚刚';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    } else {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
    }
  };

  return (
    <div>
      {/* 统计卡片 */}
      <div style={{ marginBottom: 16 }}>
        <Space size={16}>
          <Card size="small">
            <Statistic
              title="今日拦截"
              value={statistics.todayCount}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="近7天拦截"
              value={statistics.weekCount}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="总拦截数"
              value={statistics.totalCount}
              prefix={<SecurityScanOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Space>
      </div>

      {/* 搜索和过滤 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索会话ID"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <RangePicker
            placeholder={['开始时间', '结束时间']}
            onChange={handleDateRangeChange}
            showTime
            style={{ width: 300 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadLogs}>
            刷新
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 10 });
            loadLogs();
          },
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default InterceptLogTable;