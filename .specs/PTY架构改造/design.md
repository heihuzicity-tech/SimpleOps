# PTY架构改造 - 技术设计

## 概述
本设计文档详细描述了如何将现有的WebSocket SSH代理架构改造为基于PTY（伪终端）的架构。新架构将在服务器端创建真实的Shell进程，通过PTY完全控制命令执行，从根本上解决命令拦截被绕过的问题。

## 现有架构分析

### 当前架构
```
用户浏览器 ←→ WebSocket ←→ SSHController ←→ SSH Client ←→ 目标服务器
                                  ↓
                           命令缓冲区（仅跟踪输入）
```

### 存在的问题
1. 命令缓冲区只能捕获键盘输入流
2. 历史命令通过SSH输出流返回，绕过了输入检查
3. 依赖终端协议解析，复杂且不可靠
4. 无法控制Shell环境和行为

### 相关模块分析
- `SSHController`: 处理WebSocket连接和SSH会话
- `SSHService`: 管理SSH连接和会话状态
- `CommandMatcherService`: 命令过滤匹配逻辑
- `RecordingService`: 会话录制功能

## 新架构设计

### 系统架构
```
用户浏览器 ←→ WebSocket ←→ PTYController ←→ PTY Master ←→ PTY Slave ←→ Shell进程
                                  ↓                 ↓
                           SessionManager    CommandInterceptor
                                  ↓                 ↓
                            AuditLogger      SecurityFilter
```

### 核心组件关系
```go
// 组件依赖关系
PTYController
    ├── PTYManager          // PTY生命周期管理
    ├── SessionManager      // 会话状态管理
    ├── CommandInterceptor  // 命令拦截和过滤
    ├── TerminalRecorder    // 会话录制
    └── EnvironmentManager  // 环境变量控制
```

## 核心组件设计

### 组件 1: PTYManager（PTY管理器）
- **职责**: 创建和管理PTY主从对，处理PTY相关的系统调用
- **位置**: `/backend/services/pty_manager.go`
- **接口设计**:

```go
type PTYManager struct {
    sessions map[string]*PTYSession
    mu       sync.RWMutex
}

type PTYSession struct {
    ID       string
    Master   *os.File      // PTY主设备
    Slave    *os.File      // PTY从设备
    Shell    *exec.Cmd     // Shell进程
    Size     *pty.Winsize  // 终端窗口大小
    Env      []string      // 环境变量
    Created  time.Time
}

// 核心方法
func (m *PTYManager) CreateSession(config *PTYConfig) (*PTYSession, error)
func (m *PTYManager) ResizeSession(sessionID string, rows, cols uint16) error
func (m *PTYManager) CloseSession(sessionID string) error
func (m *PTYManager) GetSession(sessionID string) (*PTYSession, error)
```

### 组件 2: PTYController（PTY控制器）
- **职责**: 替代现有的SSHController，处理WebSocket连接
- **位置**: `/backend/controllers/pty_controller.go`
- **接口设计**:

```go
type PTYController struct {
    ptyManager         *PTYManager
    sessionManager     *services.SessionManager
    commandInterceptor *CommandInterceptor
    recorder           *TerminalRecorder
    upgrader           websocket.Upgrader
}

// WebSocket处理
func (c *PTYController) HandleWebSocket(ctx *gin.Context)
func (c *PTYController) handleInput(session *PTYSession, data []byte) error
func (c *PTYController) handleOutput(session *PTYSession, ws *websocket.Conn)
```

### 组件 3: CommandInterceptor（命令拦截器）
- **职责**: 在PTY层面拦截和过滤命令
- **位置**: `/backend/services/command_interceptor.go`
- **接口设计**:

```go
type CommandInterceptor struct {
    filterService  *CommandFilterService
    matcherService *CommandMatcherService
    auditLogger    *AuditLogger
}

type InterceptContext struct {
    SessionID   string
    UserID      uint
    AssetID     uint
    Command     string
    Environment map[string]string
}

func (i *CommandInterceptor) InterceptCommand(ctx *InterceptContext) (allow bool, err error)
func (i *CommandInterceptor) PreProcessInput(input []byte) []byte
func (i *CommandInterceptor) PostProcessOutput(output []byte) []byte
```

### 组件 4: TerminalRecorder（终端录制器）
- **职责**: 记录终端会话，支持回放
- **位置**: `/backend/services/terminal_recorder.go`
- **接口设计**:

```go
type TerminalRecorder struct {
    storage RecordStorage
    buffer  *CircularBuffer
}

type RecordFrame struct {
    Timestamp time.Time
    Type      FrameType // Input/Output/Resize
    Data      []byte
}

func (r *TerminalRecorder) StartRecording(sessionID string) error
func (r *TerminalRecorder) RecordFrame(frame *RecordFrame) error
func (r *TerminalRecorder) StopRecording(sessionID string) (*RecordFile, error)
```

### 组件 5: EnvironmentManager（环境管理器）
- **职责**: 控制Shell环境变量和初始设置
- **位置**: `/backend/services/environment_manager.go`
- **接口设计**:

```go
type EnvironmentManager struct {
    baseEnv   []string
    blacklist []string
}

func (e *EnvironmentManager) PrepareEnvironment(user *User, asset *Asset) []string
func (e *EnvironmentManager) SanitizeEnvironment(env []string) []string
func (e *EnvironmentManager) InjectAuditVariables(env []string, sessionID string) []string
```

## 数据流设计

### 输入数据流
```
1. WebSocket接收用户输入
2. CommandInterceptor预处理输入
3. 写入PTY Master
4. Shell进程从PTY Slave读取
5. Shell执行命令或更新显示
```

### 输出数据流
```
1. Shell进程输出到PTY Slave
2. PTY Master读取输出
3. CommandInterceptor后处理输出
4. TerminalRecorder记录数据
5. WebSocket发送到用户
```

### 命令拦截流程
```go
func (c *PTYController) processCommand(session *PTYSession, input []byte) error {
    // 1. 构建拦截上下文
    ctx := &InterceptContext{
        SessionID: session.ID,
        UserID:    session.UserID,
        Command:   extractCommand(input),
    }
    
    // 2. 执行拦截检查
    allow, err := c.commandInterceptor.InterceptCommand(ctx)
    if err != nil {
        return err
    }
    
    // 3. 处理拦截结果
    if !allow {
        // 发送Ctrl+C中断命令
        session.Master.Write([]byte{0x03})
        // 显示拦截消息
        msg := fmt.Sprintf("\r\n\033[31m命令被拦截: %s\033[0m\r\n", ctx.Command)
        session.Master.Write([]byte(msg))
        return nil
    }
    
    // 4. 允许执行，写入PTY
    return session.Master.Write(input)
}
```

## 关键算法设计

### 命令提取算法
```go
type CommandExtractor struct {
    buffer      []byte
    lineBuffer  []byte
    promptRegex *regexp.Regexp
}

func (e *CommandExtractor) ExtractCommand(data []byte) (string, bool) {
    e.buffer = append(e.buffer, data...)
    
    // 检测回车键
    if bytes.Contains(data, []byte{'\r'}) || bytes.Contains(data, []byte{'\n'}) {
        // 从缓冲区提取当前行
        lines := bytes.Split(e.buffer, []byte{'\n'})
        if len(lines) > 0 {
            lastLine := lines[len(lines)-1]
            // 移除提示符
            command := e.removePrompt(lastLine)
            return string(command), true
        }
    }
    
    return "", false
}
```

### PTY信号处理
```go
func (m *PTYManager) handleSignals(session *PTYSession) {
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGWINCH, syscall.SIGTERM)
    
    for sig := range sigCh {
        switch sig {
        case syscall.SIGWINCH:
            // 处理窗口大小变化
            m.handleWindowResize(session)
        case syscall.SIGTERM:
            // 优雅关闭
            m.CloseSession(session.ID)
            return
        }
    }
}
```

## API设计

### WebSocket协议
```typescript
// 输入消息
interface InputMessage {
    type: "input" | "resize" | "ping";
    data?: string;
    rows?: number;
    cols?: number;
}

// 输出消息
interface OutputMessage {
    type: "output" | "error" | "close";
    data: string;
    timestamp: number;
}
```

### REST API变更
```yaml
# 新增接口
POST   /api/pty/sessions      # 创建PTY会话
DELETE /api/pty/sessions/{id} # 关闭PTY会话
GET    /api/pty/sessions/{id} # 获取会话信息

# 修改接口
GET    /api/sessions          # 返回PTY会话信息
GET    /api/recordings/{id}   # 支持PTY录制格式
```

## 数据模型变更

### 数据库变更
```sql
-- 修改 session_records 表
ALTER TABLE session_records 
ADD COLUMN pty_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN shell_type VARCHAR(50),
ADD COLUMN environment TEXT;

-- 新增 pty_events 表
CREATE TABLE pty_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id)
);
```

## 错误处理策略

### PTY创建失败
- 回退到SSH代理模式（如果可能）
- 记录详细错误日志
- 返回用户友好的错误信息

### Shell进程异常退出
- 自动清理PTY资源
- 更新会话状态
- 通知前端关闭连接

### 命令拦截异常
- 默认拒绝策略
- 记录安全事件
- 触发告警通知

## 性能优化设计

### 缓冲区优化
```go
type BufferPool struct {
    pool sync.Pool
}

func (p *BufferPool) Get() *bytes.Buffer {
    if buf := p.pool.Get(); buf != nil {
        return buf.(*bytes.Buffer)
    }
    return bytes.NewBuffer(make([]byte, 0, 4096))
}
```

### 并发处理
- 每个PTY会话独立goroutine
- 使用channel进行数据传递
- 避免锁竞争

### 资源限制
- 限制最大并发PTY数量
- 设置Shell进程资源限制
- 实现会话超时机制

## 安全考虑

### 权限隔离
```go
// 降低Shell进程权限
cmd.SysProcAttr = &syscall.SysProcAttr{
    Credential: &syscall.Credential{
        Uid: uint32(uid),
        Gid: uint32(gid),
    },
}
```

### 命令注入防护
- 严格验证所有输入
- 使用白名单机制
- 转义特殊字符

### 审计完整性
- 所有操作记录审计日志
- 使用哈希链保证不可篡改
- 实时同步到远程存储

## 兼容性设计

### 前端兼容
- 保持WebSocket协议兼容
- 支持现有的终端组件
- 提供迁移指南

### 功能兼容
- 支持现有的命令过滤规则
- 保持审计日志格式
- 兼容会话管理接口

## 测试策略

### 单元测试
- PTY创建和管理
- 命令提取算法
- 信号处理逻辑

### 集成测试
- 完整的会话流程
- 命令拦截功能
- 录制回放功能

### 性能测试
- 并发会话压力测试
- 长时间运行稳定性
- 资源使用监控

## 部署架构

### 容器化部署
```dockerfile
FROM golang:1.21-alpine AS builder
# 构建阶段

FROM alpine:latest
# 需要安装bash等Shell
RUN apk add --no-cache bash zsh
# 运行阶段
```

### 配置管理
```yaml
pty:
  enabled: true
  shell: /bin/bash
  max_sessions: 1000
  buffer_size: 4096
  timeout: 3600
  environment:
    - TERM=xterm-256color
    - LANG=en_US.UTF-8
```

## 迁移计划

### 第一阶段：基础实现
1. 实现PTYManager核心功能
2. 创建简单的PTYController
3. 基础命令拦截功能
4. 单元测试覆盖

### 第二阶段：功能完善
1. 实现完整的命令拦截器
2. 添加会话录制功能
3. 环境变量管理
4. 集成测试

### 第三阶段：切换部署
1. 灰度发布
2. 性能监控
3. 问题修复
4. 全量切换