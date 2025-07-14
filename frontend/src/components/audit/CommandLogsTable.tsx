import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Modal,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Alert,
  Divider,
  Breadcrumb,
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  WarningOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, CommandLog, CommandLogListParams } from '../../services/auditAPI';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Paragraph } = Typography;

interface CommandLogsTableProps {
  className?: string;
}

const CommandLogsTable: React.FC<CommandLogsTableProps> = ({ className }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CommandLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });
  
  // 搜索参数
  const [searchParams, setSearchParams] = useState<CommandLogListParams>({});
  
  // 详情模态框
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CommandLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 获取命令日志列表
  const fetchCommandLogs = useCallback(async (params: CommandLogListParams = {}) => {
    setLoading(true);
    try {
      const response = await AuditAPI.getCommandLogs({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...searchParams,
        ...params,
      });
      
      if (response.success) {
        setData(response.data.logs || []);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('获取命令日志失败:', error);
      message.error('获取命令日志失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 初始加载
  useEffect(() => {
    fetchCommandLogs();
  }, [fetchCommandLogs]);

  // 搜索处理
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchCommandLogs();
  };

  // 重置搜索
  const handleReset = () => {
    setSearchParams({});
    setPagination({ ...pagination, current: 1 });
    fetchCommandLogs({});
  };

  // 查看详情
  const handleViewDetail = async (record: CommandLog) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const response = await AuditAPI.getCommandLog(record.id);
      if (response.success) {
        setSelectedLog(response.data);
      }
    } catch (error) {
      console.error('获取命令日志详情失败:', error);
      message.error('获取命令日志详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 格式化执行时间
  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}m`;
    }
  };

  // 统计数据
  const highRiskCount = data.filter(item => item.risk === 'high').length;
  const mediumRiskCount = data.filter(item => item.risk === 'medium').length;
  const lowRiskCount = data.filter(item => item.risk === 'low').length;
  const failedCount = data.filter(item => item.exit_code !== 0).length;

  // 检查是否有危险命令
  const hasDangerousCommands = data.some(item => item.risk === 'high');

  // 表格列定义
  const columns: ColumnsType<CommandLog> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: true,
    },
    {
      title: '会话ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      ellipsis: {
        showTitle: false,
      },
      render: (sessionId: string) => (
        <Tooltip title={sessionId}>
          <Space>
            <LinkOutlined />
            <Text code>{sessionId.substring(0, 8)}...</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <Text strong>{username}</Text>
      ),
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      width: 300,
      ellipsis: {
        showTitle: false,
      },
      render: (command: string, record) => {
        const isDangerous = record.risk === 'high';
        return (
          <Tooltip title={command} placement="topLeft">
            <Space>
              <CodeOutlined style={{ color: isDangerous ? '#ff4d4f' : '#1890ff' }} />
              <Text 
                code 
                style={{ 
                  color: isDangerous ? '#ff4d4f' : undefined,
                  fontWeight: isDangerous ? 'bold' : undefined,
                }}
              >
                {command.length > 50 ? `${command.substring(0, 50)}...` : command}
              </Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '风险等级',
      dataIndex: 'risk',
      key: 'risk',
      width: 100,
      render: (risk: string) => {
        const config = {
          high: { color: 'red', text: '高危', icon: <WarningOutlined /> },
          medium: { color: 'orange', text: '中等', icon: <WarningOutlined /> },
          low: { color: 'green', text: '低危', icon: null },
        };
        const { color, text, icon } = config[risk as keyof typeof config] || { color: 'default', text: risk, icon: null };
        return (
          <Tag color={color} icon={icon}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '退出码',
      dataIndex: 'exit_code',
      key: 'exit_code',
      width: 80,
      render: (exitCode: number) => {
        const isSuccess = exitCode === 0;
        return (
          <Tag color={isSuccess ? 'green' : 'red'}>
            {exitCode}
          </Tag>
        );
      },
    },
    {
      title: '执行时间',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => (
        <Space>
          <ClockCircleOutlined />
          <Text type={duration > 10000 ? 'warning' : undefined}>
            {formatDuration(duration)}
          </Text>
        </Space>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={className}>
      {/* 整合的页面内容 */}
      <Card 
        size="small"
        styles={{ body: { padding: '1rem 1.5rem' } }}
      >
        {/* 危险命令警告 */}
        {hasDangerousCommands && (
          <Alert
            message="检测到危险命令"
            description={`当前页面存在 ${highRiskCount} 条高危命令记录，请注意安全风险`}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 页面头部 - 面包屑和搜索控件 */}
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={24} md={22} lg={22} xl={22}>
            <div style={{ marginBottom: 12 }}>
              <Breadcrumb
                items={[
                  { title: '审计管理' },
                  { title: '命令审计' },
                ]}
              />
            </div>
            {/* 搜索区域 */}
            <div style={{ marginBottom: 12 }}>
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={12} md={6} lg={6} xl={6}>
                  <Input
                    placeholder="用户名"
                    value={searchParams.username}
                    onChange={(e) => setSearchParams({ ...searchParams, username: e.target.value })}
                    prefix={<SearchOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={6} lg={6} xl={6}>
                  <Input
                    placeholder="会话ID"
                    value={searchParams.session_id}
                    onChange={(e) => setSearchParams({ ...searchParams, session_id: e.target.value })}
                  />
                </Col>
                <Col xs={24} sm={12} md={6} lg={6} xl={6}>
                  <Input
                    placeholder="命令内容"
                    value={searchParams.command}
                    onChange={(e) => setSearchParams({ ...searchParams, command: e.target.value })}
                  />
                </Col>
                <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                  <Select
                    placeholder="风险等级"
                    value={searchParams.risk}
                    onChange={(value) => setSearchParams({ ...searchParams, risk: value })}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Option value="high">高危</Option>
                    <Option value="medium">中等</Option>
                    <Option value="low">低危</Option>
                  </Select>
                </Col>
              </Row>
              <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                  <RangePicker
                    showTime
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder={['开始时间', '结束时间']}
                    value={
                      searchParams.start_time && searchParams.end_time
                        ? [dayjs(searchParams.start_time), dayjs(searchParams.end_time)]
                        : null
                    }
                    onChange={(dates) => {
                      if (dates) {
                        setSearchParams({
                          ...searchParams,
                          start_time: dates[0]?.format('YYYY-MM-DD'),
                          end_time: dates[1]?.format('YYYY-MM-DD'),
                        });
                      } else {
                        setSearchParams({
                          ...searchParams,
                          start_time: undefined,
                          end_time: undefined,
                        });
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            </div>
          </Col>
          
          {/* 右侧 - 操作按钮 */}
          <Col xs={24} sm={24} md={2} lg={2} xl={2}>
            <div style={{ textAlign: 'right' }}>
              <Space direction="vertical">
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  搜索
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </div>
          </Col>
        </Row>

        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic title="总命令数" value={total} />
          </Col>
          <Col span={6}>
            <Statistic 
              title="高危命令" 
              value={highRiskCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="执行失败" 
              value={failedCount}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="平均耗时" 
              value={data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.duration, 0) / data.length) : 0}
              suffix="ms"
            />
          </Col>
        </Row>

        {/* 分隔线 */}
        <div style={{ margin: '16px 0', borderTop: '1px solid #f0f0f0' }} />

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
            },
            responsive: true,
            showLessItems: true,
          }}
          scroll={{ 
            x: 'max-content',
            y: 'calc(100vh - 450px)'
          }}
          rowClassName={(record) => {
            // 高危命令高亮显示
            if (record.risk === 'high') return 'ant-table-row-danger';
            if (record.risk === 'medium') return 'ant-table-row-warning';
            return '';
          }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            命令执行详情
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
        loading={detailLoading}
      >
        {selectedLog && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>用户名：</Text>
                <Text>{selectedLog.username}</Text>
              </Col>
              <Col span={12}>
                <Text strong>会话ID：</Text>
                <Text code>{selectedLog.session_id}</Text>
              </Col>
              <Col span={12}>
                <Text strong>风险等级：</Text>
                <Tag color={selectedLog.risk === 'high' ? 'red' : selectedLog.risk === 'medium' ? 'orange' : 'green'}>
                  {selectedLog.risk === 'high' ? '高危' : selectedLog.risk === 'medium' ? '中等' : '低危'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>退出码：</Text>
                <Tag color={selectedLog.exit_code === 0 ? 'green' : 'red'}>
                  {selectedLog.exit_code}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>执行时间：</Text>
                <Text>{formatDuration(selectedLog.duration)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>开始时间：</Text>
                <Text>{dayjs(selectedLog.start_time).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Col>
              {selectedLog.end_time && (
                <Col span={12}>
                  <Text strong>结束时间：</Text>
                  <Text>{dayjs(selectedLog.end_time).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </Col>
              )}
            </Row>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>执行命令：</Text>
              <Paragraph 
                code 
                copyable 
                style={{ 
                  backgroundColor: '#f6f6f6',
                  padding: '12px',
                  borderRadius: '6px',
                  marginTop: '8px',
                  color: selectedLog.risk === 'high' ? '#ff4d4f' : undefined,
                  fontWeight: selectedLog.risk === 'high' ? 'bold' : undefined,
                }}
              >
                {selectedLog.command}
              </Paragraph>
            </div>

            {selectedLog.output && (
              <div>
                <Text strong>执行输出：</Text>
                <Paragraph 
                  code 
                  copyable
                  style={{ 
                    backgroundColor: '#f6f6f6',
                    padding: '12px',
                    borderRadius: '6px',
                    marginTop: '8px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedLog.output}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .ant-table-row-danger {
          background-color: #fff2f0 !important;
        }
        .ant-table-row-danger:hover > td {
          background-color: #ffebe8 !important;
        }
        .ant-table-row-warning {
          background-color: #fffbe6 !important;
        }
        .ant-table-row-warning:hover > td {
          background-color: #fff7e3 !important;
        }
      `}</style>
    </div>
  );
};

export default CommandLogsTable;