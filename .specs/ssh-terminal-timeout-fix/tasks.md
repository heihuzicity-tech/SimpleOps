# SSH终端超时修复 - 实施任务

## 任务概览
本项目通过最小化改动解决SSH终端超时和滚动性能问题，预计工作量0.5天。

## 前置条件
- [x] 数据库已备份
- [x] Git分支已创建 (feature/ssh-terminal-timeout-fix)
- [x] 开发环境正常

## 任务列表

### 1. 后端WebSocket超时修复
- [ ] 1.1 删除WebSocket ReadDeadline设置
  - 文件：`backend/controllers/ssh_controller.go`
  - 行数：第279行
  - 描述：删除 `wsConn.conn.SetReadDeadline(time.Now().Add(60 * time.Second))`
  - 验收：该行代码被完全删除

- [ ] 1.2 删除PongHandler中的超时重置
  - 文件：`backend/controllers/ssh_controller.go`
  - 行数：第280-283行
  - 描述：删除整个SetPongHandler定义块
  - 验收：PongHandler相关代码被删除，只保留SetReadLimit

### 2. 前端终端性能优化
- [ ] 2.1 减少终端历史缓冲区
  - 文件：`frontend/src/components/ssh/WebTerminal.tsx`
  - 行数：第73行
  - 描述：将 `scrollback: 1000` 改为 `scrollback: 200`
  - 验收：值修改为200

- [ ] 2.2 关闭平滑滚动动画
  - 文件：`frontend/src/components/ssh/WebTerminal.tsx`
  - 行数：第83行
  - 描述：将 `smoothScrollDuration: 125` 改为 `smoothScrollDuration: 0`
  - 验收：值修改为0

- [ ] 2.3 关闭光标闪烁
  - 文件：`frontend/src/components/ssh/WebTerminal.tsx`
  - 行数：第63行
  - 描述：将 `cursorBlink: true` 改为 `cursorBlink: false`
  - 验收：值修改为false

### 3. 测试验证
- [ ] 3.1 编译测试
  - 描述：确保前后端都能正常编译
  - 命令：`cd backend && go build` 和 `cd frontend && npm run build`
  - 验收：编译无错误

- [ ] 3.2 功能测试
  - 描述：测试SSH终端基本功能
  - 步骤：
    1. 启动前后端服务
    2. 创建SSH连接
    3. 执行基本命令
  - 验收：功能正常

- [ ] 3.3 超时测试
  - 描述：验证不同超时设置下的行为
  - 测试场景：
    1. 设置30分钟超时，闲置25分钟，验证连接保持
    2. 设置30分钟超时，闲置35分钟，验证正确断开
    3. 设置无限制，闲置1小时，验证连接保持
  - 验收：超时行为符合用户设置

- [ ] 3.4 性能测试
  - 描述：测试终端滚动性能
  - 步骤：
    1. 执行产生大量输出的命令（如 `find /` 或 `cat large_file`）
    2. 快速上下滚动
    3. 观察滚动流畅度
  - 验收：滚动无明显卡顿

### 4. 代码提交
- [ ] 4.1 提交代码变更
  - 描述：提交所有修改到Git
  - 命令：`git add -A && git commit -m "fix: 修复SSH终端WebSocket超时和滚动性能问题"`
  - 验收：代码已提交

## 执行指南

### 执行顺序
1. 先完成所有代码修改（任务1和2）
2. 进行完整测试（任务3）
3. 确认无问题后提交（任务4）

### 注意事项
- 修改代码时注意保留代码格式和缩进
- 测试时要覆盖各种超时配置场景
- 如遇到问题，先回滚再分析

### 执行命令
- `/kiro exec 1.1` - 执行第一个任务
- `/kiro next` - 执行下一个未完成任务
- `/kiro status SSH终端超时修复` - 查看进度

## 时间预估
- 代码修改：20分钟
- 测试验证：30分钟
- 总计：约50分钟

## 风险提示
- 删除ReadDeadline后要确保SessionTimeoutService正常工作
- 减少scrollback可能影响需要查看大量历史的用户
- 测试要覆盖长时间运行场景