# SSH会话ID显示修复 - 实现任务清单

## 任务概述
本功能修复包含 **8** 个具体任务，预计需要 **半天** 完成。

## 前置条件
- [x] 开发环境已配置完成
- [x] 前端依赖已安装 (React, TypeScript, Antd)
- [x] 后端Go环境正常
- [x] 数据库连接正常

## 任务列表

### 1. 基础设施验证
- [ ] 1.1 验证前端组件现状
  - 文件: `frontend/src/components/audit/OperationLogsTable.tsx`
  - 描述: 确认详情模态框中缺失"资源ID"字段显示
  - 验收: 找到被删除的字段显示位置（约502-505行）

- [ ] 1.2 验证后端数据完整性
  - 文件: `backend/services/audit_service.go`
  - 描述: 确认UpdateOperationLogSessionID方法的执行状态
  - 验收: 方法正常工作，异步更新机制有效

### 2. 前端显示修复
- [ ] 2.1 恢复资源ID字段基础显示
  - 文件: `frontend/src/components/audit/OperationLogsTable.tsx`
  - 描述: 在详情模态框中添加基础的"资源ID"字段显示
  - 位置: 约502-505行区域，selectedLog.resource_id字段
  - 验收: 详情模态框中能看到"资源ID"字段，显示resource_id值

- [ ] 2.2 实现智能字段显示逻辑
  - 文件: `frontend/src/components/audit/OperationLogsTable.tsx`
  - 描述: 实现session_id优先，resource_id备选的显示策略
  - 代码: `const displayValue = selectedLog.session_id || selectedLog.resource_id || '-'`
  - 验收: SSH操作显示会话ID，其他操作显示资源ID

- [ ] 2.3 优化字段标签显示
  - 文件: `frontend/src/components/audit/OperationLogsTable.tsx`
  - 描述: 根据数据类型动态显示"会话ID"或"资源ID"标签
  - 代码: `const fieldLabel = selectedLog.session_id ? '会话ID' : '资源ID'`
  - 验收: 标签根据实际数据类型动态变化

- [ ] 2.4 添加错误处理逻辑
  - 文件: `frontend/src/components/audit/OperationLogsTable.tsx`
  - 描述: 处理字段值为空、null、undefined的情况
  - 验收: 各种异常情况下界面稳定显示占位符"-"

### 3. 功能验证测试
- [ ] 3.1 SSH会话创建操作测试
  - 场景: 创建SSH会话并查看操作审计详情
  - 验证点: 详情中显示完整的会话ID信息
  - 数据: 创建真实SSH连接，检查session_id字段
  - 验收: SSH创建操作的审计详情显示会话ID

- [ ] 3.2 SSH会话关闭操作测试
  - 场景: 关闭SSH会话并查看操作审计详情
  - 验证点: 关闭操作的会话ID与创建时一致
  - 数据: 关闭之前创建的SSH会话
  - 验收: 关闭操作审计详情显示相同的会话ID

- [ ] 3.3 其他操作类型兼容性测试
  - 场景: 用户管理、资产管理等其他操作审计
  - 验证点: 其他操作的资源ID字段正常显示
  - 数据: 执行用户创建、资产修改等操作
  - 验收: 非SSH操作的资源ID显示正常，无回归问题

### 4. 质量保证和优化
- [ ] 4.1 异步更新机制验证
  - 文件: `backend/services/audit_service.go`
  - 描述: 确认UpdateOperationLogSessionID的异步执行效果
  - 验证: 检查数据库中session_id字段的更新情况
  - 验收: SSH创建操作的session_id字段在1分钟内正确更新

## 执行指南
### 任务执行规则
1. **顺序执行**: 按编号顺序执行，确保依赖关系
2. **验收标准**: 每个任务必须满足验收条件才能标记完成
3. **问题记录**: 遇到问题时立即记录并分析解决方案
4. **质量检查**: 完成后进行回归测试，确保无副作用

### 完成标记说明
- `[x]` 已完成任务
- `[!]` 任务存在问题需要解决
- `[~]` 任务正在进行中

### 执行命令
- `/kiro exec 1.1` - 执行指定任务
- `/kiro next` - 执行下一个未完成任务
- `/kiro continue` - 继续当前未完成任务

## 进度跟踪
### 时间规划
- **预计开始**: 立即开始
- **预计完成**: 当天内完成

### 完成统计
- **总任务数**: 8
- **已完成**: 0
- **进行中**: 0
- **完成率**: 0%

### 里程碑检查点
- [ ] 基础验证完成 (任务1.x)
- [ ] 前端修复完成 (任务2.x)
- [ ] 功能测试通过 (任务3.x)
- [ ] 质量保证完成 (任务4.x)

## 变更记录
- [2025-01-22] - 初始任务规划完成 - 制定8个详细实现任务

## 完成检查清单
- [ ] 所有任务完成并通过验收标准
- [ ] SSH会话创建和关闭操作都能显示会话ID
- [ ] 其他操作类型的资源ID显示正常
- [ ] 异常情况处理稳定
- [ ] 无功能回归问题
- [ ] 用户体验良好