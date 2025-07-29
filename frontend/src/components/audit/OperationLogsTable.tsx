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
  Breadcrumb,
  Popconfirm,
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, OperationLog, OperationLogListParams } from '../../services/auditAPI';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

interface OperationLogsTableProps {
  className?: string;
}

const OperationLogsTable: React.FC<OperationLogsTableProps> = ({ className }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });
  
  // 搜索参数
  const [searchParams, setSearchParams] = useState<OperationLogListParams>({});
  
  // 详情模态框
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 批量删除相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 获取操作日志列表
  const fetchOperationLogs = useCallback(async (params: OperationLogListParams = {}) => {
    setLoading(true);
    try {
      const response = await AuditAPI.getOperationLogs({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...searchParams,
        ...params,
      });
      
      if (response.success) {
        // 使用统一的 PaginatedResult 格式
        setData(response.data.items || []);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      message.error('获取操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 初始加载
  useEffect(() => {
    fetchOperationLogs();
  }, [fetchOperationLogs]);

  // 搜索处理
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchOperationLogs();
  };

  // 重置搜索
  const handleReset = () => {
    setSearchParams({});
    setPagination({ ...pagination, current: 1 });
    fetchOperationLogs({});
  };

  // 查看详情
  const handleViewDetail = async (record: OperationLog) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const response = await AuditAPI.getOperationLog(record.id);
      if (response.success) {
        setSelectedLog(response.data);
      }
    } catch (error) {
      console.error('获取操作日志详情失败:', error);
      message.error('获取操作日志详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 删除单个操作日志
  const handleDelete = async (id: number) => {
    try {
      await AuditAPI.deleteOperationLog(id);
      message.success('操作日志删除成功');
      // 刷新数据
      fetchOperationLogs();
    } catch (error) {
      console.error('删除操作日志失败:', error);
      message.error('删除操作日志失败');
    }
  };

  // 批量删除操作日志
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的操作日志');
      return;
    }

    setBatchDeleting(true);
    try {
      const ids = selectedRowKeys.map(key => Number(key));
      await AuditAPI.batchDeleteOperationLogs(ids, '批量删除操作');
      setSelectedRowKeys([]);
      message.success(`成功删除 ${ids.length} 个操作日志`);
      // 刷新数据
      fetchOperationLogs();
    } catch (error) {
      console.error('批量删除操作日志失败:', error);
      message.error('批量删除操作日志失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<OperationLog> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: true,
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
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const colorMap: Record<string, string> = {
          create: 'green',
          read: 'blue',
          update: 'orange',
          delete: 'red',
        };
        return <Tag color={colorMap[action] || 'default'}>{action}</Tag>;
      },
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 100,
      render: (resource: string) => (
        <Tag color="cyan">{resource}</Tag>
      ),
    },
    {
      title: '请求方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => {
        const colorMap: Record<string, string> = {
          GET: 'blue',
          POST: 'green',
          PUT: 'orange',
          DELETE: 'red',
        };
        return <Tag color={colorMap[method] || 'default'}>{method}</Tag>;
      },
    },
    {
      title: '状态码',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => {
        let color = 'default';
        if (status >= 200 && status < 300) color = 'green';
        else if (status >= 300 && status < 400) color = 'blue';
        else if (status >= 400 && status < 500) color = 'orange';
        else if (status >= 500) color = 'red';
        
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => (
        <Text type={duration > 1000 ? 'warning' : undefined}>
          {duration}ms
        </Text>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个操作日志吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
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
        {/* 页面头部 - 面包屑和搜索控件 */}
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={24} md={20} lg={20} xl={20}>
            <div style={{ marginBottom: 12 }}>
              <Breadcrumb
                items={[
                  { title: '审计管理' },
                  { title: '操作审计' },
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
                <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                  <Select
                    placeholder="操作类型"
                    value={searchParams.action}
                    onChange={(value) => setSearchParams({ ...searchParams, action: value })}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Option value="create">创建</Option>
                    <Option value="read">读取</Option>
                    <Option value="update">更新</Option>
                    <Option value="delete">删除</Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={4} lg={4} xl={4}>
                  <Select
                    placeholder="资源类型"
                    value={searchParams.resource}
                    onChange={(value) => setSearchParams({ ...searchParams, resource: value })}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Option value="users">用户</Option>
                    <Option value="roles">角色</Option>
                    <Option value="assets">资产</Option>
                    <Option value="credentials">凭证</Option>
                    <Option value="audit">审计</Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6} lg={6} xl={6}>
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
                  />
                </Col>
              </Row>
            </div>
          </Col>
          
          {/* 右侧 - 操作按钮 */}
          <Col xs={24} sm={24} md={4} lg={4} xl={4}>
            <div style={{ textAlign: 'right' }}>
              <Space>
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
            <Statistic title="总记录数" value={total} />
          </Col>
          <Col span={6}>
            <Statistic 
              title="成功操作" 
              value={data.filter(item => item.status >= 200 && item.status < 300).length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="失败操作" 
              value={data.filter(item => item.status >= 400).length}
              valueStyle={{ color: '#cf1322' }}
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
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
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
        />
        
        {/* 批量删除按钮 - 与分页器保持同一水平高度 */}
        <div style={{ 
          marginTop: -40, 
          display: 'flex', 
          justifyContent: 'flex-start',
          alignItems: 'center',
          height: '32px'
        }}>
          <Popconfirm
            title={`确定要删除这 ${selectedRowKeys.length} 个操作日志吗？`}
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button 
              danger 
              icon={<DeleteOutlined />}
              loading={batchDeleting}
              disabled={selectedRowKeys.length === 0}
              title={selectedRowKeys.length === 0 ? "请先选择要删除的操作日志" : `删除选中的 ${selectedRowKeys.length} 个操作日志`}
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
          </Popconfirm>
          {selectedRowKeys.length > 0 && (
            <span style={{ marginLeft: 12, color: '#666' }}>
              已选择 {selectedRowKeys.length} 个操作日志
            </span>
          )}
        </div>
      </Card>

      {/* 详情模态框 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            操作日志详情
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
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
                <Text strong>操作类型：</Text>
                <Tag color="blue">{selectedLog.action}</Tag>
              </Col>
              <Col span={12}>
                <Text strong>资源类型：</Text>
                <Tag color="cyan">{selectedLog.resource}</Tag>
              </Col>
              <Col span={12}>
                <Text strong>会话ID：</Text>
                <Text>
                  {selectedLog.session_id || '-'}
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>资源ID：</Text>
                <Text>
                  {selectedLog.resource_id ? selectedLog.resource_id.toString() : '-'}
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>请求方法：</Text>
                <Tag color="green">{selectedLog.method}</Tag>
              </Col>
              <Col span={12}>
                <Text strong>状态码：</Text>
                <Tag color={selectedLog.status >= 400 ? 'red' : 'green'}>
                  {selectedLog.status}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>IP地址：</Text>
                <Text>{selectedLog.ip}</Text>
              </Col>
              <Col span={12}>
                <Text strong>耗时：</Text>
                <Text>{selectedLog.duration}ms</Text>
              </Col>
              <Col span={24}>
                <Text strong>请求URL：</Text>
                <Text code>{selectedLog.url}</Text>
              </Col>
              <Col span={24}>
                <Text strong>操作时间：</Text>
                <Text>{dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Col>
              {selectedLog.message && (
                <Col span={24}>
                  <Text strong>消息：</Text>
                  <Text>{selectedLog.message}</Text>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OperationLogsTable;