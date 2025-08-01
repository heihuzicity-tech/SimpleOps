# SSH终端简化架构方案

## 问题总结

当前的性能优化引入了过多的复杂性：
- 多层缓冲和聚合
- 复杂的并发控制
- 容易死锁和阻塞
- 难以调试和维护

## 简化原则

1. **最小化中间层** - 减少数据转换和缓冲
2. **同步优于异步** - 除非必要，避免异步处理
3. **fail-fast** - 快速失败，避免级联问题
4. **简单优于性能** - 先保证正确性，再考虑优化

## 建议的简化方案

### 方案1：直接转发（最简单）

```go
// 输入处理 - 直接转发
func handleInput(ws *websocket.Conn, sshSession *ssh.Session) {
    for {
        var msg Message
        if err := ws.ReadJSON(&msg); err != nil {
            return
        }
        if msg.Type == "input" {
            sshSession.Write([]byte(msg.Data))
        }
    }
}

// 输出处理 - 直接转发
func handleOutput(ws *websocket.Conn, sshSession *ssh.Session) {
    buf := make([]byte, 4096)
    for {
        n, err := sshSession.Read(buf)
        if err != nil {
            return
        }
        ws.WriteJSON(Message{
            Type: "output",
            Data: string(buf[:n]),
        })
    }
}
```

优点：
- 代码简单，易于理解
- 不会死锁
- 错误处理清晰

缺点：
- 性能可能较差
- 网络请求频繁

### 方案2：有限缓冲（平衡方案）

```go
// 使用单一的写入队列，带超时
type TerminalSession struct {
    ws      *websocket.Conn
    ssh     *ssh.Session
    output  chan []byte
    done    chan struct{}
}

func (t *TerminalSession) Start() {
    // 单一的输出处理goroutine
    go t.outputHandler()
    
    // 主循环处理输入
    for {
        var msg Message
        if err := t.ws.ReadJSON(&msg); err != nil {
            close(t.done)
            return
        }
        
        if msg.Type == "input" {
            t.ssh.Write([]byte(msg.Data))
        }
    }
}

func (t *TerminalSession) outputHandler() {
    buf := make([]byte, 4096)
    for {
        n, err := t.ssh.Read(buf)
        if err != nil {
            close(t.done)
            return
        }
        
        // 简单的超时发送
        select {
        case t.output <- buf[:n]:
        case <-time.After(100 * time.Millisecond):
            // 丢弃数据，记录日志
            log.Printf("Output dropped")
        case <-t.done:
            return
        }
    }
}
```

### 方案3：使用成熟的库

考虑使用专门的终端库，如：
- github.com/gliderlabs/ssh
- github.com/kr/pty
- 直接使用SSH的pipe模式

## 性能优化的正确时机

1. **先实现功能** - 确保基本功能正常
2. **测量性能** - 找出真正的瓶颈
3. **针对性优化** - 只优化必要的部分
4. **保持简单** - 优化不应该显著增加复杂性

## 建议的实施步骤

### 第一步：回退到简单实现
1. 移除所有缓冲层
2. 直接转发输入输出
3. 确保功能正常

### 第二步：识别真正的性能问题
1. 测量网络延迟
2. 测量CPU使用
3. 找出瓶颈

### 第三步：针对性优化
1. 如果网络是瓶颈 → 简单的批处理
2. 如果渲染是瓶颈 → 前端优化
3. 如果都不是瓶颈 → 保持简单

## 命令过滤的正确实现

命令过滤应该在更高层次实现：
1. 使用受限的shell（如rbash）
2. 使用SSH的ForceCommand
3. 使用系统级的权限控制
4. 而不是在传输层拦截

## 总结

当前的问题不是某个具体的bug，而是整体设计过于复杂。建议：

1. **暂停所有优化** - 回到最简单的实现
2. **先解决功能问题** - 确保终端稳定工作
3. **重新评估需求** - 是否真的需要这些优化？
4. **逐步改进** - 每次只做一个小改动

记住：**简单是终极的复杂**。一个简单但可靠的系统，远胜于一个复杂但脆弱的系统。