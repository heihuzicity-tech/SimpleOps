// 权限检查工具函数

interface UserRole {
  id: number;
  name: string;
  description: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  roles: UserRole[];
  permissions: string[];
}

// 检查用户是否有管理员权限
export const hasAdminPermission = (user: User | null): boolean => {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.some(role => role.name === 'admin');
};

// 检查用户是否有运维权限
export const hasOperatorPermission = (user: User | null): boolean => {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.some(role => 
    role.name === 'admin' || role.name === 'operator'
  );
};

// 检查用户是否有指定角色
export const hasRole = (user: User | null, roleName: string): boolean => {
  if (!user || !user.roles) return false;
  return user.roles.some(role => role.name === roleName);
};

// 检查用户是否有指定角色中的任何一个
export const hasAnyRole = (user: User | null, roleNames: string[]): boolean => {
  if (!user || !user.roles) return false;
  return roleNames.some(roleName => 
    user.roles.some(role => role.name === roleName)
  );
};

// 检查用户是否有指定权限
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission) || user.permissions.includes('all');
};

// 检查用户是否有指定权限中的任何一个
export const hasAnyPermission = (user: User | null, permissions: string[]): boolean => {
  if (!user || !user.permissions) return false;
  return permissions.some(permission => 
    user.permissions.includes(permission) || user.permissions.includes('all')
  );
}; 