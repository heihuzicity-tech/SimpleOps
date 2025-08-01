# Shutdown命令导致终端卡死的调试分析

## 问题现象
1. 执行`shutdown`命令后，终端在处理几条命令后卡死
2. `shutdown`命令本身没有被拦截
3. 卡死后终端完全无响应

## 问题分析

### 1. Shutdown命令的特殊性
```bash
[root@web-7 ~]# shutdown 
Shutdown scheduled for Fri 2025-08-01 21:28:54 CST, use 'shutdown -c' to cancel.
[root@web-7 ~]# 
Broadcast message from root@web-7 (Fri 2025-08-01 21:27:54 CST):

The system is going down for power-off at Fri 2025-08-01 21:28:54 CST!
```

特点：
- 产生异步的广播消息
- 消息可能包含特殊控制字符
- 消息可能在任何时候出现（不是命令的直接输出）

### 2. 可能的卡死原因

#### A. 输出处理错误
- WriteToWebSocket失败导致SSH输出处理goroutine退出
- SSH输出不再被读取，导致SSH连接阻塞
- 整个终端卡死

#### B. 特殊字符处理
- 广播消息可能包含特殊的ANSI转义序列
- JSON序列化可能失败
- 前端终端可能无法正确处理

#### C. 并发问题
- 广播消息可能与正常输出交错
- 多个goroutine同时写入可能导致死锁

## 已实施的修复

### 1. 防止goroutine过早退出
```go
if err := wsConn.WriteToWebSocket(message); err != nil {
    log.Printf("Failed to write to WebSocket for session %s: %v", wsConn.sessionID, err)
    // 只有在连接关闭时才退出
    if strings.Contains(err.Error(), "closing") {
        return
    }
    // 对于其他错误继续处理
    continue
}
```

### 2. 改进的错误处理
- Buffer满时不退出处理循环
- 继续读取SSH输出避免阻塞

## 进一步的调试步骤

### 1. 检查后端日志
查找以下信息：
```bash
grep -E "(WARNING|ERROR|Failed to write)" backend.log
grep "shutdown" backend.log
grep "buffer full" backend.log
```

### 2. 监控WebSocket状态
```bash
# 查看连接状态
netstat -an | grep 8080

# 查看goroutine数量
curl http://localhost:6060/debug/pprof/goroutine
```

### 3. 测试其他产生广播消息的命令
```bash
# 这些命令也会产生系统广播
wall "test message"
shutdown -r +5
systemctl restart network
```

## 建议的永久解决方案

### 1. 实现更智能的流控制
```go
// 当输出过快时，暂时停止读取SSH
if len(wsConn.writeChan) > 900 {
    time.Sleep(10 * time.Millisecond)
}
```

### 2. 过滤或转换特殊输出
```go
// 检测并处理广播消息
if strings.Contains(outputData, "Broadcast message") {
    // 特殊处理
}
```

### 3. 实现命令白名单
- 只允许执行安全的命令
- 完全禁止shutdown类命令

### 4. 增加熔断机制
- 检测到异常时自动重置连接
- 避免永久卡死

## 测试验证

1. 重新编译并部署后端
2. 执行shutdown命令并观察日志
3. 测试其他系统命令
4. 长时间运行测试