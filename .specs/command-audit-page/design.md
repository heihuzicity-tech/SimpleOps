# 命令审计页面对接后端实现 - 技术设计文档

## 概述
本设计文档详细说明了如何实现命令审计页面与后端API的完整对接，确保前端能够正确展示命令执行记录，支持搜索过滤和查看详情等功能。

## 现有代码分析

### 相关模块
- **前端组件**: `frontend/src/components/audit/CommandLogsTable.tsx` - 命令日志表格组件
- **前端页面**: `frontend/src/pages/audit/CommandAuditPage.tsx` - 命令审计页面
- **前端服务**: `frontend/src/services/auditAPI.ts` - 审计API服务
- **API服务类**: `frontend/src/services/api/AuditApiService.ts` - 审计API服务实现
- **后端控制器**: `backend/controllers/audit_controller.go` - 审计控制器（已使用统一响应格式）
- **后端服务**: `backend/services/audit_service.go` - 审计服务层
- **响应辅助函数**: `backend/utils/response.go` - 统一响应格式辅助函数
- **响应适配器**: `frontend/src/services/responseAdapter.ts` - 前端响应格式适配器

### 依赖分析
- **前端框架**: React + TypeScript + Ant Design
- **状态管理**: 组件内部state管理
- **API客户端**: BaseApiService基础服务类
- **后端框架**: Gin框架
- **数据格式**: 统一的JSON响应格式

## 架构设计

### 系统架构
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ CommandAuditPage│ ──> │CommandLogsTable│ ──> │  AuditApiService│
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │ responseAdapter  │
                                              └──────────────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Backend API     │
                                              └──────────────────┘
```

### 模块划分
- **展示层**: CommandAuditPage 和 CommandLogsTable 组件
- **服务层**: AuditApiService 处理API调用
- **适配层**: responseAdapter 处理响应格式转换
- **后端层**: audit_controller 提供RESTful API

## 核心组件设计

### 组件1: CommandLogsTable 优化
- **职责**: 展示命令日志列表，支持搜索、分页和查看详情
- **位置**: `frontend/src/components/audit/CommandLogsTable.tsx`
- **需要修改**:
  - API响应处理逻辑，使用响应适配器
  - 资产和用户信息的展示方式
  - 错误处理机制

### 组件2: AuditApiService 增强
- **职责**: 处理审计相关的API调用
- **位置**: `frontend/src/services/api/AuditApiService.ts`
- **需要修改**:
  - 集成响应适配器
  - 统一错误处理

### 组件3: 响应适配器扩展
- **职责**: 处理不同格式的API响应
- **位置**: `frontend/src/services/responseAdapter.ts`
- **需要修改**:
  - 确保支持审计日志的响应格式

## 数据模型设计

### 核心实体
```typescript
// 命令日志
interface CommandLog {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  asset_id: number;
  command: string;
  output: string;
  exit_code: number;
  risk: 'low' | 'medium' | 'high';
  start_time: string;
  end_time?: string;
  duration: number;
  created_at: string;
}

// 命令日志列表参数
interface CommandLogListParams {
  page?: number;
  page_size?: number;
  session_id?: string;
  asset_id?: number;
  username?: string;
  command?: string;
  risk?: 'low' | 'medium' | 'high';
}
```

### 关系模型
- CommandLog 关联 User（通过 user_id）
- CommandLog 关联 Asset（通过 asset_id）
- CommandLog 关联 SessionRecord（通过 session_id）

## API设计

### API端点
```
GET /api/audit/command-logs
- 查询参数: page, page_size, session_id, asset_id, username, command, risk
- 响应格式: { success: true, data: { items: [...], page, page_size, total, total_pages } }

GET /api/audit/command-logs/:id
- 路径参数: id (命令日志ID)
- 响应格式: { success: true, data: { ...commandLog } }
```

### 响应格式示例
```json
// 列表响应
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "session_id": "abc123",
        "user_id": 1,
        "username": "admin",
        "asset_id": 10,
        "command": "ls -la",
        "output": "...",
        "exit_code": 0,
        "risk": "low",
        "start_time": "2025-01-30T10:00:00Z",
        "end_time": "2025-01-30T10:00:01Z",
        "duration": 1000,
        "created_at": "2025-01-30T10:00:01Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}

// 详情响应
{
  "success": true,
  "data": {
    "id": 1,
    "session_id": "abc123",
    "user_id": 1,
    "username": "admin",
    "asset_id": 10,
    "command": "ls -la",
    "output": "total 48\ndrwxr-xr-x  6 user user 4096 Jan 30 10:00 .\n...",
    "exit_code": 0,
    "risk": "low",
    "start_time": "2025-01-30T10:00:00Z",
    "end_time": "2025-01-30T10:00:01Z",
    "duration": 1000,
    "created_at": "2025-01-30T10:00:01Z"
  }
}
```

## 文件修改计划

### 需要修改的文件
1. **前端组件优化**
   - `frontend/src/components/audit/CommandLogsTable.tsx` - 优化API调用和数据处理
   - `frontend/src/components/audit/CommandLogsTable.module.css` - 样式调整（如需要）

2. **API服务增强**
   - `frontend/src/services/api/AuditApiService.ts` - 确保使用响应适配器

3. **响应适配器验证**
   - `frontend/src/services/responseAdapter.ts` - 验证对审计日志格式的支持

### 可能需要创建的文件
- 无需创建新文件，现有架构已经完备

## 错误处理策略
- **网络错误**: 显示友好的错误提示，提供重试选项
- **权限错误**: 提示用户权限不足
- **数据格式错误**: 使用响应适配器处理格式差异
- **空数据**: 显示"暂无数据"的友好提示

## 性能与安全考虑

### 性能目标
- 列表加载时间 < 1秒
- 详情查看响应时间 < 500ms
- 支持大数据量的分页展示

### 安全控制
- API调用包含认证token
- 敏感命令输出的适当处理
- XSS防护（React默认提供）

## 实施策略

### 第一阶段：验证和优化
1. 验证后端API响应格式
2. 测试响应适配器的兼容性
3. 优化CommandLogsTable组件的数据处理

### 第二阶段：功能完善
1. 实现搜索功能的优化
2. 改进资产信息的展示
3. 增强错误处理机制

### 第三阶段：测试和调试
1. 端到端功能测试
2. 性能测试
3. 用户体验优化

## 测试策略
- **单元测试**: 测试响应适配器的各种格式处理
- **集成测试**: 测试API调用的完整流程
- **UI测试**: 测试用户交互功能
- **性能测试**: 测试大数据量的处理能力