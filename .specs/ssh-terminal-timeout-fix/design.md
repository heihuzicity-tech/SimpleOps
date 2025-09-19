# SSH终端超时修复 - 技术设计

## 概述
本设计文档描述了如何修复SSH终端WebSocket超时问题，确保业务层的动态超时配置能够正常工作，并优化终端滚动性能。

## 现有代码分析

### 问题根源
1. **WebSocket硬超时**：ssh_controller.go第279和281行设置了60秒的ReadDeadline
2. **心跳机制未重置超时**：虽然有30秒心跳，但未重置ReadDeadline
3. **滚动性能**：scrollback设置为1000行，可能导致大量数据时性能下降

### 相关模块
- `controllers/ssh_controller.go`: WebSocket连接管理
- `services/session_timeout_service.go`: 业务层超时管理
- `models/session_timeout.go`: 超时配置模型
- `frontend/src/components/ssh/WebTerminal.tsx`: 前端终端组件

## 修改方案

### 核心改动
1. **删除WebSocket硬超时** - 移除导致问题的60秒超时
2. **优化终端滚动性能** - 调整配置减少卡顿

### 超时机制设计
```
1. WebSocket层：完全移除ReadDeadline设置
2. 应用层心跳：30秒ping/pong，仅用于检测连接健康
3. 业务层超时：由现有的SessionTimeoutService管理，根据用户选择动态设置
```

## 核心组件设计

### 1. WebSocket连接管理改进
移除硬编码的ReadDeadline，完全依赖现有的超时服务：

```go
// ssh_controller.go - handleWebSocketConnection
func (sc *SSHController) handleWebSocketConnection(wsConn *WebSocketConnection) {
    // 删除这两行：
    // wsConn.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    // wsConn.conn.SetPongHandler(func(string) error {
    //     wsConn.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    //     return nil
    // })
    
    // 只保留消息大小限制
    wsConn.conn.SetReadLimit(512 * 1024)
    
    // 保留现有的心跳检测（但不设置超时）
    go sc.handleWebSocketPing(wsConn)
    
    // SessionTimeoutService已经在管理超时，无需额外监控
}
```

### 2. 利用现有的超时管理
SessionTimeoutService已经在后台运行并管理所有会话的超时：

```go
// services/session_timeout_service.go 已有的功能
// - 定期检查所有会话是否超时
// - 超时时调用回调函数关闭会话
// - 支持fixed、idle_kick、unlimited三种策略
// 无需修改，继续使用现有实现
```

### 3. 前端终端性能优化
调整三个配置参数：

```typescript
// WebTerminal.tsx 第73、83、63行
scrollback: 200,  // 从1000减少到200行，大幅提升滚动性能
smoothScrollDuration: 0,  // 从125改为0，关闭平滑滚动
cursorBlink: false,  // 从true改为false，减少重绘
```

## 数据模型设计
现有的SessionTimeout模型已经支持动态超时配置，无需修改。

## API设计
无需新增API，现有的超时管理API已经满足需求。

## 文件修改计划

### 需要修改的文件
1. `backend/controllers/ssh_controller.go`
   - 删除SetReadDeadline调用（第279行）
   - 删除PongHandler定义（第280-283行）

2. `frontend/src/components/ssh/WebTerminal.tsx`
   - 减少scrollback从1000到200行
   - 设置smoothScrollDuration为0
   - 关闭cursorBlink

### 新增文件
无需新增文件

## 测试验证
1. 设置不同超时时间，验证连接保持正确
2. 大量输出时测试滚动流畅度
3. 长时间闲置测试，确认不会意外断开