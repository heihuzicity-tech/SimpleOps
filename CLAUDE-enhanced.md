# Bastion 项目开发指南 (增强版)

## 基础信息

### 语言要求
- 所有对话请使用中文
- 代码注释使用中文
- 文档和说明使用中文

### 项目概述
- **项目名称**: Bastion 运维堡垒机系统
- **项目类型**: 企业级运维堡垒机，提供SSH代理、用户管理、权限控制、审计日志
- **技术栈**: Go + React + TypeScript + Docker + MySQL + Redis
- **架构模式**: 前后端分离，微服务架构，Docker容器化部署

## 技术架构

### 后端架构 (Go)
- **框架**: Gin Web Framework
- **数据库**: MySQL (主) + Redis (缓存/会话)
- **认证**: JWT Token + 基于角色的权限控制(RBAC)
- **核心服务**:
  - auth_service: 用户认证和授权
  - ssh_service: SSH连接代理和管理
  - audit_service: 操作审计和日志记录
  - websocket_service: 实时通信服务
  - monitor_service: 系统监控服务

### 前端架构 (React + TypeScript)
- **框架**: React 18 + TypeScript
- **状态管理**: Context API + useReducer
- **UI组件**: Ant Design
- **WebSSH**: xterm.js + WebSocket

### 数据库设计
- **用户表**: users (id, username, password, role_id, created_at)
- **角色表**: roles (id, name, permissions, created_at)
- **资产表**: assets (id, name, host, port, user_id, created_at)
- **审计表**: audit_logs (id, user_id, asset_id, action, content, created_at)
- **会话表**: sessions (id, user_id, asset_id, status, start_time, end_time)

## 服务管理

### 重要规则
- **始终使用 `./manage.sh` 脚本来管理服务**
- 不要直接使用 docker 或 docker-compose 命令

### 可用命令
- `./manage.sh start` - 启动所有服务
- `./manage.sh stop` - 停止所有服务
- `./manage.sh restart` - 重启所有服务
- `./manage.sh status` - 查看服务状态
- `./manage.sh logs [service]` - 查看日志
- `./manage.sh build` - 构建服务

### 服务端口配置
- 前端: http://localhost:3000
- 后端API: http://localhost:8080
- MySQL: 10.0.0.7:3306
- Redis: 10.0.0.7:6379

## 开发规范

### 代码规范
- Go代码使用gofmt格式化
- TypeScript使用ESLint + Prettier
- Git提交信息使用中文，格式: `类型: 描述`
- 函数和变量命名使用中文注释说明

### 开发流程
1. 修改代码后使用 `./manage.sh restart` 重启相关服务
2. 查看日志时使用 `./manage.sh logs` 命令
3. 遇到问题时先检查服务状态：`./manage.sh status`
4. 提交前确保所有服务正常运行

## 核心业务逻辑

### 用户认证流程
1. 用户登录 → 验证用户名密码 → 生成JWT Token
2. 前端存储Token → 后续请求携带Token
3. 后端中间件验证Token → 获取用户信息和权限

### SSH连接流程
1. 用户选择目标服务器 → 验证访问权限
2. 建立WebSocket连接 → 后端创建SSH客户端
3. 建立SSH连接 → 代理用户输入输出
4. 记录会话日志 → 审计用户操作

### 权限控制机制
- 基于角色的访问控制(RBAC)
- 角色类型: 管理员、运维、开发、只读
- 权限控制: 服务器访问、功能使用、数据查看

## 常见问题解决方案

### 1. 会话重复记录问题
**症状**: 创建一个会话，审计日志显示多条相同记录
**原因**: WebSocket重连或前端重复调用API
**解决**: 检查会话创建逻辑，添加幂等性控制

### 2. SSH连接失败
**症状**: 连接超时或认证失败
**原因**: 网络问题、SSH密钥配置、防火墙
**解决**: 验证网络连通性、检查SSH配置、确认密钥权限

### 3. 高并发性能问题
**症状**: 多用户同时连接时出现卡顿
**原因**: 数据库连接池、WebSocket管理、内存使用
**解决**: 优化连接池配置、改进WebSocket管理、添加缓存

## SuperClaude指令集成

### 项目特定指令前缀
所有指令都应该包含项目上下文信息：
```
【项目】Bastion运维堡垒机系统
【技术栈】Go + React + TypeScript + Docker + MySQL + Redis
【架构】前后端分离，微服务架构
【管理】必须使用./manage.sh脚本管理服务
```

### 常用指令模板
```
/troubleshoot --prod --five-whys --persona-backend

【项目】Bastion运维堡垒机系统
【问题】具体问题描述
【症状】具体现象
【影响】对系统的影响
【约束】必须使用./manage.sh管理服务，保持Docker架构
```

## 测试和部署

### 测试命令
- 后端测试: `cd backend && go test ./...`
- 前端测试: `cd frontend && npm test`
- 集成测试: `./manage.sh test`

### 部署流程
1. 构建镜像: `./manage.sh build`
2. 启动服务: `./manage.sh start`
3. 验证服务: `./manage.sh status`
4. 查看日志: `./manage.sh logs`

## 数据库连接信息
- MySQL: `mysql -uroot -ppassword -h10.0.0.7`
- Redis: `redis-cli -h 10.0.0.7`

## 关键文件路径
- 后端入口: `backend/main.go`
- 前端入口: `frontend/src/App.tsx`
- 数据库配置: `backend/config/config.go`
- 路由配置: `backend/routers/router.go`
- 服务管理: `./manage.sh`

## 更新记录
- 2025-07-14: 创建增强版CLAUDE.md，添加完整项目上下文
- 待更新: 根据开发进展持续更新业务逻辑和解决方案