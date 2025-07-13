import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { hasAnyRole } from '../utils/permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredRole,
  fallback,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  const hasPermission = () => {
    if (!user || !user.roles) return false;
    if (!requiredRole) return true;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return hasAnyRole(user, roles);
  };

  if (!hasPermission()) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};

export default PermissionGuard; 