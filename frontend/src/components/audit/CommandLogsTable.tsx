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
  Popconfirm,
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  PlayCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { AuditAPI, CommandLog, CommandLogListParams } from '../../services/auditAPI';
import { RecordingAPI, RecordingResponse } from '../../services/recordingAPI';
import RecordingPlayer from '../recording/RecordingPlayer';
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
  
  
  // 播放器状态
  const [playerVisible, setPlayerVisible] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<RecordingResponse | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  
  // 批量选择状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  

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

  // 根据session_id查找录制文件
  const findRecordingBySessionId = async (sessionId: string): Promise<RecordingResponse | null> => {
    try {
      const response = await RecordingAPI.getRecordingList({
        session_id: sessionId,
        page: 1,
        page_size: 1,
      });
      
      if (response.items && response.items.length > 0) {
        return response.items[0];
      }
      
      return null;
    } catch (error) {
      console.error('查找录制文件失败:', error);
      return null;
    }
  };

  // 播放录屏
  const handlePlayRecording = async (sessionId: string) => {
    setLoadingRecording(true);
    try {
      const recording = await findRecordingBySessionId(sessionId);
      
      if (!recording) {
        message.error('该会话暂无录屏文件');
        return;
      }

      if (!recording.can_view) {
        message.error('该录制文件无法播放');
        return;
      }

      setCurrentRecording(recording);
      setPlayerVisible(true);
    } catch (error) {
      console.error('Failed to load recording:', error);
      message.error('录屏文件加载失败');
    } finally {
      setLoadingRecording(false);
    }
  };

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

  // 批量删除处理
  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的命令记录');
      return;
    }
    
    setBatchDeleting(true);
    try {
      const ids = selectedRowKeys.map(key => Number(key));
      const reason = '批量删除操作';
      const response = await AuditAPI.batchDeleteCommandLogs(ids, reason);
      
      if (response.success && response.data) {
        setSelectedRowKeys([]);
        fetchCommandLogs();
        message.success(`成功删除 ${response.data.deleted_count} 个命令记录`);
      } else {
        message.error('批量删除失败');
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedRowKeys, fetchCommandLogs]);




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
      title: '指令类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      align: 'center',
      render: (action: string) => {
        const actionConfig = {
          block: { text: '指令阻断', color: '#f5222d' },
          allow: { text: '指令放行', color: '#52c41a' },
          warning: { text: '指令警告', color: '#faad14' },
        };
        
        const config = actionConfig[action as keyof typeof actionConfig] || 
                      { text: action || '未知', color: '#d9d9d9' };
        
        return (
          <span style={{ color: config.color, fontWeight: 'bold' }}>
            {config.text}
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
        <Button
          type="link"
          size="small"
          icon={<PlayCircleOutlined />}
          title={`点击播放会话录屏 (${sessionId})`}
          loading={loadingRecording}
          onClick={() => handlePlayRecording(sessionId)}
          style={{ padding: 0, height: 'auto' }}
        >
          {sessionId.substring(0, 8)}...
        </Button>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
    },
  ];

  return (
    <div className={`${className} ${styles.commandLogsTable}`}>
      <Card>
        {/* 搜索区域 */}
        <div className={styles.searchArea}>
          <Space size="middle">
            <Space.Compact style={{ width: 300 }}>
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
            </Space.Compact>
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
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            preserveSelectedRowKeys: true,
          }}
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
        
        {/* 批量删除按钮 - 与分页器保持同一水平高度 */}
        <div style={{ 
          marginTop: -40, 
          display: 'flex', 
          justifyContent: 'flex-start',
          alignItems: 'center',
          height: '32px'
        }}>
          <Popconfirm
            title={`确定要删除这 ${selectedRowKeys.length} 个命令记录吗？`}
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
              title={selectedRowKeys.length === 0 ? "请先选择要删除的命令记录" : `删除选中的 ${selectedRowKeys.length} 个命令记录`}
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
          </Popconfirm>
          {selectedRowKeys.length > 0 && (
            <span style={{ marginLeft: 12, color: '#666' }}>
              已选择 {selectedRowKeys.length} 个命令记录
            </span>
          )}
        </div>
      </Card>


      {/* 播放器模态框 */}
      <Modal
        title={`会话录屏回放 - ${currentRecording?.session_id || ''}`}
        open={playerVisible}
        onCancel={() => {
          setPlayerVisible(false);
          setCurrentRecording(null);
        }}
        footer={null}
        width={1200}
        destroyOnHidden
        centered
      >
        {currentRecording && (
          <RecordingPlayer
            recording={currentRecording}
          />
        )}
      </Modal>
    </div>
  );
};

export default CommandLogsTable;