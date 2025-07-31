# 命令审计功能调整 - 技术设计

## 概述
本设计文档详细说明了如何调整命令审计功能，使其只记录命令过滤中配置的命令，并增强用户界面交互功能。

## 现有代码分析

### 相关模块
- **命令记录模块**: `backend/services/audit_service.go` - RecordCommandLog方法
- **WebSocket处理**: `backend/controllers/ssh_controller.go` - handleWebSocketInput方法
- **命令过滤服务**: `backend/services/command_filter_service.go` 
- **前端展示**: `frontend/src/components/audit/CommandLogsTable.tsx`
- **会话播放**: `frontend/src/components/audit/SessionAuditTable.tsx` - 包含播放功能

### 依赖分析
- 命令日志模型: `models.CommandLog`
- 命令过滤服务: `CommandFilterService` 和 `CommandMatcherService`
- 录屏播放组件: `RecordingPlayer`
- 录屏API服务: `RecordingAPI`

## 架构设计

### 系统架构
```
前端界面
    ├── CommandLogsTable组件（命令审计表格）
    └── RecordingPlayer组件（录屏播放器）
         ↓
    WebSocket连接
         ↓
后端处理
    ├── SSHController（命令拦截和过滤）
    ├── CommandMatcherService（命令匹配）
    └── AuditService（命令记录）
```

### 模块划分
- **前端模块**: 负责UI展示、用户交互和录屏播放
- **后端模块**: 负责命令过滤匹配、日志记录和数据存储

## 核心组件设计

### 组件1: 命令记录过滤器
- **责任**: 在命令执行前检查是否需要记录
- **位置**: `backend/controllers/ssh_controller.go`
- **接口设计**: 在现有的handleWebSocketInput方法中添加记录逻辑
- **依赖**: CommandMatcherService, AuditService

### 组件2: 命令日志表格增强
- **责任**: 显示命令审计信息，支持会话ID链接
- **位置**: `frontend/src/components/audit/CommandLogsTable.tsx`
- **接口设计**: 复用SessionAuditTable的播放功能
- **依赖**: RecordingAPI, RecordingPlayer

## 数据模型设计

### 核心实体
```go
// 需要在CommandLog中添加action字段
type CommandLog struct {
    // ... 现有字段
    Action string `json:"action" gorm:"size:20"` // allow, block, warning
}

// 需要在CommandLogResponse中添加action字段
type CommandLogResponse struct {
    // ... 现有字段
    Action string `json:"action"`
}
```

### 关系模型
- CommandLog与CommandFilter通过命令匹配关联
- SessionRecord与Recording通过session_id关联

## API设计

### REST API端点
无需新增API端点，使用现有的：
- `GET /api/audit/command-logs` - 获取命令日志列表
- `GET /api/recordings` - 获取录屏列表（通过session_id查询）

## 文件修改计划

### 新增文件
无需创建新文件，所有功能通过修改现有文件实现。

### 现有文件修改

1. **`backend/controllers/ssh_controller.go`**
   - 修改handleWebSocketInput方法，在命令匹配后记录日志
   - 传递action字段到RecordCommandLog方法

2. **`backend/services/audit_service.go`**
   - 修改RecordCommandLog方法，添加action参数
   - 只在命令匹配时才记录日志

3. **`backend/models/user.go`**
   - CommandLog结构体添加Action字段
   - CommandLogResponse结构体添加Action字段

4. **`backend/migrations/`**
   - 创建迁移文件添加action列到command_logs表

5. **`frontend/src/components/audit/CommandLogsTable.tsx`**
   - 修改会话ID列为可点击链接
   - 添加录屏播放功能
   - 修改"日期时间"为"执行时间"
   - 添加"指令类型"列
   - 调整操作列宽度

6. **`frontend/src/services/auditAPI.ts`**
   - CommandLog接口添加action字段

## 错误处理策略
- 命令匹配失败: 记录错误日志，默认不记录命令
- 录屏文件缺失: 显示友好提示"该会话没有录屏文件"
- 数据库写入失败: 记录错误日志，不影响SSH会话

## 性能与安全考虑

### 性能目标
- 命令匹配缓存: 使用内存缓存命令过滤规则
- 批量查询优化: 播放功能使用session_id索引快速查询

### 安全控制
- 权限验证: 复用现有的审计权限控制
- 数据隔离: 保持现有的用户数据隔离机制

## 基本测试策略
- 单元测试: 测试命令匹配和记录逻辑
- 集成测试: 测试完整的命令执行和记录流程
- UI测试: 测试会话ID链接和播放功能