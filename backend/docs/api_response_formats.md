# API响应格式文档

## 概述

本文档定义了运维堡垒机系统的统一API响应格式标准。所有API端点必须遵循此格式标准，以确保前后端数据交互的一致性。

## 响应格式类型

### 1. 分页数据响应 (PaginatedResponse)

用于返回分页列表数据的API端点。

**格式结构：**
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    "items": [...],           // 数据列表，统一使用 items 字段
    "page": 1,               // 当前页码
    "page_size": 10,         // 每页大小
    "total": 100,            // 总记录数
    "total_pages": 10        // 总页数
  }
}
```

**适用场景：**
- 用户列表 (`GET /api/v1/users`)
- 角色列表 (`GET /api/v1/roles`)
- 资产列表 (`GET /api/v1/assets`)
- 审计日志列表 (`GET /api/v1/audit/logs`)
- 命令列表 (`GET /api/v1/commands`)
- 所有需要分页的列表查询接口

### 2. 单项数据响应 (SingleResponse)

用于返回单个资源数据的API端点。

**格式结构：**
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "name": "示例资源",
    "created_at": "2025-01-29T10:00:00Z",
    // ... 其他字段
  }
}
```

**适用场景：**
- 获取单个用户 (`GET /api/v1/users/{id}`)
- 获取单个角色 (`GET /api/v1/roles/{id}`)
- 创建新资源后返回 (`POST /api/v1/users`)
- 更新资源后返回 (`PUT /api/v1/users/{id}`)
- 登录成功后返回用户信息

### 3. 操作成功响应 (SuccessResponse)

用于没有数据返回的成功操作。

**格式结构：**
```json
{
  "success": true,
  "message": "操作完成成功"
}
```

**适用场景：**
- 删除操作 (`DELETE /api/v1/users/{id}`)
- 登出操作 (`POST /api/v1/auth/logout`)
- 密码重置 (`POST /api/v1/users/{id}/reset-password`)
- 状态切换操作

### 4. 错误响应 (ErrorResponse)

用于所有错误情况的响应。

**格式结构：**
```json
{
  "success": false,
  "error": "资源未找到",
  "details": "ID为123的用户不存在"
}
```

**错误类型对应：**
- **400 参数错误：** `error: "请求参数错误"`, `details: "具体参数错误说明"`
- **401 未授权：** `error: "认证失败"`, `details: "token无效或已过期"`
- **403 权限不足：** `error: "权限不足"`, `details: "需要管理员权限"`
- **404 资源不存在：** `error: "资源未找到"`, `details: "指定的资源不存在"`
- **409 冲突：** `error: "资源冲突"`, `details: "用户名已存在"`
- **500 服务器错误：** `error: "服务器内部错误"`, `details: "请联系系统管理员"`

## 响应字段规范

### 通用字段

- **success** (boolean): 操作成功标识
  - `true`: 操作成功
  - `false`: 操作失败
- **message** (string, 可选): 操作结果描述信息
- **data** (object, 可选): 返回的数据内容
- **error** (string): 错误信息（仅错误响应）
- **details** (string, 可选): 详细错误说明（仅错误响应）

### 分页相关字段

- **items** (array): 数据列表，统一字段名
- **page** (integer): 当前页码，从1开始
- **page_size** (integer): 每页记录数
- **total** (integer): 总记录数
- **total_pages** (integer): 总页数，自动计算

## 实施示例

### 用户管理API

```json
// GET /api/v1/users?page=1&page_size=10
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "管理员",
        "created_at": "2025-01-29T10:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 1,
    "total_pages": 1
  }
}

// GET /api/v1/users/1
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "管理员",
    "permissions": ["user:read", "user:write"],
    "created_at": "2025-01-29T10:00:00Z"
  }
}

// DELETE /api/v1/users/1
{
  "success": true,
  "message": "用户删除成功"
}

// GET /api/v1/users/999 (不存在)
{
  "success": false,
  "error": "用户不存在",
  "details": "ID为999的用户不存在"
}
```

### 资产管理API

```json
// GET /api/v1/assets?page=1&page_size=20
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Web服务器1",
        "host": "192.168.1.100",
        "port": 22,
        "status": "online"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

## 时间格式标准

所有时间字段使用 ISO 8601 格式：
- **格式：** `YYYY-MM-DDTHH:mm:ssZ`
- **示例：** `2025-01-29T10:30:45Z`
- **时区：** 统一使用UTC时间

## HTTP状态码使用

- **200 OK：** 操作成功
- **201 Created：** 资源创建成功
- **400 Bad Request：** 请求参数错误
- **401 Unauthorized：** 未授权访问
- **403 Forbidden：** 权限不足
- **404 Not Found：** 资源不存在
- **409 Conflict：** 资源冲突
- **500 Internal Server Error：** 服务器内部错误

## 前端集成指南

前端开发者应该：

1. **统一数据处理：** 使用 `response.data.items` 获取列表数据
2. **分页信息：** 从 `response.data` 中直接获取分页信息
3. **错误处理：** 检查 `response.success` 字段，从 `response.error` 获取错误信息
4. **类型定义：** 使用TypeScript接口确保类型安全

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
```

## 版本控制

- **当前版本：** v1.0
- **更新日期：** 2025-01-29
- **变更说明：** 统一后端API响应格式，建立标准规范

## 兼容性说明

此格式标准向前兼容，新增字段不会影响现有客户端。如需进行破坏性变更，将通过API版本控制机制进行管理。