import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Row,
  Col,
  Tooltip,
  Modal,
  message,
  Popconfirm,
  Breadcrumb,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, SessionRecord, SessionRecordListParams } from '../../services/auditAPI';

const { Option } = Select;

interface SessionAuditTableProps {
  className?: string;
}

const SessionAuditTable: React.FC<SessionAuditTableProps> = ({ className }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  
  // 搜索参数
  const [searchParams, setSearchParams] = useState<SessionRecordListParams>({});
  
  // 紧凑式搜索状态
  const [searchType, setSearchType] = useState('登录用户');
  const [searchText, setSearchText] = useState('');

  // 获取会话记录列表
  const fetchSessionRecords = useCallback(async (params: SessionRecordListParams = {}) => {
    setLoading(true);
    try {
      const response = await AuditAPI.getSessionRecords({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...searchParams,
        ...params,
      });
      
      if (response.success) {
        setData(response.data.records || []);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('获取会话记录失败:', error);
      message.error('获取会话记录失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 初始加载
  useEffect(() => {
    fetchSessionRecords();
  }, []);

  // 搜索处理
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchSessionRecords();
  };

  // 重置搜索
  const handleReset = () => {
    setSearchParams({});
    setSearchText('');
    setPagination({ ...pagination, current: 1 });
    fetchSessionRecords({});
  };

  // 紧凑式搜索处理
  const handleCompactSearch = (value?: string) => {
    const searchValue = value !== undefined ? value : searchText;
    if (!searchValue.trim()) {
      handleReset();
      return;
    }

    const params: SessionRecordListParams = {};
    
    // 根据搜索类型设置对应参数
    switch (searchType) {
      case '登录用户':
        params.username = searchValue;
        break;
      case '主机':
        params.asset_name = searchValue;
        break;
      case 'IP地址':
        params.asset_address = searchValue;
        break;
      case '系统用户':
        params.system_user = searchValue;
        break;
      case '状态':
        params.status = searchValue as 'active' | 'closed' | 'timeout';
        break;
      default:
        params.keyword = searchValue;
    }

    setSearchParams(params);
    setPagination({ ...pagination, current: 1 });
    fetchSessionRecords(params);
  };

  // 播放历史
  const handleReplay = (record: SessionRecord) => {
    if (!record.record_path) {
      message.warning('该会话没有录制文件');
      return;
    }
    // 这里应该打开播放器窗口
    message.info('播放功能开发中...');
  };

  // 查看详情
  const handleDetail = (record: SessionRecord) => {
    Modal.info({
      title: '会话详情',
      width: 600,
      content: (
        <div>
          <p><strong>会话ID:</strong> {record.session_id}</p>
          <p><strong>用户:</strong> {record.username}</p>
          <p><strong>主机:</strong> {record.asset_name} ({record.asset_address})</p>
          <p><strong>系统用户:</strong> root</p>
          <p><strong>开始时间:</strong> {dayjs(record.start_time).format('YYYY-MM-DD HH:mm:ss')}</p>
          <p><strong>结束时间:</strong> {record.end_time ? dayjs(record.end_time).format('YYYY-MM-DD HH:mm:ss') : '进行中'}</p>
          <p><strong>持续时间:</strong> {record.duration ? `${Math.floor(record.duration / 60)}分钟` : '-'}</p>
          <p><strong>状态:</strong> {record.status === 'closed' ? '已结束' : '进行中'}</p>
        </div>
      ),
    });
  };

  // 删除记录
  const handleDelete = async (record: SessionRecord) => {
    try {
      // await AuditAPI.deleteSessionRecord(record.session_id);
      message.warning('删除功能暂未实现');
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 格式化持续时间
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  // 表格列定义（参考图片设计）
  const columns: ColumnsType<SessionRecord> = [
    {
      title: '登录用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>{username}</span>
      ),
    },
    {
      title: '主机',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'asset_address',
      key: 'asset_address',
      width: 130,
    },
    {
      title: '系统用户',
      key: 'system_user',
      width: 100,
      render: () => 'root',
    },
    {
      title: '系统类型',
      key: 'system_type',
      width: 100,
      render: () => (
        <Tag color="blue">Linux</Tag>
      ),
    },
    {
      title: '资源类型',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      render: (protocol: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          ssh: { text: '主机', color: '#52c41a' },
          rdp: { text: '桌面', color: '#1890ff' },
          vnc: { text: 'VNC', color: '#fa8c16' },
        };
        const type = typeMap[protocol] || { text: protocol, color: 'default' };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (time: string) => (
        <span>{dayjs(time).format('YYYY-MM-DD HH:mm:ss')}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="播放历史">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleReplay(record)}
              disabled={!record.record_path}
              style={{ color: record.record_path ? '#52c41a' : undefined }}
            />
          </Tooltip>
          <Tooltip title="详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(record)}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除此记录？"
              onConfirm={() => handleDelete(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
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
        {/* 页面头部 - 面包屑 */}
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            items={[
              { title: '审计管理' },
              { title: '会话审计' },
            ]}
          />
        </div>
        
        {/* 搜索和操作区域 */}
        <Row justify="space-between" align="middle" gutter={[16, 8]}>
          <Col xs={24} sm={18} md={18} lg={20} xl={20}>
            <Space.Compact style={{ display: 'flex', width: '100%', maxWidth: 500 }}>
              <Select
                value={searchType}
                onChange={setSearchType}
                style={{ width: 120 }}
                placeholder="搜索类型"
              >
                <Select.Option value="登录用户">登录用户</Select.Option>
                <Select.Option value="主机">主机</Select.Option>
                <Select.Option value="IP地址">IP地址</Select.Option>
                <Select.Option value="系统用户">系统用户</Select.Option>
                <Select.Option value="状态">状态</Select.Option>
              </Select>
              <Input.Search
                placeholder="请输入关键字搜索"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleCompactSearch}
                allowClear
                style={{ flex: 1 }}
                enterButton={<SearchOutlined />}
              />
            </Space.Compact>
          </Col>
          
          {/* 右侧 - 操作按钮 */}
          <Col xs={24} sm={6} md={6} lg={4} xl={4}>
            <div style={{ textAlign: 'right' }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleReset}
                loading={loading}
                type="primary"
              >
                刷新
              </Button>
            </div>
          </Col>
        </Row>

        {/* 分隔线 */}
        <div style={{ margin: '16px 0', borderTop: '1px solid #f0f0f0' }} />

        {/* 会话列表 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="session_id"
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
            y: 'calc(100vh - 350px)'
          }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default SessionAuditTable;