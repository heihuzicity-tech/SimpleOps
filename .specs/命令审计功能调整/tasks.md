# 命令审计功能调整 - 实施任务

## 任务概览
本功能调整包含6个主要模块，预计需要2个工作日完成。

## 前置条件
- [ ] 开发环境已配置
- [ ] 数据库连接正常
- [ ] 前后端服务可正常启动

## 任务列表

### 1. 数据模型扩展
- [x] 1.1 修改CommandLog模型添加Action字段
  - 文件: `backend/models/user.go`
  - 描述: 在CommandLog和CommandLogResponse结构体中添加Action字段
  - 验收: 模型编译通过，字段定义正确

- [x] 1.2 创建数据库迁移文件
  - 文件: `backend/migrations/20250731_add_action_to_command_logs.sql`
  - 描述: 添加action列到command_logs表，设置默认值为'allow'
  - 验收: 迁移脚本可成功执行，表结构更新正确

### 2. 后端审计服务调整
- [x] 2.1 修改RecordCommandLog方法签名
  - 文件: `backend/services/audit_service.go`
  - 描述: RecordCommandLog方法添加action参数，保存到数据库
  - 验收: 方法签名更新，action字段正确保存

- [x] 2.2 修改RecordCommand方法
  - 文件: `backend/services/ssh_service.go`
  - 描述: RecordCommand方法添加action参数，传递给RecordCommandLog
  - 验收: 方法调用链完整，参数传递正确

### 3. 命令记录逻辑实现
- [x] 3.1 在命令匹配后添加记录逻辑
  - 文件: `backend/controllers/ssh_controller.go`
  - 描述: 在handleWebSocketInput的命令匹配逻辑中，匹配成功时调用RecordCommand
  - 验收: 只有匹配的命令被记录到数据库

- [x] 3.2 记录命令执行信息
  - 文件: `backend/controllers/ssh_controller.go`
  - 描述: 收集命令、用户、资产等信息，调用sshService.RecordCommand方法
  - 验收: 命令日志包含完整信息（命令、用户、资产、action等）

### 4. 前端类型定义更新
- [x] 4.1 更新TypeScript接口定义
  - 文件: `frontend/src/services/auditAPI.ts`
  - 描述: CommandLog接口添加action字段（类型为string）
  - 验收: TypeScript编译通过，类型定义正确

### 5. 前端界面功能增强
- [x] 5.1 导入录屏播放依赖
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 导入RecordingPlayer、RecordingAPI等依赖
  - 验收: 依赖导入正确，无编译错误

- [x] 5.2 修改列标题
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 将"日期时间"改为"执行时间"
  - 验收: 界面显示"执行时间"列标题

- [x] 5.3 添加指令类型列
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 在命令列后添加"指令类型"列，根据action显示对应文本和颜色
  - 验收: 显示"指令阻断"(红)/"指令放行"(绿)/"指令警告"(橙)

- [x] 5.4 实现会话ID链接功能
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 将会话ID改为可点击链接，复用SessionAuditTable的播放逻辑
  - 验收: 点击会话ID打开录屏播放器

- [x] 5.5 调整操作列宽度
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 将操作列width从300调整为80
  - 验收: 表格布局紧凑合理

- [x] 5.6 添加播放器状态管理
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 添加播放器visible状态、当前录屏等状态变量
  - 验收: 状态管理完整，播放器可正常打开关闭

### 6. 集成测试与优化
- [ ] 6.1 测试命令记录过滤
  - 文件: 无
  - 描述: 配置命令过滤规则，执行匹配和不匹配的命令
  - 验收: 只有匹配规则的命令产生日志记录

- [ ] 6.2 测试指令类型显示
  - 文件: 无
  - 描述: 创建block/allow/warning三种规则，验证显示效果
  - 验收: 指令类型文本和颜色正确显示

- [ ] 6.3 测试录屏播放功能
  - 文件: 无
  - 描述: 点击不同会话的ID，验证播放器功能
  - 验收: 播放器正常加载对应会话的录屏

- [x] 6.4 处理异常情况
  - 文件: `frontend/src/components/audit/CommandLogsTable.tsx`
  - 描述: 处理无录屏文件、加载失败等情况
  - 验收: 异常情况有友好提示

## 执行指南

### 任务执行规则
1. **模块化执行**: 按模块顺序执行，每个模块内可并行
2. **依赖管理**: 1-2必须先完成，3依赖2，5依赖4
3. **测试验证**: 每个模块完成后进行基本验证
4. **问题记录**: 遇到问题及时记录并调整方案

### 完成标记
- `[x]` 已完成的任务
- `[!]` 遇到问题的任务
- `[~]` 进行中的任务

### 执行命令
- `/kiro exec 1.1` - 执行特定任务
- `/kiro next` - 执行下一个未完成任务
- `/kiro continue` - 继续未完成的任务

## 进度跟踪

### 时间规划
- **预计开始**: 2025-01-31
- **预计完成**: 2025-02-01

### 完成统计
- **总任务数**: 17
- **已完成**: 14
- **进行中**: 0
- **完成率**: 82%

### 里程碑
- [x] 数据模型扩展完成（任务 1.x）
- [x] 后端服务调整完成（任务 2.x）
- [x] 命令记录逻辑完成（任务 3.x）
- [x] 前端类型更新完成（任务 4.x）
- [x] 界面功能增强完成（任务 5.x）
- [ ] 测试优化完成（任务 6.x）

## 变更日志
- [2025-01-31] - 创建任务计划 - 初始版本
- [2025-01-31] - 重新调整任务结构 - 优化任务顺序和依赖关系
- [2025-01-31] - 完成主要开发任务 - 剩余测试验证任务

## 完成检查清单
- [ ] 所有任务已完成并通过验收标准
- [ ] 代码已提交并通过代码审查
- [ ] 功能测试全部通过
- [ ] 相关文档已更新