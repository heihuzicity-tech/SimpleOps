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
  GlobalOutlined,
  FolderOutlined,
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
          children: [
            {
              key: '/assets/hosts',
              icon: <DesktopOutlined />,
              label: '主机资源',
            },
            {
              key: '/assets/databases',
              icon: <ConsoleSqlOutlined />,
              label: '数据库',
            },
            // 只有管理员才能看到分组管理
            ...(hasAdminPermission(user) ? [{
              key: '/assets/groups',
              icon: <FolderOutlined />,
              label: '分组管理',
            }] : []),
          ],
        },
        {
          key: '/credentials',
          icon: <KeyOutlined />,
          label: '凭证管理',
          children: [
            {
              key: '/credentials/password',
              icon: <KeyOutlined />,
              label: '密码凭证',
            },
            {
              key: '/credentials/ssh-key',
              icon: <KeyOutlined />,
              label: '密钥管理',
            },
          ],
        },
        {
          key: '/connect',
          icon: <GlobalOutlined />,
          label: '远程连接',
          children: [
            {
              key: '/connect/hosts',
              icon: <DesktopOutlined />,
              label: '主机连接',
            },
            {
              key: '/connect/databases',
              icon: <ConsoleSqlOutlined />,
              label: '数据库连接',
            },
          ],
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
    
    // 如果是会话管理子页面，需要展开会话管理菜单
    if (currentPath.startsWith('/sessions/')) {
      openKeys = ['/sessions'];
    }
    
    // 如果是资产管理子页面，需要展开资产管理菜单
    if (currentPath.startsWith('/assets/')) {
      openKeys = ['/assets'];
    }
    
    // 如果是凭证管理子页面，需要展开凭证管理菜单
    if (currentPath.startsWith('/credentials/')) {
      openKeys = ['/credentials'];
    }
    
    // 如果是远程连接子页面，需要展开远程连接菜单
    if (currentPath.startsWith('/connect/')) {
      openKeys = ['/connect'];
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
        width={200}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Text strong style={{ fontSize: collapsed ? 12 : 14 }}>
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
            height: '48px',
            lineHeight: '48px',
          }}
        >
          <div />
          <Space size="middle">
            <Space 
              size="small" 
              style={{ 
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '6px',
                transition: 'all 0.2s',
                border: '1px solid #d9d9d9',
                background: '#fafafa'
              }}
              onClick={() => {
                // 在新标签页中打开工作台
                window.open('/connect/workspace', '_blank', 'noopener,noreferrer');
              }}
            >
              <CodeOutlined style={{ color: '#1890ff' }} />
              <Text style={{ fontSize: '14px', color: '#1890ff' }}>控制台</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: '14px' }}>欢迎，</Text>
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Space size="small" style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text strong style={{ fontSize: '14px' }}>{user?.username || 'User'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        
        <Content 
          className="ant-pro-basicLayout-content"
          style={{ 
            margin: '0', 
            padding: '16px',
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