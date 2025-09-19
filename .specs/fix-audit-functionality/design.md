# 修复命令审计功能 - 技术设计文档

## 概述
本设计文档详细说明如何修复堡垒机的命令审计功能，包括完善命令捕获机制、修复后端记录功能，以及重新设计前端UI以匹配参考图片的简洁风格。

## 现有代码分析

### 相关模块
- **SSHController**: WebSocket处理和命令缓冲区管理 - 位置：`backend/controllers/ssh_controller.go`
- **SSHService**: SSH会话管理和命令记录调用 - 位置：`backend/services/ssh_service.go`
- **AuditService**: 审计日志记录服务 - 位置：`backend/services/audit_service.go`
- **CommandLogsTable**: 前端命令审计组件 - 位置：`frontend/src/components/audit/CommandLogsTable.tsx`

### 依赖分析
- 数据库：MySQL（命令日志表：command_logs）
- WebSocket：用于实时SSH会话通信
- 前端框架：React + Ant Design

## 架构设计

### 系统架构
```
前端UI → WebSocket → SSH控制器 → SSH服务 → 审计服务 → 数据库
                ↓
         命令缓冲区管理
                ↓
         命令过滤/拦截
                ↓
         命令记录审计
```

### 模块划分
- **命令捕获模块**：负责从SSH会话中准确捕获命令
- **审计记录模块**：负责将命令信息持久化到数据库
- **前端展示模块**：负责以简洁的表格形式展示命令审计日志

## 核心组件设计

### 组件1: 命令捕获增强
- **责任**：准确捕获SSH会话中的完整命令
- **位置**：`backend/controllers/ssh_controller.go`
- **接口设计**：
  - 增强updateCommandBuffer方法以更准确地解析命令
  - 在命令执行时触发审计记录
- **依赖**：SSHService, AuditService
- **注意**：不再需要进行风险等级评估

### 组件2: 审计记录修复
- **责任**：修复RecordCommand方法中的用户名问题
- **位置**：`backend/services/ssh_service.go`
- **接口设计**：
  - 修改RecordCommand方法以获取正确的用户名
  - 确保命令执行信息完整传递
- **依赖**：AuditService, 数据库

### 组件3: 前端UI重设计
- **责任**：重新设计命令审计页面以匹配参考图片风格
- **位置**：`frontend/src/components/audit/CommandLogsTable.tsx`
- **接口设计**：
  - 简化表格布局，移除统计卡片、警告组件和高亮样式
  - 不显示风险等级列
  - 保持核心功能：搜索、分页、查看详情
- **依赖**：AuditAPI服务（仅使用基础的列表和详情API）

## 数据模型设计

### 核心实体
```go
// CommandLog 命令日志（现有模型无需修改）
type CommandLog struct {
    ID        uint      `json:"id"`
    SessionID string    `json:"session_id"`
    UserID    uint      `json:"user_id"`
    Username  string    `json:"username"`
    AssetID   uint      `json:"asset_id"`
    Command   string    `json:"command"`
    Output    string    `json:"output"`
    ExitCode  int       `json:"exit_code"`
    Risk      string    `json:"risk"`
    StartTime time.Time `json:"start_time"`
    EndTime   *time.Time `json:"end_time"`
    Duration  int64     `json:"duration"`
}
```

### 前端界面设计
基于参考图片，新的UI设计将包含：
- 简洁的表格头部：用户、命令、资产、账号、会话、日期时间、操作
- 紧凑的行间距和字体大小（使用Ant Design的small尺寸）
- 移除统计卡片、警告提示和风险等级显示
- 单一搜索框设计：下拉选择搜索类型（主机/操作用户/命令内容）+ 输入框
- 移除时间范围过滤功能
- 采用更简约的配色方案
- 不需要后端提供额外的统计API和风险评估功能

## API设计

### 现有API（保持不变）
```
GET    /api/v1/audit/command-logs     - 获取命令日志列表
GET    /api/v1/audit/command-logs/:id - 获取命令日志详情
```

## 文件修改计划

### 需要修改的文件
1. `backend/services/ssh_service.go` - 修复RecordCommand方法
2. `backend/controllers/ssh_controller.go` - 增强命令捕获机制
3. `frontend/src/components/audit/CommandLogsTable.tsx` - 重新设计UI

### 关键修改点
1. **SSH服务修复**：
   - 在RecordCommand中正确获取用户名
   - 确保命令开始和结束时间被正确记录

2. **命令捕获增强**：
   - 改进命令缓冲区解析逻辑
   - 在命令执行完成时触发审计记录

3. **前端UI重设计**：
   - 简化表格结构，匹配参考图片风格
   - 移除统计卡片、警告组件和风险等级列
   - 优化搜索和过滤布局

## 错误处理策略
- 命令记录失败：使用异步记录，失败不影响SSH会话
- 数据库连接问题：实现重试机制
- 大型命令输出：限制输出存储大小（如10KB）

## 性能与安全考虑

### 性能目标
- 命令记录异步执行，不阻塞SSH会话
- 前端表格支持虚拟滚动处理大量数据
- 搜索查询使用索引优化

### 安全控制
- 敏感命令输出进行脱敏处理
- 审计日志访问需要相应权限
- 防止SQL注入和XSS攻击

## 基本测试策略
- 单元测试：测试命令解析和记录逻辑
- 集成测试：测试完整的命令审计流程
- UI测试：验证前端显示和交互功能

## 实施步骤
1. 修复后端命令记录功能（优先级：高）
2. 增强命令捕获机制（优先级：高）
3. 重新设计前端UI（优先级：中）
4. 测试和优化（优先级：中）

## 风险和注意事项
1. 确保修改不影响现有SSH会话功能
2. 保持向后兼容性
3. 充分测试各种SSH客户端的兼容性
4. 注意处理特殊字符和多字节字符