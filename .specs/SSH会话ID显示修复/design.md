# SSH会话ID显示修复 - 技术设计文档

## 概述
通过恢复前端"资源ID"字段显示和优化显示逻辑，解决SSH会话审计信息显示不完整的问题。

## 现有代码分析
### 相关模块
- **前端组件**: `frontend/src/components/audit/OperationLogsTable.tsx` - 操作审计列表和详情显示
- **API服务**: `frontend/src/services/auditAPI.ts` - 审计数据接口定义
- **后端服务**: `backend/services/audit_service.go` - 审计业务逻辑处理
- **SSH服务**: `backend/services/ssh_service.go` - SSH会话管理和审计记录

### 依赖分析
- React + TypeScript + Antd：前端技术栈
- Gin框架：后端HTTP服务
- GORM：数据库ORM操作
- MySQL：操作审计数据存储

## 系统架构设计
### 整体架构
```
前端用户界面层
    ↓ (用户交互)
前端组件层 [OperationLogsTable.tsx]
    ↓ (API调用)
前端服务层 [auditAPI.ts]
    ↓ (HTTP请求)
后端控制层 [audit_controller.go]
    ↓ (业务调用)
后端服务层 [audit_service.go]
    ↓ (数据操作)
数据存储层 [operation_logs表]
```

### SSH会话审计集成架构
```
SSH创建请求 → SSH控制器 → SSH服务
                ↓            ↓
            中间件记录 → 异步更新SessionID
                ↓            ↓
            基础审计记录 → 完整审计记录
                ↓
            前端详情显示
```

## 核心组件设计
### 组件1: 前端显示修复
- **文件**: `frontend/src/components/audit/OperationLogsTable.tsx`
- **责任**: 在操作审计详情模态框中显示资源ID/会话ID
- **位置**: 详情模态框约502-505行区域
- **接口设计**: 
```typescript
// 智能显示逻辑
const displayValue = selectedLog.session_id || selectedLog.resource_id || '-';
const fieldLabel = selectedLog.session_id ? '会话ID' : '资源ID';
```
- **依赖**: selectedLog对象，Antd的Col、Text组件

### 组件2: 数据验证服务
- **文件**: `backend/services/audit_service.go`
- **责任**: 确保SSH会话ID正确记录到操作审计中
- **方法**: `UpdateOperationLogSessionID(userID, path, sessionID, timestamp)`
- **接口设计**: 异步更新机制，通过时间窗口匹配相关记录

## 数据模型设计
### 核心实体
```typescript
interface OperationLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  method: string;
  url: string;
  action: string;
  resource: string;
  resource_id: number;  // 传统资源ID
  session_id?: string;  // SSH会话ID（新增字段）
  status: number;
  message: string;
  duration: number;
  created_at: string;
}
```

### 关系模型
- OperationLog与SessionRecord：通过session_id字段关联
- OperationLog与User：通过user_id字段关联
- SessionRecord与Asset：通过asset_id字段关联

## API设计
### 现有接口复用
```typescript
// 获取操作日志详情
GET /api/audit/operation-logs/{id}
Response: {
  success: boolean;
  data: OperationLog;
  message?: string;
}
```

### 数据流优化
```typescript
// 前端显示优化逻辑
const getDisplayInfo = (log: OperationLog) => {
  if (log.session_id) {
    return { label: '会话ID', value: log.session_id };
  }
  if (log.resource_id) {
    return { label: '资源ID', value: log.resource_id.toString() };
  }
  return { label: '资源ID', value: '-' };
};
```

## 文件修改计划
### 修改的现有文件
- `frontend/src/components/audit/OperationLogsTable.tsx`
  - 添加缺失的资源ID显示字段（行502-505区域）
  - 实现智能显示逻辑
  - 添加错误处理

### 验证的现有文件
- `backend/services/audit_service.go`
  - 确认UpdateOperationLogSessionID方法正常
  - 验证异步更新时间窗口逻辑
- `frontend/src/services/auditAPI.ts`
  - 确认OperationLog接口包含所需字段
  - 验证API响应数据完整性

## 错误处理策略
### 前端错误处理
```typescript
const safeGetFieldValue = (log: OperationLog) => {
  try {
    return log.session_id || log.resource_id?.toString() || '-';
  } catch (error) {
    console.error('Error accessing log fields:', error);
    return '-';
  }
};
```

### 后端容错机制
- 异步更新失败时记录错误日志
- 提供手动修复机制
- 数据库连接失败时的重试策略

## 性能和安全考虑
### 性能设计
- 前端：单个字段显示，性能影响可忽略
- 后端：复用现有异步更新机制，无额外性能开销
- 数据库：利用现有索引，无需额外优化

### 安全控制
- 遵循现有的审计访问权限控制
- 不暴露敏感的会话内部信息
- 保持与现有安全策略的一致性

## 基本测试策略
### 单元测试
- 前端组件渲染测试
- 字段显示逻辑测试
- 错误处理测试

### 集成测试
- SSH会话创建到审计显示的端到端测试
- 异步更新机制验证
- 多种操作类型的兼容性测试