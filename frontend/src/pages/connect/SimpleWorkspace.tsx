import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { Result, Button, Card, Typography, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../store/authSlice';

const { Title, Paragraph } = Typography;

const SimpleWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token, loading, error } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Auth State 检查
    document.title = '连接工作台 - Bastion';
    
    // 如果有token但没有用户信息，获取用户信息
    if (token && !user && !loading) {
      // 获取用户信息
      dispatch(getCurrentUser()).catch(err => {
        // 获取用户信息失败
      });
    }
  }, [user, token, loading, dispatch, error]);

  if (!token) {
    return (
      <Result
        status="warning"
        title="需要登录"
        subTitle="请先登录系统才能访问工作台"
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            前往登录
          </Button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5' 
      }}>
        <Spin size="large" tip="正在加载用户信息...">
          <div style={{ minHeight: '100px', minWidth: '200px' }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', padding: '20px', background: '#f0f2f5' }}>
      <Card style={{ maxWidth: 800, margin: '0 auto' }}>
        <Title level={2}>连接工作台</Title>
        <Paragraph>
          欢迎访问连接工作台！当前用户：{user?.username || '未知用户'}
        </Paragraph>
        <Paragraph>
          Token状态：{token ? '已登录' : '未登录'}
        </Paragraph>
        <Paragraph>
          用户角色：{user?.roles?.map(role => role.name).join(', ') || '无角色'}
        </Paragraph>
        
        {error && (
          <Paragraph style={{ color: 'red' }}>
            错误信息：{error}
          </Paragraph>
        )}
        
        <div style={{ marginTop: 20 }}>
          <Button onClick={() => navigate('/dashboard')}>
            返回仪表板
          </Button>
          <Button 
            style={{ marginLeft: 8 }}
            onClick={() => {
              dispatch(getCurrentUser());
            }}
          >
            重新获取用户信息
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SimpleWorkspace;