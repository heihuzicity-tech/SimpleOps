# SSH终端性能优化 - 技术设计

## 概述
基于需求分析中发现的长时间使用后性能退化问题，本设计方案重点解决内存泄漏、资源累积和通信效率三大核心问题，确保SSH终端能够长时间（8小时+）稳定流畅运行。

## 现有代码分析
### 相关模块
- **前端终端组件**：`frontend/src/components/ssh/WebTerminal.tsx` - WebSocket终端实现
- **工作区终端**：`frontend/src/components/workspace/WorkspaceTerminal.tsx` - 工作区集成终端
- **后端SSH控制器**：`backend/controllers/ssh_controller.go` - SSH会话管理和WebSocket处理
- **SSH服务层**：`backend/services/ssh_service.go` - SSH连接和会话管理
- **WebSocket服务**：`backend/services/websocket_service.go` - WebSocket连接管理

### 关键问题定位
1. **命令缓冲区无限增长**（ssh_controller.go:L890）
   ```go
   sc.cmdBuffer[sessionID] += input  // 无长度限制
   ```

2. **Goroutine泄漏**（ssh_service.go:L523）
   ```go
   go func() {
       if err := sessionConn.Wait(); err != nil {
           // 长时间阻塞，可能导致goroutine累积
       }
   }()
   ```

3. **无批处理机制**（WebTerminal.tsx:L94）
   ```typescript
   terminal.current.onData((data) => {
       websocket.current.send(JSON.stringify(message)); // 每个字符单独发送
   });
   ```

## 架构设计
### 系统架构优化
```
┌─────────────────┐     批量消息      ┌─────────────────┐
│   前端终端      │ ◄─────────────────► │   WebSocket     │
│  (xterm.js)     │                     │    Handler      │
└────────┬────────┘                     └────────┬────────┘
         │                                       │
    输入聚合器                              消息队列
         │                                       │
┌────────▼────────┐                     ┌────────▼────────┐
│  Input Buffer   │                     │  Output Buffer  │
│   (50ms批处理)  │                     │  (批量发送)     │
└─────────────────┘                     └─────────────────┘
```

### 核心优化策略
1. **内存管理**：实现有界缓冲区和资源池
2. **批处理机制**：输入输出数据聚合发送
3. **资源生命周期管理**：统一管理goroutine和定时器

## 核心组件设计
### 1. 输入聚合器（前端）
```typescript
class InputAggregator {
  private buffer: string[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly maxDelay = 50; // 最大延迟50ms
  private readonly maxBufferSize = 100; // 最大缓冲100个字符
  
  constructor(private onFlush: (data: string) => void) {}
  
  add(data: string): void {
    this.buffer.push(data);
    
    // 特殊字符立即发送
    if (this.isSpecialChar(data)) {
      this.flush();
      return;
    }
    
    // 缓冲区满立即发送
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
      return;
    }
    
    // 设置延迟发送
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxDelay);
    }
  }
  
  private flush(): void {
    if (this.buffer.length === 0) return;
    
    const data = this.buffer.join('');
    this.buffer = [];
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    this.onFlush(data);
  }
  
  private isSpecialChar(data: string): boolean {
    // Ctrl+C, Ctrl+D, Enter等特殊字符
    return ['\x03', '\x04', '\r', '\n'].includes(data);
  }
  
  destroy(): void {
    this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}
```

### 2. 输出缓冲器（后端）
```go
type OutputBuffer struct {
    mu          sync.Mutex
    buffer      [][]byte
    size        int
    maxSize     int
    maxDelay    time.Duration
    flushTimer  *time.Timer
    flushFunc   func([][]byte)
}

func NewOutputBuffer(maxSize int, maxDelay time.Duration, flushFunc func([][]byte)) *OutputBuffer {
    return &OutputBuffer{
        buffer:    make([][]byte, 0, 100),
        maxSize:   maxSize,
        maxDelay:  maxDelay,
        flushFunc: flushFunc,
    }
}

func (ob *OutputBuffer) Add(data []byte) {
    ob.mu.Lock()
    defer ob.mu.Unlock()
    
    ob.buffer = append(ob.buffer, data)
    ob.size += len(data)
    
    // 缓冲区满，立即刷新
    if ob.size >= ob.maxSize {
        ob.flushLocked()
        return
    }
    
    // 设置延迟刷新
    if ob.flushTimer == nil {
        ob.flushTimer = time.AfterFunc(ob.maxDelay, func() {
            ob.mu.Lock()
            defer ob.mu.Unlock()
            ob.flushLocked()
        })
    }
}

func (ob *OutputBuffer) flushLocked() {
    if len(ob.buffer) == 0 {
        return
    }
    
    // 发送缓冲数据
    ob.flushFunc(ob.buffer)
    
    // 重置缓冲区
    ob.buffer = ob.buffer[:0]
    ob.size = 0
    
    if ob.flushTimer != nil {
        ob.flushTimer.Stop()
        ob.flushTimer = nil
    }
}
```

### 3. 命令缓冲区优化（后端）
```go
const MaxCommandBufferSize = 4096 // 4KB限制

type CommandBuffer struct {
    mu       sync.RWMutex
    buffers  map[string]*CircularBuffer
}

type CircularBuffer struct {
    data     []byte
    capacity int
    start    int
    end      int
    size     int
}

func (cb *CommandBuffer) Append(sessionID, input string) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    buffer, ok := cb.buffers[sessionID]
    if !ok {
        buffer = NewCircularBuffer(MaxCommandBufferSize)
        cb.buffers[sessionID] = buffer
    }
    
    buffer.Write([]byte(input))
}

func (cb *CircularBuffer) Write(data []byte) {
    for _, b := range data {
        if cb.size == cb.capacity {
            // 缓冲区满，覆盖最旧的数据
            cb.start = (cb.start + 1) % cb.capacity
            cb.size--
        }
        cb.data[cb.end] = b
        cb.end = (cb.end + 1) % cb.capacity
        cb.size++
    }
}
```

### 4. 资源生命周期管理器
```go
type SessionResourceManager struct {
    mu              sync.RWMutex
    sessions        map[string]*SessionResources
    cleanupTicker   *time.Ticker
}

type SessionResources struct {
    SessionID       string
    Goroutines      []context.CancelFunc
    Timers          []*time.Timer
    OutputBuffer    *OutputBuffer
    CommandBuffer   *CircularBuffer
    CreatedAt       time.Time
    LastActivityAt  time.Time
}

func (srm *SessionResourceManager) RegisterSession(sessionID string) *SessionResources {
    srm.mu.Lock()
    defer srm.mu.Unlock()
    
    resources := &SessionResources{
        SessionID:      sessionID,
        Goroutines:     make([]context.CancelFunc, 0),
        Timers:         make([]*time.Timer, 0),
        CreatedAt:      time.Now(),
        LastActivityAt: time.Now(),
    }
    
    srm.sessions[sessionID] = resources
    return resources
}

func (srm *SessionResourceManager) CleanupSession(sessionID string) {
    srm.mu.Lock()
    defer srm.mu.Unlock()
    
    resources, ok := srm.sessions[sessionID]
    if !ok {
        return
    }
    
    // 取消所有goroutines
    for _, cancel := range resources.Goroutines {
        cancel()
    }
    
    // 停止所有定时器
    for _, timer := range resources.Timers {
        timer.Stop()
    }
    
    // 清理缓冲区
    if resources.OutputBuffer != nil {
        resources.OutputBuffer.Flush()
    }
    
    delete(srm.sessions, sessionID)
}

// 定期清理过期会话
func (srm *SessionResourceManager) StartCleanup() {
    srm.cleanupTicker = time.NewTicker(5 * time.Minute)
    go func() {
        for range srm.cleanupTicker.C {
            srm.cleanupExpiredSessions()
        }
    }()
}
```

### 5. WebSocket优化配置
```go
// 优化WebSocket缓冲区配置
var upgrader = websocket.Upgrader{
    ReadBufferSize:    4096,  // 从1024增加到4096
    WriteBufferSize:   4096,  // 从1024增加到4096
    HandshakeTimeout:  10 * time.Second,
    EnableCompression: true,  // 启用压缩
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}

// 优化WebSocket写入
type OptimizedWSConn struct {
    conn      *websocket.Conn
    writeChan chan []byte
    done      chan struct{}
}

func NewOptimizedWSConn(conn *websocket.Conn) *OptimizedWSConn {
    owc := &OptimizedWSConn{
        conn:      conn,
        writeChan: make(chan []byte, 100), // 带缓冲的channel
        done:      make(chan struct{}),
    }
    
    // 启动写入goroutine，避免锁竞争
    go owc.writeLoop()
    return owc
}

func (owc *OptimizedWSConn) writeLoop() {
    ticker := time.NewTicker(50 * time.Millisecond)
    defer ticker.Stop()
    
    batch := make([][]byte, 0, 10)
    
    for {
        select {
        case data := <-owc.writeChan:
            batch = append(batch, data)
            
            // 尝试收集更多数据
            for len(batch) < 10 {
                select {
                case moreData := <-owc.writeChan:
                    batch = append(batch, moreData)
                default:
                    goto SEND
                }
            }
            
        SEND:
            if len(batch) > 0 {
                owc.sendBatch(batch)
                batch = batch[:0]
            }
            
        case <-ticker.C:
            // 定期刷新
            if len(batch) > 0 {
                owc.sendBatch(batch)
                batch = batch[:0]
            }
            
        case <-owc.done:
            return
        }
    }
}
```

### 6. 前端终端优化配置
```typescript
// 优化xterm.js配置
const terminalConfig = {
  scrollback: 1000,        // 统一设置为1000行
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
  theme: {
    background: '#1f1f1f',
    foreground: '#ffffff',
  },
  // 性能优化选项
  fastScrollModifier: 'ctrl',
  fastScrollSensitivity: 5,
  scrollSensitivity: 3,
  macOptionIsMeta: true,
  // 渲染优化
  rendererType: 'canvas',  // 使用canvas渲染器
  windowOptions: {
    setWinLines: false,
  },
};

// 批量写入优化
class TerminalWriter {
  private writeBuffer: string[] = [];
  private writeTimer: number | null = null;
  private readonly batchDelay = 16; // 约60fps
  
  constructor(private terminal: Terminal) {}
  
  write(data: string): void {
    this.writeBuffer.push(data);
    
    if (!this.writeTimer) {
      this.writeTimer = window.requestAnimationFrame(() => {
        this.flush();
      });
    }
  }
  
  private flush(): void {
    if (this.writeBuffer.length === 0) return;
    
    const data = this.writeBuffer.join('');
    this.writeBuffer = [];
    this.writeTimer = null;
    
    // 使用write方法的批量模式
    this.terminal.write(data);
  }
}
```

## 数据模型设计
### 优化后的消息格式
```typescript
// 批量消息格式
interface BatchWSMessage {
  type: 'batch_input' | 'batch_output' | 'ping' | 'pong';
  messages?: Array<{
    type: string;
    data: string;
    timestamp?: number;
  }>;
  data?: string; // 向后兼容
}
```

## 文件修改计划
### 需要修改的文件
1. **前端文件**
   - `frontend/src/components/ssh/WebTerminal.tsx` - 添加输入聚合器
   - `frontend/src/components/workspace/WorkspaceTerminal.tsx` - 优化终端配置
   - `frontend/src/components/audit/OnlineSessionsTable.tsx` - 修正scrollback配置

2. **后端文件**
   - `backend/controllers/ssh_controller.go` - 实现输出缓冲和命令缓冲优化
   - `backend/services/ssh_service.go` - 添加资源生命周期管理
   - `backend/services/websocket_service.go` - 优化WebSocket配置

### 新增文件
1. `frontend/src/utils/InputAggregator.ts` - 输入聚合器实现
2. `frontend/src/utils/TerminalWriter.ts` - 终端批量写入器
3. `backend/utils/output_buffer.go` - 输出缓冲器实现
4. `backend/utils/session_resources.go` - 会话资源管理器

## 错误处理策略
- 缓冲区溢出：自动刷新并记录警告
- WebSocket断开：保存未发送数据，重连后恢复
- 资源清理失败：记录错误但不影响新会话

## 性能与安全考虑
### 性能目标
- 输入延迟：< 50ms
- 内存使用：单会话 < 20MB（优化后）
- CPU使用：单会话 < 2%（优化后）

### 安全保障
- 命令缓冲区审计：所有命令仍被完整记录
- 批处理不影响安全过滤
- 资源限制防止DoS攻击

## 测试策略
### 性能测试
- 长时间运行测试（8小时+）
- 高频输入测试
- 大量输出测试
- 多会话并发测试

### 功能测试
- 特殊字符处理
- 输入法兼容性
- 断线重连
- 资源清理验证