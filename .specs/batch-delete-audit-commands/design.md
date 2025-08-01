# 命令审计批量删除功能 - 设计文档

## 概述
本设计文档详细说明了如何在命令审计页面实现批量删除功能，参考现有会话审计页面的实现方式，确保UI和交互的一致性。

## 架构设计

### 系统架构
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  命令审计页面    │ ──> │  API Service     │ ──> │  后端控制器      │
│ CommandLogsTable│     │  AuditApiService │     │ audit_controller│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                  │
         ▼                                                  ▼
┌─────────────────┐                              ┌─────────────────┐
│  批量选择状态    │                              │  批量删除服务    │
│  selectedRowKeys│                              │ command_service │
└─────────────────┘                              └─────────────────┘
```

### 前端组件结构
- **CommandLogsTable组件**: 主要的表格组件，需要添加批量选择和删除功能
- **批量删除按钮**: 位于表格底部，与分页器同一水平线
- **Popconfirm确认对话框**: 删除前的确认机制

### 后端API结构
- **新增接口**: `/api/audit/command-logs/batch-delete`
- **请求方法**: POST
- **请求体**: `{ ids: number[], reason: string }`
- **响应格式**: 遵循统一API响应格式规范

## 组件和接口设计

### 组件1: CommandLogsTable 批量选择功能
- **目的**: 在现有表格中添加行选择功能
- **接口**: 
  - `selectedRowKeys: React.Key[]` - 存储选中的行ID
  - `setSelectedRowKeys: (keys: React.Key[]) => void` - 更新选中状态
- **依赖**: Ant Design Table的rowSelection属性

### 组件2: 批量删除按钮
- **目的**: 提供批量删除操作入口
- **位置**: 表格底部，marginTop: -40px
- **样式**: 
  ```tsx
  <div style={{ 
    marginTop: -40, 
    display: 'flex', 
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: '32px'
  }}>
  ```
- **交互**: 显示选中数量，未选中时禁用

### 组件3: 删除确认对话框
- **目的**: 防止误删除
- **实现**: 使用Ant Design的Popconfirm组件
- **提示文本**: "确定要删除这 X 个命令记录吗？"

### 接口1: 前端API服务
- **位置**: `/frontend/src/services/api/AuditApiService.ts`
- **新增方法**:
  ```typescript
  async batchDeleteCommandLogs(request: { ids: number[], reason: string }): Promise<{ success: boolean }> {
    await this.post('/command-logs/batch-delete', request);
    return { success: true };
  }
  ```

### 接口2: 后端控制器
- **位置**: `/backend/controllers/audit_controller.go`
- **新增方法**: `BatchDeleteCommandLogs`
- **路由注册**: `router.POST("/api/audit/command-logs/batch-delete", controller.BatchDeleteCommandLogs)`

## 数据模型

### 批量删除请求模型
```go
type BatchDeleteCommandLogsRequest struct {
    IDs    []int  `json:"ids" binding:"required,min=1"`
    Reason string `json:"reason" binding:"required,max=200"`
}
```

### 批量删除响应模型
```go
type BatchDeleteResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"`
    Data    struct {
        DeletedCount int `json:"deleted_count"`
    } `json:"data"`
}
```

## 错误处理

### 前端错误处理
1. **网络错误**: 显示"批量删除失败"的错误消息
2. **权限错误**: 显示"您没有权限执行此操作"
3. **参数错误**: 显示具体的验证错误信息

### 后端错误处理
1. **参数验证**: 确保IDs非空且Reason不超过200字符
2. **权限验证**: 检查用户是否有删除审计日志的权限
3. **数据库错误**: 使用事务确保批量删除的原子性

## 测试策略

### 单元测试
1. **前端组件测试**:
   - 测试批量选择功能
   - 测试删除按钮的启用/禁用逻辑
   - 测试确认对话框的显示和交互

2. **后端API测试**:
   - 测试批量删除接口的参数验证
   - 测试权限控制
   - 测试事务回滚机制

### 集成测试
1. **端到端测试**:
   - 测试完整的批量删除流程
   - 测试错误场景的处理
   - 测试大批量数据的性能

## 实现注意事项

### 前端注意事项
1. **状态管理**: 使用useState管理选中状态和loading状态
2. **性能优化**: 使用React.useCallback优化事件处理函数
3. **样式一致性**: 严格参考SessionAuditTable的实现

### 后端注意事项
1. **事务处理**: 批量删除必须在数据库事务中执行
2. **操作日志**: 记录批量删除操作到操作日志表
3. **软删除**: 考虑是否需要软删除而非物理删除

## 安全考虑
1. **权限控制**: 只有管理员角色可以执行批量删除
2. **审计追踪**: 所有删除操作必须记录操作者和原因
3. **防止误删**: 强制要求填写删除原因
4. **数据备份**: 建议在删除前自动备份相关数据

## 性能考虑
1. **批量限制**: 建议单次批量删除不超过1000条记录
2. **分批处理**: 对于大量数据，后端应分批处理
3. **索引优化**: 确保命令日志表的ID字段有索引