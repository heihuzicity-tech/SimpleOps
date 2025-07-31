import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Space,
  Modal,
  Typography,
  Row,
  Col,
  message,
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, CommandLog, CommandLogListParams } from '../../services/auditAPI';
import styles from './CommandLogsTable.module.css';

const { Text, Paragraph } = Typography;
const { Option } = Select;

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
  
  // 搜索参数 - 移除风险等级筛选
  const [searchParams, setSearchParams] = useState<Omit<CommandLogListParams, 'risk'>>({});
  const [searchType, setSearchType] = useState<'asset' | 'username' | 'command'>('username');
  const [searchValue, setSearchValue] = useState('');
  
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
        // 使用统一的 PaginatedResult 格式
        setData(response.data.items || []);
        setTotal(response.data.total);
      }
    } catch (error: any) {
      console.error('获取命令日志失败:', error);
      const errorMsg = error.response?.data?.error || error.message || '获取命令日志失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination, searchParams]);

  // 初始加载
  useEffect(() => {
    fetchCommandLogs();
  }, [fetchCommandLogs]);

  // 搜索处理
  const handleSearch = () => {
    const newParams: any = {};
    if (searchValue.trim()) {
      if (searchType === 'asset') {
        // 将资产搜索映射到asset_id字段
        const assetId = parseInt(searchValue);
        if (!isNaN(assetId)) {
          newParams['asset_id'] = assetId;
        } else {
          message.warning('请输入有效的主机ID数字');
          return;
        }
      } else {
        newParams[searchType] = searchValue.trim();
      }
    }
    setSearchParams(newParams);
    setPagination({ ...pagination, current: 1 });
    fetchCommandLogs(newParams);
  };

  // 重置搜索
  const handleReset = () => {
    setSearchParams({});
    setSearchValue('');
    setSearchType('username');
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
    } catch (error: any) {
      console.error('获取命令日志详情失败:', error);
      const errorMsg = error.response?.data?.error || error.message || '获取命令日志详情失败';
      message.error(errorMsg);
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

  // 表格列定义
  const columns: ColumnsType<CommandLog> = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      width: 300,
      ellipsis: true,
      render: (command: string, record: CommandLog) => {
        const riskColors = {
          low: '#52c41a',
          medium: '#faad14',
          high: '#f5222d',
        };
        return (
          <span>
            <span 
              style={{ 
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: riskColors[record.risk] || '#d9d9d9',
                marginRight: 8,
              }}
              title={`风险等级: ${record.risk}`}
            />
            {command}
          </span>
        );
      },
    },
    {
      title: '资产',
      dataIndex: 'asset_id',
      key: 'asset_id',
      width: 120,
      render: (assetId: number) => (
        <span title={`资产ID: ${assetId}`}>
          主机-{assetId}
        </span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username_display',
      width: 120,
      render: (username: string, record: CommandLog) => (
        <span title={`用户ID: ${record.user_id}`}>
          {username}
        </span>
      ),
    },
    {
      title: '会话',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      ellipsis: true,
      render: (sessionId: string) => (
        <span title={sessionId} style={{ cursor: 'pointer' }}>
          {sessionId.substring(0, 8)}...
        </span>
      ),
    },
    {
      title: '日期时间',
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
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className={`${className} ${styles.commandLogsTable}`}>
      <Card>
        {/* 搜索区域 */}
        <div className={styles.searchArea}>
          <Space size="middle">
            <Input.Group compact style={{ width: 300 }}>
              <Select
                value={searchType}
                onChange={setSearchType}
                style={{ width: '35%' }}
              >
                <Option value="asset">主机</Option>
                <Option value="username">操作用户</Option>
                <Option value="command">命令内容</Option>
              </Select>
              <Input
                style={{ width: '65%' }}
                placeholder={searchType === 'asset' ? '请输入主机ID' : searchType === 'username' ? '请输入操作用户' : '请输入命令内容'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
              />
            </Input.Group>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="small"
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
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="命令执行详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
        loading={detailLoading}
        className={styles.detailModal}
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
                <Text>{selectedLog.session_id}</Text>
              </Col>
              <Col span={12}>
                <Text strong>资产：</Text>
                <Text>主机-{selectedLog.asset_id}</Text>
              </Col>
              <Col span={12}>
                <Text strong>退出码：</Text>
                <Text style={{ color: selectedLog.exit_code === 0 ? '#52c41a' : '#f5222d' }}>
                  {selectedLog.exit_code}
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>执行时间：</Text>
                <Text>{formatDuration(selectedLog.duration)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>风险等级：</Text>
                <Text style={{ 
                  color: selectedLog.risk === 'high' ? '#f5222d' : 
                         selectedLog.risk === 'medium' ? '#faad14' : '#52c41a' 
                }}>
                  {selectedLog.risk === 'high' ? '高' : 
                   selectedLog.risk === 'medium' ? '中' : '低'}
                </Text>
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

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <Text strong>执行命令：</Text>
              <Paragraph 
                code 
                copyable 
                style={{ 
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  marginTop: '8px',
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
                    backgroundColor: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '4px',
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
    </div>
  );
};

export default CommandLogsTable;