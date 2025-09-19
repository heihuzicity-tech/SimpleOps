# 修复命令拦截问题 - 技术设计

## 概述
基于业界最佳实践和现有代码分析，本设计采用"增强型输出流解析"方案，通过维护终端状态来跟踪当前命令行内容，确保所有命令（包括历史命令）都能被正确拦截。

## 现有代码分析

### 相关模块
- **SSHController** (`/backend/controllers/ssh_controller.go`): WebSocket和SSH会话管理
- **命令缓冲区管理**: 只跟踪键盘输入，不处理终端输出
- **命令匹配服务**: (`/backend/services/command_matcher_service.go`): 命令过滤逻辑

### 依赖分析
- `github.com/gorilla/websocket`: WebSocket通信
- `gorm.io/gorm`: 数据库操作
- 内部服务: SSHService, CommandFilterService, CommandMatcherService

## 架构设计

### 系统架构
```
用户终端 ←→ WebSocket ←→ SSHController ←→ SSH会话 ←→ 目标服务器
                              ↓
                      终端状态跟踪器(新增)
                              ↓
                        命令拦截检查
```

### 模块划分
- **终端状态跟踪器**: 解析输出流，维护当前命令行状态
- **增强型命令缓冲区**: 结合输入流和输出流信息
- **命令拦截器**: 在回车时进行安全检查

## 核心组件设计

### 组件 1: TerminalState（终端状态跟踪器）
- **责任**: 跟踪终端当前行内容和光标位置
- **位置**: `/backend/controllers/terminal_state.go`（新建）
- **接口设计**:
```go
type TerminalState struct {
    currentLine    []byte          // 当前行内容
    cursorPos      int             // 光标在当前行的位置
    promptDetected bool            // 是否检测到命令提示符
    lastPrompt     string          // 最后检测到的提示符
    escapeBuffer   []byte          // ANSI转义序列缓冲区
    inEscapeSeq    bool            // 是否正在处理转义序列
}

func (ts *TerminalState) ProcessOutput(data []byte) error
func (ts *TerminalState) GetCurrentCommand() string
func (ts *TerminalState) Reset()
```

### 组件 2: 增强的SSHController
- **责任**: 集成终端状态跟踪，协调命令拦截
- **位置**: `/backend/controllers/ssh_controller.go`（修改）
- **主要改动**:
  - 添加 `terminalStates map[string]*TerminalState`
  - 在 `handleSSHOutput` 中调用终端状态更新
  - 修改命令检查逻辑，优先使用终端状态

### 组件 3: ANSI解析器
- **责任**: 解析终端控制序列
- **位置**: 作为 TerminalState 的内部方法
- **支持的序列**:
  - 光标移动: `\x1b[nC` (右移), `\x1b[nD` (左移)
  - 删除操作: `\x1b[K` (删除到行尾)
  - 光标定位: `\x1b[n;mH`
  - 颜色和样式（忽略，不影响内容）

## 数据模型设计

### 核心数据结构
```go
// 终端输出解析状态机
type OutputParserState int

const (
    StateNormal OutputParserState = iota
    StateEscape                   // ESC字符后
    StateCSI                      // ESC[后
    StateOSC                      // ESC]后
)

// 命令提示符模式
type PromptPattern struct {
    Pattern *regexp.Regexp
    Type    string // "bash", "zsh", "custom"
}
```

## API设计

### 内部接口变更
```go
// SSHController 新增方法
func (sc *SSHController) getTerminalState(sessionID string) *TerminalState
func (sc *SSHController) updateTerminalState(sessionID string, output []byte)
func (sc *SSHController) getEffectiveCommand(sessionID string) string
```

## 文件修改计划

### 新建文件
- `/backend/controllers/terminal_state.go` - 终端状态跟踪实现
- `/backend/controllers/terminal_state_test.go` - 单元测试

### 修改文件
- `/backend/controllers/ssh_controller.go`:
  - 添加 terminalStates 字段
  - 修改 handleSSHOutput 方法
  - 修改 handleWebSocketInput 中的命令检查逻辑
  - 添加终端状态管理方法

## 实现细节

### 1. 终端输出处理流程
```go
func (sc *SSHController) handleSSHOutput(ctx context.Context, wsConn *WebSocketConnection) {
    // ... 现有代码 ...
    
    // 新增：处理输出数据
    outputData := string(data)
    
    // 更新终端状态
    sc.updateTerminalState(wsConn.sessionID, data)
    
    // ... 继续现有逻辑 ...
}
```

### 2. 命令检查增强
```go
func (sc *SSHController) handleWebSocketInput(ctx context.Context, wsConn *WebSocketConnection) {
    // ... 现有代码 ...
    
    if sc.isCommandInput(inputData) {
        // 获取命令：优先使用终端状态，其次使用输入缓冲区
        command := sc.getEffectiveCommand(wsConn.sessionID)
        
        if command != "" {
            // ... 执行命令检查 ...
        }
    }
}
```

### 3. 终端状态解析算法
```go
func (ts *TerminalState) ProcessOutput(data []byte) error {
    for i := 0; i < len(data); i++ {
        b := data[i]
        
        if ts.inEscapeSeq {
            // 处理转义序列
            ts.processEscapeSequence(b)
            continue
        }
        
        switch b {
        case '\x1b': // ESC
            ts.inEscapeSeq = true
            ts.escapeBuffer = []byte{b}
        case '\r', '\n': // 回车换行
            ts.handleNewLine()
        case '\b', 0x7f: // 退格
            ts.handleBackspace()
        default:
            if b >= 32 && b < 127 { // 可打印字符
                ts.insertChar(b)
            }
        }
    }
    return nil
}
```

## 错误处理策略

### 解析错误
- 遇到未知的转义序列：记录日志，忽略该序列
- 状态不一致：重置终端状态，继续处理

### 性能问题
- 输出数据过大：分批处理，避免阻塞
- 内存占用：限制currentLine最大长度（如4KB）

### 降级策略
- 如果终端状态解析失败，回退到仅使用输入缓冲区
- 提供配置开关，可以禁用终端状态跟踪

## 性能与安全考虑

### 性能目标
- 处理延迟：< 10ms（每次输出）
- 内存占用：每个会话 < 1MB
- CPU占用：增量 < 2%

### 安全控制
- 防止缓冲区溢出：限制行长度
- 防止正则表达式DoS：使用简单模式匹配
- 审计日志：记录所有拦截事件

## 测试策略

### 单元测试
- 测试各种ANSI转义序列解析
- 测试命令提示符识别
- 测试光标移动和编辑操作

### 集成测试
- 测试手动输入命令
- 测试历史命令（上下键）
- 测试Tab补全
- 测试多行命令

### 测试用例
```bash
# 场景1: 历史命令
$ rm -rf /tmp/test  # 手动输入，应被拦截
$ ↑                 # 按上键调出历史，应被拦截

# 场景2: 编辑命令
$ echo test
$ ↑                 # 调出 echo test
$ ←←←←              # 移动光标
$ rm -rf            # 修改为危险命令，应被拦截

# 场景3: Tab补全
$ rm[TAB]           # 补全命令，应被正确识别
```

## 实施计划

### 第一阶段：基础实现（Day 1）
1. 实现 TerminalState 基础结构
2. 实现基本的输出解析（支持普通字符、退格、回车）
3. 集成到 SSHController
4. 基础测试

### 第二阶段：完善功能（Day 2）
1. 实现 ANSI 转义序列解析
2. 支持光标移动和行编辑
3. 优化命令提示符识别
4. 完整测试

### 第三阶段：优化和文档（Day 3）
1. 性能优化
2. 边界情况处理
3. 更新文档
4. 部署准备