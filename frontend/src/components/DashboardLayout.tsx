import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  DesktopOutlined,
  KeyOutlined,
  AuditOutlined,
  LogoutOutlined,
  ConsoleSqlOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { logout, getCurrentUser } from '../store/authSlice';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!user) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, user]);

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
    {
      key: '/assets',
      icon: <DesktopOutlined />,
      label: '资产管理',
    },
    {
      key: '/credentials',
      icon: <KeyOutlined />,
      label: '凭证管理',
    },
    {
      key: '/ssh-sessions',
      icon: <ConsoleSqlOutlined />,
      label: 'SSH会话',
    },
    {
      key: '/audit-logs',
      icon: <AuditOutlined />,
      label: '审计日志',
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人设置',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const onMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={250}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Text strong style={{ fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? '堡垒机' : '运维堡垒机系统'}
          </Text>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={onMenuClick}
          style={{ border: 'none' }}
        />
      </Sider>
      
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div />
          <Space>
            <Text type="secondary">欢迎，</Text>
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <Text strong>{user?.username || 'User'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout; 