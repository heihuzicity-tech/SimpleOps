import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Space,
  Tag,
  Input,
  DatePicker,
  Select,
  Button,
  Tooltip,
  Row,
  Col,
  Statistic,
  message,
  Typography,
  Spin,
  Badge,
  Empty
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DesktopOutlined,
  FilterOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BellOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import moment from 'moment';
import 'moment/locale/zh-cn';
import axios from 'axios';

const { RangePicker } = DatePicker;
const { Text } = Typography;

moment.locale('zh-cn');

// TypeScript 接口定义
interface CommandFilterLog {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  asset_name: string;
  account: string;
  command: string;
  filter_id: number;
  filter_name: string;
  action: 'deny' | 'allow' | 'alert' | 'prompt_alert';
  created_at: string;
}

interface CommandFilterLogListRequest {
  page?: number;
  page_size?: number;
  session_id?: string;
  user_id?: number;
  asset_id?: number;
  filter_id?: number;
  start_time?: string;
  end_time?: string;
}

interface LogStatistics {
  today_count: number;
  week_count: number;
  deny_count: number;
  alert_count: number;
  total_count: number;
  most_triggered_filter?: {
    id: number;
    name: string;
    count: number;
  };
}

const FilterLogTable: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<CommandFilterLog[]>([]);
  const [statistics, setStatistics] = useState<LogStatistics | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 筛选条件
  const [filters, setFilters] = useState<CommandFilterLogListRequest>({});
  const [searchSessionId, setSearchSessionId] = useState('');
  const [dateRange, setDateRange] = useState<[moment.Moment | null, moment.Moment | null]>([null, null]);

  // 获取日志列表
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: CommandFilterLogListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters
      };

      if (searchSessionId) {
        params.session_id = searchSessionId;
      }

      if (dateRange[0] && dateRange[1]) {
        params.start_time = dateRange[0].format('YYYY-MM-DD HH:mm:ss');
        params.end_time = dateRange[1].format('YYYY-MM-DD HH:mm:ss');
      }

      const response = await axios.get('/api/command-filter/logs', { params });
      
      if (response.data.code === 0) {
        setLogs(response.data.data.items);
        setPagination({
          ...pagination,
          total: response.data.data.total
        });
      } else {
        message.error(response.data.message || '获取日志列表失败');
      }
    } catch (error) {
      console.error('获取日志列表失败:', error);
      message.error('获取日志列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize, searchSessionId, dateRange]);

  // 获取统计信息
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await axios.get('/api/command-filter/logs/stats');
      
      if (response.data.code === 0) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, [fetchLogs, fetchStatistics]);

  // 动作标签渲染
  const renderActionTag = (action: string) => {
    const actionMap = {
      deny: { color: 'error', icon: <ExclamationCircleOutlined />, text: '拒绝' },
      allow: { color: 'success', icon: <CheckCircleOutlined />, text: '接受' },
      alert: { color: 'warning', icon: <WarningOutlined />, text: '告警' },
      prompt_alert: { color: 'gold', icon: <BellOutlined />, text: '提示并告警' }
    };

    const config = actionMap[action as keyof typeof actionMap] || { 
      color: 'default', 
      icon: null, 
      text: action 
    };

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 时间显示格式化
  const formatTime = (time: string) => {
    const timeMoment = moment(time);
    const now = moment();
    const diffMinutes = now.diff(timeMoment, 'minutes');
    
    let relativeTime = '';
    if (diffMinutes < 1) {
      relativeTime = '刚刚';
    } else if (diffMinutes < 60) {
      relativeTime = `${diffMinutes}分钟前`;
    } else if (diffMinutes < 1440) {
      relativeTime = `${Math.floor(diffMinutes / 60)}小时前`;
    } else if (diffMinutes < 10080) {
      relativeTime = `${Math.floor(diffMinutes / 1440)}天前`;
    } else {
      relativeTime = timeMoment.format('YYYY-MM-DD');
    }

    return (
      <Tooltip title={timeMoment.format('YYYY-MM-DD HH:mm:ss')}>
        <Space>
          <ClockCircleOutlined />
          <span>{relativeTime}</span>
        </Space>
      </Tooltip>
    );
  };

  // 表格列定义
  const columns: ColumnsType<CommandFilterLog> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      fixed: 'left'
    },
    {
      title: '会话ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 150,
      render: (sessionId: string) => (
        <Tooltip title={sessionId}>
          <Text copyable={{ text: sessionId }}>
            {sessionId.length > 12 ? `${sessionId.substring(0, 12)}...` : sessionId}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <Space>
          <UserOutlined />
          <span>{username}</span>
        </Space>
      )
    },
    {
      title: '资产',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
      render: (assetName: string) => (
        <Space>
          <DesktopOutlined />
          <span>{assetName}</span>
        </Space>
      )
    },
    {
      title: '账号',
      dataIndex: 'account',
      key: 'account',
      width: 100
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      width: 200,
      render: (command: string) => (
        <Tooltip title={command}>
          <Text 
            style={{ 
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '12px',
              backgroundColor: '#f5f5f5',
              padding: '2px 4px',
              borderRadius: '2px'
            }}
          >
            {command.length > 30 ? `${command.substring(0, 30)}...` : command}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '触发规则',
      dataIndex: 'filter_name',
      key: 'filter_name',
      width: 150,
      render: (filterName: string) => (
        <Space>
          <FilterOutlined />
          <span>{filterName}</span>
        </Space>
      )
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: renderActionTag
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: formatTime
    }
  ];

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchLogs();
  };

  // 处理刷新
  const handleRefresh = () => {
    fetchLogs();
    fetchStatistics();
    message.success('刷新成功');
  };

  // 处理导出
  const handleExport = async () => {
    try {
      message.loading('正在导出日志...');
      const params = {
        ...filters,
        session_id: searchSessionId,
        start_time: dateRange[0]?.format('YYYY-MM-DD HH:mm:ss'),
        end_time: dateRange[1]?.format('YYYY-MM-DD HH:mm:ss')
      };

      const response = await axios.get('/api/command-filter/logs/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `command_filter_logs_${moment().format('YYYYMMDD_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 处理表格变化
  const handleTableChange = (newPagination: any) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日日志"
              value={statistics?.today_count || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本周日志"
              value={statistics?.week_count || 0}
              prefix={<Badge status="processing" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="拒绝次数"
              value={statistics?.deny_count || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="告警次数"
              value={statistics?.alert_count || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 触发最多的规则 */}
      {statistics?.most_triggered_filter && (
        <Card 
          size="small" 
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '12px 24px' }}
        >
          <Space>
            <Text type="secondary">触发最多的规则：</Text>
            <Tag color="blue" icon={<FilterOutlined />}>
              {statistics.most_triggered_filter.name}
            </Tag>
            <Text type="secondary">触发次数：</Text>
            <Badge count={statistics.most_triggered_filter.count} showZero />
          </Space>
        </Card>
      )}

      {/* 筛选条件 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="搜索会话ID"
            value={searchSessionId}
            onChange={(e) => setSearchSessionId(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            allowClear
          />
          
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [moment.Moment | null, moment.Moment | null])}
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={['开始时间', '结束时间']}
            style={{ width: 360 }}
          />

          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </Card>

      {/* 日志表格 */}
      <Card>
        <Table
          loading={loading}
          columns={columns}
          dataSource={logs}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty description="暂无日志数据" />
          }}
        />
      </Card>
    </div>
  );
};

export default FilterLogTable;