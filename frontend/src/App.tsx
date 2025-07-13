import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import UsersPage from './pages/UsersPage';
import AssetsPage from './pages/AssetsPage';
import CredentialsPage from './pages/CredentialsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SSHSessionsPage from './pages/SSHSessionsPage';

const { Content } = Layout;

// 配置全局消息
message.config({
  top: 100,
  duration: 3,
  maxCount: 3,
});

const App: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            token ? (
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/credentials" element={<CredentialsPage />} />
                  <Route path="/ssh-sessions" element={<SSHSessionsPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                </Routes>
              </DashboardLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  );
};

// 临时的仪表板页面
const DashboardPage: React.FC = () => {
  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px',
        textAlign: 'center' 
      }}>
        <h1>欢迎使用运维堡垒机系统</h1>
        <p>请选择左侧菜单进行操作</p>
      </div>
    </Content>
  );
};

export default App; 