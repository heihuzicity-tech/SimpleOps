import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import PermissionGuard from './components/PermissionGuard';
import UsersPage from './pages/UsersPage';
import AssetsPage from './pages/AssetsPage';
import CredentialsPage from './pages/CredentialsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SSHSessionsPage from './pages/SSHSessionsPage';
import HostSessionsPage from './pages/sessions/HostSessionsPage';
import DatabaseSessionsPage from './pages/sessions/DatabaseSessionsPage';
import OnlineSessionsPage from './pages/audit/OnlineSessionsPage';
import SessionAuditPage from './pages/audit/SessionAuditPage';
import CommandAuditPage from './pages/audit/CommandAuditPage';
import OperationAuditPage from './pages/audit/OperationAuditPage';
import AuditOverviewPage from './pages/audit/AuditOverviewPage';

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
                  <Route 
                    path="/users" 
                    element={
                      <PermissionGuard requiredRole="admin">
                        <UsersPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/assets" 
                    element={<Navigate to="/assets/hosts" replace />} 
                  />
                  <Route 
                    path="/assets/hosts" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <AssetsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/assets/databases" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <AssetsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/credentials" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <CredentialsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/sessions" 
                    element={<Navigate to="/sessions/hosts" replace />} 
                  />
                  <Route 
                    path="/sessions/hosts" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <HostSessionsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/sessions/databases" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <DatabaseSessionsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route 
                    path="/ssh-sessions" 
                    element={
                      <PermissionGuard requiredRole={['admin', 'operator']}>
                        <SSHSessionsPage />
                      </PermissionGuard>
                    } 
                  />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/audit" element={<AuditOverviewPage />} />
                  <Route path="/audit/online-sessions" element={<OnlineSessionsPage />} />
                  <Route path="/audit/session-audit" element={<SessionAuditPage />} />
                  <Route path="/audit/command-audit" element={<CommandAuditPage />} />
                  <Route path="/audit/operation-audit" element={<OperationAuditPage />} />
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