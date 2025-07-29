# 问题：用户Profile接口未返回角色信息

## 问题描述
在前端API响应格式统一化改造过程中，发现后端 `/profile` 接口返回的用户信息缺少 `roles` 字段，导致前端权限判断失败，菜单无法正常显示。

## 问题表现
1. 登录后左侧菜单只显示"仪表板"和"审计日志"
2. 其他需要权限的菜单项（用户管理、资产管理等）全部消失
3. 控制台调试显示 `user.roles` 为 `undefined`

## 根本原因
后端 `/api/v1/profile` 接口返回的数据结构缺少 roles 字段：

```javascript
// 当前返回的数据
{
  id: 1,
  username: 'admin',
  email: 'admin@bastion.local',
  phone: '',
  status: 1,
  permissions: [],  // 空数组
  // roles: undefined  // 缺少这个字段！
}
```

## 影响范围
1. **菜单显示**：所有基于角色的菜单项无法显示
2. **权限控制**：所有权限检查失败，用户无法访问受保护的页面
3. **用户体验**：管理员用户登录后无法使用系统核心功能

## 解决方案

### 后端修复（推荐）
1. 修改 `/profile` 接口，确保返回完整的用户信息包括 roles
2. 返回格式应该是：
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@bastion.local",
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "系统管理员"
    }
  ],
  "permissions": ["all"]
}
```

### 前端兼容方案（不推荐）
可以在前端临时处理，但这不是好的解决方案，因为：
- 破坏了前后端的数据契约
- 增加了维护成本
- 可能导致安全问题

## 相关文件
- 前端权限检查：`frontend/src/utils/permissions.ts`
- 用户状态管理：`frontend/src/store/authSlice.ts`
- 菜单生成逻辑：`frontend/src/components/DashboardLayout.tsx`
- API服务：`frontend/src/services/api/AuthApiService.ts`

## 测试验证
修复后需要验证：
1. 登录后用户对象包含正确的 roles 数组
2. 管理员用户能看到所有菜单项
3. 普通用户只能看到有权限的菜单项
4. 权限保护的页面能正常访问