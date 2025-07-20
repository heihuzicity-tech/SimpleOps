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
  Popconfirm,
} from 'antd';
import {
  PlayCircleOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { RecordingAPI, RecordingResponse, RecordingListRequest } from '../../services/recordingAPI';
import RecordingPlayer from '../../components/recording/RecordingPlayer';
import SearchSelect from '../../components/common/SearchSelect';
import { formatFileSize, formatDuration } from '../../utils/format';


const RecordingAuditPage: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordingResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 搜索和过滤状态
  const [searchParams, setSearchParams] = useState<RecordingListRequest>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState('session_id'); // session_id, user_name, asset_name
  
  // 播放器状态
  const [playerVisible, setPlayerVisible] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<RecordingResponse | null>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  
  // 批量选择状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  
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
  const handleSearch = (keyword?: string) => {
    const searchValue = keyword || searchKeyword;
    const params: RecordingListRequest = {};
    
    if (searchValue.trim()) {
      // 根据搜索类型设置对应的搜索参数
      switch (searchType) {
        case 'session_id':
          params.session_id = searchValue.trim();
          break;
        case 'user_name':
          params.user_name = searchValue.trim();
          break;
        case 'asset_name':
          params.asset_name = searchValue.trim();
          break;
      }
    }
    
    setSearchParams(params);
    setCurrentPage(1);
  };

  // 搜索类型切换处理
  const handleSearchTypeChange = (value: string) => {
    setSearchType(value);
    // 如果有搜索关键词，立即触发搜索
    if (searchKeyword.trim()) {
      setTimeout(() => handleSearch(), 100);
    }
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
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的录制文件');
      return;
    }
    
    setBatchDeleting(true);
    try {
      const ids = selectedRowKeys.map(key => Number(key));
      const reason = '批量删除操作';
      await RecordingAPI.batchDeleteRecordings(ids, reason);
      setSelectedRowKeys([]);
      loadRecordings();
      message.success(`成功删除 ${ids.length} 个录制文件`);
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  // 处理播放器全屏状态变化
  const handlePlayerFullscreenChange = (isFullscreen: boolean) => {
    setIsPlayerFullscreen(isFullscreen);
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
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.can_view && (
            <Button
              icon={<PlayCircleOutlined />}
              onClick={() => handlePlay(record)}
            >
              播放
            </Button>
          )}
          {record.can_download && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个录制吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
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

  // 表格列定义
  const columns: ColumnsType<RecordingResponse> = baseColumns;

  useEffect(() => {
    loadRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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



      {/* 搜索和操作区域 */}
      <div style={{ 
        marginBottom: 8, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <SearchSelect
          searchType={searchType}
          onSearchTypeChange={handleSearchTypeChange}
          onSearch={handleSearch}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="请输入关键字搜索"
          searchOptions={[
            { value: 'session_id', label: '会话ID' },
            { value: 'user_name', label: '用户名称' },
            { value: 'asset_name', label: '资产名称' },
          ]}
          style={{ width: 300 }}
        />
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadRecordings}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 录制列表表格 */}
      <Card 
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Table
          size="middle"
          columns={columns}
          dataSource={recordings}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
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
        
        {/* 批量删除按钮 - 与分页器保持同一水平高度 */}
        <div style={{ 
          marginTop: -40, 
          display: 'flex', 
          justifyContent: 'flex-start',
          alignItems: 'center',
          height: '32px'
        }}>
          <Popconfirm
            title={`确定要删除这 ${selectedRowKeys.length} 个录制文件吗？`}
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
              title={selectedRowKeys.length === 0 ? "请先选择要删除的录制文件" : `删除选中的 ${selectedRowKeys.length} 个录制文件`}
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
          </Popconfirm>
          {selectedRowKeys.length > 0 && (
            <span style={{ marginLeft: 12, color: '#666' }}>
              已选择 {selectedRowKeys.length} 个录制文件
            </span>
          )}
        </div>
      </Card>

      {/* 播放器模态框 */}
      <Modal
        title={null}
        open={playerVisible}
        onCancel={() => setPlayerVisible(false)}
        footer={null}
        width={isPlayerFullscreen ? '100vw' : 1300}
        destroyOnClose
        centered={!isPlayerFullscreen}
        styles={{
          header: {
            display: 'none',
          },
          body: { 
            height: isPlayerFullscreen ? 'calc(100vh - 40px)' : 'auto',
            maxHeight: isPlayerFullscreen ? 'calc(100vh - 40px)' : '85vh',
            padding: isPlayerFullscreen ? '0' : '8px',
            overflow: 'hidden',
          },
          content: {
            maxWidth: isPlayerFullscreen ? '100vw' : undefined,
            maxHeight: isPlayerFullscreen ? '100vh' : undefined,
            margin: isPlayerFullscreen ? 0 : undefined,
            borderRadius: isPlayerFullscreen ? 0 : undefined,
          },
          mask: {
            backgroundColor: isPlayerFullscreen ? 'rgba(0, 0, 0, 0.95)' : undefined,
          }
        }}
        maskClosable={!isPlayerFullscreen}
        closeIcon={!isPlayerFullscreen}
      >
        {currentRecording && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <RecordingPlayer 
              recording={currentRecording} 
              onFullscreenChange={handlePlayerFullscreenChange}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RecordingAuditPage;