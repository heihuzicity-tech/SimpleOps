import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Layout, 
  Space, 
  Typography, 
  Button, 
  Tag, 
  Spin, 
  Result,
  Tooltip,
  Avatar
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DisconnectOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  UserOutlined,
  CloudServerOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import WebTerminal from '../../components/ssh/WebTerminal';
import { AppDispatch, RootState } from '../../store';
import { sshAPI } from '../../services/sshAPI';
import { SSHSessionInfo } from '../../types/ssh';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Header, Content } = Layout;
const { Text, Title } = Typography;

const TerminalPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [sessionInfo, setSessionInfo] = useState<SSHSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionTime, setConnectionTime] = useState<string>('00:00:00');
  
  // 获取会话信息
  useEffect(() => {
    const fetchSessionInfo = async () => {
      if (!sessionId) {
        setError('会话ID无效');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const info = await sshAPI.getSessionInfo(sessionId);
        setSessionInfo(info);
        setError(null);
      } catch (err: any) {
        console.error('获取会话信息失败:', err);
        setError(err.message || '获取会话信息失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionInfo();
  }, [sessionId]);
  
  // 更新连接时长
  useEffect(() => {
    if (!sessionInfo?.created_at) return;
    
    const timer = setInterval(() => {
      const start = dayjs(sessionInfo.created_at);
      const now = dayjs();
      const diff = now.diff(start);
      const duration = dayjs.duration(diff);
      
      const hours = Math.floor(duration.asHours());
      const minutes = duration.minutes();
      const seconds = duration.seconds();
      
      setConnectionTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionInfo]);
  
  // 处理返回
  const handleBack = () => {
    navigate('/connect/hosts');
  };
  
  // 处理断开连接
  const handleDisconnect = async () => {
    if (sessionId) {
      try {
        await sshAPI.closeSession(sessionId);
        navigate('/connect/hosts');
      } catch (error) {
        console.error('关闭会话失败:', error);
      }
    }
  };
  
  // 切换全屏
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="正在加载会话信息..." />
      </div>
    );
  }
  
  if (error || !sessionId) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Result
          status="error"
          title="会话加载失败"
          subTitle={error || '无效的会话ID'}
          extra={
            <Button type="primary" onClick={handleBack}>
              返回会话列表
            </Button>
          }
        />
      </div>
    );
  }
  
  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <Space size="large">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ color: '#fff' }}
          >
            返回
          </Button>
          
          <Space size="middle">
            <Avatar 
              size="small" 
              icon={<CloudServerOutlined />} 
              style={{ background: '#1890ff' }}
            />
            <div>
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
                {sessionInfo?.asset_name || '未知主机'}
              </Text>
              <Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 8 }}>
                {sessionInfo?.asset_address}:{sessionInfo?.port || 22}
              </Text>
            </div>
          </Space>
          
          <Tag color="green" icon={<UserOutlined />}>
            {sessionInfo?.username || 'root'}
          </Tag>
          
          <Tag color="blue" icon={<ClockCircleOutlined />}>
            {connectionTime}
          </Tag>
        </Space>
        
        <Space>
          <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}>
            <Button 
              type="text" 
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{ color: '#fff' }}
            />
          </Tooltip>
          
          <Button 
            danger
            icon={<DisconnectOutlined />}
            onClick={handleDisconnect}
          >
            断开连接
          </Button>
        </Space>
      </Header>
      
      <Content style={{ 
        padding: 0,
        background: '#000',
        overflow: 'hidden'
      }}>
        <div style={{ 
          height: '100%',
          background: '#1e1e1e'
        }}>
          <WebTerminal
            sessionId={sessionId}
            onClose={handleBack}
            onError={(error) => {
              setError(error.message);
            }}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default TerminalPage;