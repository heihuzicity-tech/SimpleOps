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
  EyeOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { logout, getCurrentUser } from '../store/authSlice';
import { hasAdminPermission, hasOperatorPermission } from '../utils/permissions';

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

  // 基于角色的菜单项
  const getMenuItems = () => {
    const items: any[] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表板',
      },
    ];

    // 管理员功能
    if (hasAdminPermission(user)) {
      items.push({
        key: '/users',
        icon: <UserOutlined />,
        label: '用户管理',
      });
    }

    // 运维人员和管理员功能
    if (hasOperatorPermission(user)) {
      items.push(
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
        }
      );
    }

    // 审计功能 - 所有用户都可以查看
    items.push({
      key: '/audit',
      icon: <AuditOutlined />,
      label: '审计日志',
      children: [
        {
          key: '/audit/online-sessions',
          icon: <EyeOutlined />,
          label: '在线会话',
        },
        {
          key: '/audit/session-audit',
          icon: <DesktopOutlined />,
          label: '会话审计',
        },
        {
          key: '/audit/command-audit',
          icon: <CodeOutlined />,
          label: '命令审计',
        },
        {
          key: '/audit/operation-audit',
          icon: <SettingOutlined />,
          label: '操作审计',
        },
      ],
    });

    return items;
  };

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

  // 计算当前选中的菜单项和展开的子菜单
  const getCurrentMenuState = () => {
    const currentPath = location.pathname;
    let selectedKeys = [currentPath];
    let openKeys: string[] = [];

    // 如果是审计子页面，需要展开审计菜单
    if (currentPath.startsWith('/audit/')) {
      openKeys = ['/audit'];
    }

    return { selectedKeys, openKeys };
  };

  const { selectedKeys, openKeys } = getCurrentMenuState();

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
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={getMenuItems()}
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
        
        <Content 
          className="ant-pro-basicLayout-content"
          style={{ 
            margin: '0', 
            padding: '1rem',
            overflow: 'initial',
            minHeight: 280
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout; 