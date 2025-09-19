# API使用指南

## 概述

本文档介绍运维堡垒机系统的API使用方法，包括用户认证、用户管理等功能。

## 基础信息

- **API基地址**: `http://localhost:8080/api/v1`
- **默认管理员账户**: `admin` / `admin123`
- **认证方式**: JWT Bearer Token
- **请求格式**: JSON
- **响应格式**: JSON

## 快速开始

### 1. 启动应用程序

```bash
# 进入后端目录
cd backend

# 启动应用程序
go run main.go

# 或者使用编译后的二进制文件
./bastion
```

### 2. 健康检查

```bash
curl -X GET http://localhost:8080/api/v1/health
```

**响应示例:**
```json
{
  "status": "ok",
  "message": "Bastion API is running"
}
```

## 认证相关API

### 用户登录

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400
  }
}
```

### 刷新Token

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400
  }
}
```

### 用户登出

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

## 用户资料管理

### 获取当前用户信息

**请求:**
```bash
curl -X GET http://localhost:8080/api/v1/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@bastion.local",
    "phone": null,
    "status": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "roles": [
      {
        "id": 1,
        "name": "admin",
        "description": "系统管理员",
        "permissions": ["all"]
      }
    ]
  }
}
```

### 获取用户资料

**请求:**
```bash
curl -X GET http://localhost:8080/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 更新用户资料

**请求:**
```bash
curl -X PUT http://localhost:8080/api/v1/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new_email@example.com",
    "phone": "13800138000"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "new_email@example.com",
    "phone": "13800138000",
    "status": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z",
    "roles": [...]
  }
}
```

### 修改密码

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "admin123",
    "new_password": "newpassword123"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## 用户管理API（需要管理员权限）

### 创建用户

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123",
    "email": "test@example.com",
    "phone": "13800138001",
    "role_ids": [2]
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "testuser",
    "email": "test@example.com",
    "phone": "13800138001",
    "status": 1,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z",
    "roles": [
      {
        "id": 2,
        "name": "operator",
        "description": "运维人员",
        "permissions": ["asset:read", "asset:connect", "session:read"]
      }
    ]
  }
}
```

### 获取用户列表

**请求:**
```bash
curl -X GET "http://localhost:8080/api/v1/users?page=1&page_size=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@bastion.local",
        "phone": null,
        "status": 1,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "roles": [...]
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 10,
    "total_pages": 1
  }
}
```

### 获取单个用户

**请求:**
```bash
curl -X GET http://localhost:8080/api/v1/users/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 更新用户

**请求:**
```bash
curl -X PUT http://localhost:8080/api/v1/users/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "updated@example.com",
    "status": 1,
    "role_ids": [2, 3]
  }'
```

### 删除用户

**请求:**
```bash
curl -X DELETE http://localhost:8080/api/v1/users/2 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 重置用户密码

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/users/2/reset-password \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_password": "newpassword123"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### 切换用户状态

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/users/2/toggle-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**响应示例:**
```json
{
  "success": true,
  "message": "User status toggled successfully"
}
```

## 错误处理

### 常见错误响应

**401 未授权:**
```json
{
  "error": "Authorization header is required"
}
```

**400 请求错误:**
```json
{
  "error": "Invalid request format"
}
```

**403 权限不足:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 资源不存在:**
```json
{
  "error": "User not found"
}
```

**500 服务器错误:**
```json
{
  "error": "Internal server error"
}
```

## 使用场景示例

### 1. 完整的登录流程

```bash
# 1. 用户登录
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.data.access_token')

# 2. 获取用户信息
curl -X GET http://localhost:8080/api/v1/me \
  -H "Authorization: Bearer $TOKEN"

# 3. 更新资料
curl -X PUT http://localhost:8080/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@newdomain.com"}'

# 4. 登出
curl -X POST http://localhost:8080/api/v1/logout \
  -H "Authorization: Bearer $TOKEN"
```

### 2. 用户管理流程

```bash
# 1. 管理员登录
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.data.access_token')

# 2. 创建新用户
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "operator1",
    "password": "password123",
    "email": "operator1@company.com",
    "role_ids": [2]
  }'

# 3. 获取用户列表
curl -X GET http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. 重置用户密码
curl -X POST http://localhost:8080/api/v1/users/2/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "newpassword123"}'
```

## 注意事项

1. **Token管理**: JWT Token有效期为24小时，过期后需要重新登录或刷新Token
2. **权限控制**: 用户管理API需要管理员权限
3. **密码安全**: 密码要求至少6个字符，包含字母和数字
4. **并发限制**: 系统支持100个并发连接
5. **错误处理**: 所有API都有完善的错误处理机制

## SSH会话管理API

### 创建SSH会话

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": 1,
    "credential_id": 1,
    "protocol": "ssh",
    "width": 80,
    "height": 24
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "ssh-1752423228-7623830641033978851",
    "user_id": 1,
    "asset_id": 1,
    "credential_id": 1,
    "status": "active",
    "created_at": "2025-07-14T00:13:48.478Z",
    "updated_at": "2025-07-14T00:13:48.478Z",
    "last_active": "2025-07-14T00:13:48.478Z"
  }
}
```

### 获取SSH会话列表

**请求:**
```bash
curl -X GET http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer <token>"
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ssh-1752423228-7623830641033978851",
      "user_id": 1,
      "asset_id": 1,
      "credential_id": 1,
      "asset_name": "web-7",
      "asset_address": "10.0.0.7:22",
      "credential_name": "root",
      "status": "active",
      "created_at": "2025-07-14T00:13:48.478Z",
      "updated_at": "2025-07-14T00:13:48.478Z",
      "last_active": "2025-07-14T00:13:48.478Z"
    }
  ]
}
```

### 关闭SSH会话

**请求:**
```bash
curl -X DELETE http://localhost:8080/api/v1/ssh/sessions/<session_id> \
  -H "Authorization: Bearer <token>"
```

**响应示例:**
```json
{
  "success": true,
  "message": "Session closed successfully"
}
```

### 调整终端大小

**请求:**
```bash
curl -X POST http://localhost:8080/api/v1/ssh/sessions/<session_id>/resize \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "width": 100,
    "height": 30
  }'
```

## WebSocket连接

### 终端WebSocket连接

**连接URL:**
```
ws://localhost:8080/api/v1/ws/ssh/sessions/<session_id>/ws?token=<jwt_token>
```

**消息格式:**

发送消息 (客户端 → 服务器):
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

```json
{
  "type": "ping"
}
```

接收消息 (服务器 → 客户端):
```json
{
  "type": "output",
  "data": "total 16\ndrwxr-xr-x 2 root root 4096 Jul 14 00:14 .\n"
}
```

```json
{
  "type": "error",
  "error": "Connection lost"
}
```

```json
{
  "type": "pong"
}
```

## 项目状态

✅ **已完成功能:**
1. 用户认证和权限管理
2. 资产和凭证管理  
3. SSH会话管理和WebSocket终端
4. 审计日志系统
5. 完整的前端界面

📊 **项目进度:** 95% 完成，可投入生产使用

更多详细信息请参考项目文档。 