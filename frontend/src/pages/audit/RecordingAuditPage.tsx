import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Tooltip,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  DatePicker,
  Popconfirm,
  Checkbox,
} from 'antd';
import {
  PlayCircleOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { RecordingAPI, RecordingResponse, RecordingListRequest } from '../../services/recordingAPI';
import RecordingPlayer from '../../components/recording/RecordingPlayer';
import BatchOperationToolbar from '../../components/recording/BatchOperationToolbar';
import { useBatchSelection } from '../../hooks/useBatchSelection';
import { formatFileSize, formatDuration } from '../../utils/format';

const { RangePicker } = DatePicker;
const { Option } = Select;

const RecordingAuditPage: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 搜索和过滤状态
  const [searchParams, setSearchParams] = useState<RecordingListRequest>({});
  const [sessionIdSearch, setSessionIdSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [formatFilter, setFormatFilter] = useState<string | undefined>();
  
  // 播放器状态
  const [playerVisible, setPlayerVisible] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<RecordingResponse | null>(null);
  
  // 批量选择状态
  const batchSelection = useBatchSelection();
  
  // 统计数据
  const [statistics, setStatistics] = useState({
    totalRecordings: 0,
    activeRecordings: 0,
    totalSize: 0,
    averageCompressionRatio: 0,
  });

  // 加载录制列表
  const loadRecordings = async () => {
    setLoading(true);
    try {
      const params: RecordingListRequest = {
        page: currentPage,
        page_size: pageSize,
        ...searchParams,
      };
      
      const response = await RecordingAPI.getRecordingList(params);
      setRecordings(response.items);
      setTotal(response.total);
      
      // 计算统计数据
      calculateStatistics(response.items);
    } catch (error) {
      console.error('加载录制列表失败:', error);
      message.error('加载录制列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 计算统计数据
  const calculateStatistics = (data: RecordingResponse[]) => {
    const totalSize = data.reduce((sum, item) => sum + item.file_size, 0);
    const activeCount = data.filter(item => item.status === 'recording').length;
    const avgCompression = data.length > 0 
      ? data.reduce((sum, item) => sum + item.compression_ratio, 0) / data.length 
      : 0;
    
    setStatistics({
      totalRecordings: data.length,
      activeRecordings: activeCount,
      totalSize,
      averageCompressionRatio: avgCompression,
    });
  };

  // 搜索处理
  const handleSearch = () => {
    const params: RecordingListRequest = {};
    
    if (sessionIdSearch.trim()) {
      params.session_id = sessionIdSearch.trim();
    }
    if (statusFilter) {
      params.status = statusFilter as any;
    }
    if (formatFilter) {
      params.format = formatFilter as any;
    }
    
    setSearchParams(params);
    setCurrentPage(1);
  };

  // 重置搜索
  const handleReset = () => {
    setSessionIdSearch('');
    setStatusFilter(undefined);
    setFormatFilter(undefined);
    setSearchParams({});
    setCurrentPage(1);
  };

  // 播放录制
  const handlePlay = (record: RecordingResponse) => {
    if (!record.can_view) {
      message.warning('该录制文件无法播放');
      return;
    }
    setCurrentRecording(record);
    setPlayerVisible(true);
  };

  // 下载录制
  const handleDownload = async (record: RecordingResponse) => {
    if (!record.can_download) {
      message.warning('该录制文件无法下载');
      return;
    }
    
    try {
      const blob = await RecordingAPI.downloadRecording(record.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${record.session_id}.${record.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  // 删除录制
  const handleDelete = async (record: RecordingResponse) => {
    try {
      await RecordingAPI.deleteRecording(record.id);
      message.success('删除成功');
      loadRecordings();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 批量删除处理
  const handleBatchDelete = async (reason: string) => {
    const selectedRecordings = batchSelection.getSelectedRecordings(recordings);
    const recordingIds = selectedRecordings.map(r => r.id);
    
    try {
      await RecordingAPI.batchDeleteRecordings(recordingIds, reason);
      batchSelection.clearSelection();
      loadRecordings();
    } catch (error) {
      console.error('批量删除失败:', error);
      throw error;
    }
  };

  // 批量下载处理
  const handleBatchDownload = async () => {
    const selectedRecordings = batchSelection.getSelectedRecordings(recordings);
    const recordingIds = selectedRecordings.map(r => r.id);
    
    try {
      const result = await RecordingAPI.batchDownloadRecordings(recordingIds);
      if (result.download_url) {
        // 直接触发下载
        window.open(result.download_url, '_blank');
      }
    } catch (error) {
      console.error('批量下载失败:', error);
      throw error;
    }
  };

  // 批量归档处理
  const handleBatchArchive = async (reason: string) => {
    const selectedRecordings = batchSelection.getSelectedRecordings(recordings);
    const recordingIds = selectedRecordings.map(r => r.id);
    
    try {
      await RecordingAPI.batchArchiveRecordings(recordingIds, reason);
      batchSelection.clearSelection();
      loadRecordings();
    } catch (error) {
      console.error('批量归档失败:', error);
      throw error;
    }
  };

  // 状态标签渲染
  const renderStatusTag = (status: string) => {
    const statusConfig = {
      recording: { color: 'processing', text: '录制中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 选择列定义
  const selectionColumn: ColumnsType<RecordingResponse>[0] = {
    title: (
      <Checkbox
        indeterminate={batchSelection.isIndeterminate(recordings.length)}
        checked={batchSelection.isAllSelected(recordings.length)}
        onChange={() => batchSelection.toggleSelectAll(recordings.map(r => r.id))}
      >
        全选
      </Checkbox>
    ),
    key: 'selection',
    width: 60,
    render: (_, record) => (
      <Checkbox
        checked={batchSelection.selectedIds.has(record.id)}
        onChange={(e) => batchSelection.toggleSelection(record.id)}
      />
    ),
  };

  // 基础表格列定义
  const baseColumns: ColumnsType<RecordingResponse> = [
    {
      title: '会话ID',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontFamily: 'monospace' }}>{text.slice(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '资产',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: renderStatusTag,
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      width: 80,
      render: (format: string) => (
        <Tag color="blue">{format.toUpperCase()}</Tag>
      ),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => formatDuration(duration),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 90,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '压缩比',
      dataIndex: 'compression_ratio',
      key: 'compression_ratio',
      width: 80,
      render: (ratio: number) => `${(ratio * 100).toFixed(1)}%`,
    },
    {
      title: '录制时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.can_view && (
            <Tooltip title="播放">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handlePlay(record)}
              />
            </Tooltip>
          )}
          {record.can_download && (
            <Tooltip title="下载">
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
              />
            </Tooltip>
          )}
          {record.can_delete && (
            <Popconfirm
              title="确定要删除这个录制吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 动态构建表格列，根据批量选择模式决定是否包含选择列
  const columns: ColumnsType<RecordingResponse> = batchSelection.isSelecting 
    ? [selectionColumn, ...baseColumns] 
    : baseColumns;

  useEffect(() => {
    loadRecordings();
  }, [currentPage, pageSize, searchParams]);

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总录制数" 
              value={total} 
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="活跃录制" 
              value={statistics.activeRecordings} 
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总存储大小" 
              value={formatFileSize(statistics.totalSize)} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="平均压缩比" 
              value={`${(statistics.averageCompressionRatio * 100).toFixed(1)}%`} 
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Input
              placeholder="搜索会话ID"
              value={sessionIdSearch}
              onChange={(e) => setSessionIdSearch(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="状态"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="recording">录制中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="格式"
              value={formatFilter}
              onChange={setFormatFilter}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="asciicast">ASCIICAST</Option>
              <Option value="json">JSON</Option>
              <Option value="mp4">MP4</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={loadRecordings}
              >
                刷新
              </Button>
              <Button 
                type={batchSelection.isSelecting ? "primary" : "default"}
                icon={<SelectOutlined />}
                onClick={() => batchSelection.setSelecting(!batchSelection.isSelecting)}
              >
                {batchSelection.isSelecting ? "退出选择" : "批量选择"}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 批量操作工具栏 */}
      {batchSelection.isSelecting && (
        <BatchOperationToolbar
          selectedRecordings={batchSelection.getSelectedRecordings(recordings)}
          onClearSelection={batchSelection.clearSelection}
          onBatchDelete={handleBatchDelete}
          onBatchDownload={handleBatchDownload}
          onBatchArchive={handleBatchArchive}
          loading={loading}
        />
      )}

      {/* 录制列表表格 */}
      <Card title="录屏记录">
        <Table
          columns={columns}
          dataSource={recordings}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 播放器模态框 */}
      <Modal
        title={`播放录制 - ${currentRecording?.session_id}`}
        open={playerVisible}
        onCancel={() => setPlayerVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        {currentRecording && (
          <RecordingPlayer recording={currentRecording} />
        )}
      </Modal>
    </div>
  );
};

export default RecordingAuditPage;