# SSH终端优化 - 下一次对话提示词

## 背景
我们在尝试优化SSH终端性能时，引入了过多的复杂性（输入聚合器、输出缓冲器、多层channel等），导致了以下严重问题：
1. 输入字符丢失和顺序错乱
2. 终端频繁卡死（执行约10条命令后）
3. 显示与实际执行不一致
4. shutdown等命令导致的特殊问题

经过分析，我们认识到这是过度工程化的问题，决定回退到简单可靠的实现。

## 当前状态
- 已回退所有代码修改到最后一次git提交状态
- 已保存简化方案文档在：`.specs/ssh-terminal-optimization/simplification-plan.md`
- 核心思路：移除所有中间缓冲层，采用直接转发模式

## 需要你帮助的任务

### 1. 实施简化方案
请根据简化方案文档，帮我实施最简单的SSH终端实现：
- 前端：移除InputAggregator和TerminalWriter，直接处理输入输出
- 后端：移除outputBuffer和writeChan，直接转发数据
- 保持代码最简单，优先保证功能正常

### 2. 关键要求
- **不要添加任何优化**，除非经过充分测试证明确实需要
- **保持代码简单**，每个函数不超过30行
- **错误处理清晰**，失败就断开，让客户端重连
- **不要在传输层做命令过滤**，这应该在更高层实现

### 3. 测试重点
实施后请重点测试：
- 基本命令执行是否正常
- vim等交互程序是否正常
- 长时间运行是否稳定（不再卡死）
- 大量输出是否正常（如 `find /`）

## 相关文件路径
- 简化方案：`.specs/ssh-terminal-optimization/simplification-plan.md`
- 前端WebTerminal组件：`frontend/src/components/ssh/WebTerminal.tsx`
- 后端SSH控制器：`backend/controllers/ssh_controller.go`
- 需要删除的文件：
  - `frontend/src/utils/InputAggregator.ts`
  - `frontend/src/utils/TerminalWriter.ts`
  - `backend/utils/output_buffer.go`

## 特别提醒
1. **先实现功能，再考虑性能**
2. **宁可慢一点，也要稳定可靠**
3. **每次改动要小，充分测试后再继续**
4. **相信TCP和WebSocket的流控能力**

请帮我实施这个简化方案，让SSH终端回归简单、稳定、可靠。