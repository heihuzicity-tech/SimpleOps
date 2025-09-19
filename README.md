# 黑胡子堡垒机系统 (Blackbeard Bastion)

[![Go Version](https://img.shields.io/badge/Go-1.19+-blue.svg)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.0+-blue.svg)](https://ant.design)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🏴‍☠️ 项目简介

黑胡子堡垒机系统是一个现代化的企业级运维安全管理平台，提供全面的服务器访问控制、操作审计和资产管理功能。系统采用前后端分离架构，具备高性能、高安全性和易扩展性。

### ✨ 核心特性

- 🔐 **身份认证与授权** - 基于JWT的安全认证和RBAC权限控制
- 🖥️ **资产管理** - 统一管理服务器、数据库等IT资产
- 🔑 **凭证管理** - 安全的密码和密钥管理
- 🌐 **WebSSH终端** - 浏览器内的SSH终端访问
- 📊 **审计日志** - 全面的操作记录和会话审计
- 🚫 **命令过滤** - 危险命令拦截和权限控制
- 📈 **仪表盘** - 实时监控和统计分析
- 🎯 **会话管理** - 在线会话监控和强制下线

## 🛠️ 技术栈

### 后端技术
- **Go 1.19+** - 高性能后端服务
- **Gin** - Web框架
- **GORM** - ORM框架
- **MySQL 8.0** - 主数据库
- **Redis** - 缓存和会话存储
- **JWT** - 身份认证
- **WebSocket** - 实时通信

### 前端技术
- **React 18** - 前端框架
- **TypeScript 5.0** - 类型安全
- **Ant Design 5.0** - UI组件库
- **Redux Toolkit** - 状态管理
- **Axios** - HTTP客户端
- **Xterm.js** - 终端模拟器

## 📋 功能模块

### ✅ 已完成功能

#### 1. 用户与权限管理
- 用户注册、登录、登出
- 基于角色的权限控制（RBAC）
- 用户管理（增删改查）
- 角色管理（admin、auditor、user）
- 权限动态分配

#### 2. 资产管理
- 服务器资产管理（Linux/Windows）
- 数据库资产管理（MySQL/PostgreSQL）
- 资产分组管理
- 连接状态监控
- 批量操作支持

#### 3. 凭证管理
- 密码凭证管理
- SSH密钥管理
- 凭证与资产关联
- 凭证权限控制

#### 4. SSH连接管理
- WebSSH终端
- 多标签页支持
- 会话录像回放
- 实时会话监控
- 会话超时控制

#### 5. 审计功能
- 操作日志记录
- SSH会话审计
- 命令日志记录
- 录像文件管理
- 审计报表导出

#### 6. 命令过滤
- 危险命令拦截
- 命令组管理
- 黑白名单控制
- 实时拦截通知

#### 7. 仪表盘
- 资产统计
- 用户活跃度
- 会话分析
- 安全事件统计

#### 8. 系统管理
- 系统配置
- 日志管理
- 备份恢复
- 性能监控

## 🚀 快速开始

### 环境要求

- Go 1.19+
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### 后端启动

```bash
# 进入后端目录
cd backend

# 安装依赖
go mod download

# 复制配置文件
cp config/config.example.yaml config/config.yaml

# 修改数据库配置
vim config/config.yaml

# 导入数据库
mysql -u root -p < scripts/init.sql

# 启动服务
go run main.go
```

### 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start

# 访问 http://localhost:3000
```

### 默认账号

- 管理员：admin / Admin@123
- 审计员：auditor / Auditor@123
- 普通用户：user / User@123

## 📁 项目结构

```
bastion/
├── backend/                 # 后端服务
│   ├── config/             # 配置文件
│   ├── controllers/        # 控制器
│   ├── models/             # 数据模型
│   ├── services/           # 业务逻辑
│   ├── middleware/         # 中间件
│   ├── routers/            # 路由
│   ├── utils/              # 工具函数
│   └── main.go            # 入口文件
├── frontend/               # 前端应用
│   ├── public/            # 静态资源
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── services/      # API服务
│   │   ├── store/         # Redux状态
│   │   ├── types/         # TypeScript类型
│   │   └── utils/         # 工具函数
│   └── package.json
├── scripts/                # 数据库脚本
├── recordings/             # 会话录像
└── README.md              # 项目文档
```

## 🔧 配置说明

### 后端配置 (config/config.yaml)

```yaml
app:
  name: "bastion"
  port: 8080
  mode: "release"  # debug, release

database:
  type: "mysql"
  host: "localhost"
  port: 3306
  username: "bastion"
  password: "your-password"
  dbname: "bastion"

redis:
  host: "localhost"
  port: 6379
  password: ""
  db: 0

jwt:
  secret: "your-secret-key"
  expire: 86400  # 24小时

ssh:
  timeout: 3600  # SSH会话超时时间（秒）
  recording: true  # 是否开启录像
```

## 📊 API文档

系统提供完整的RESTful API，主要端点包括：

- `/api/v1/auth/*` - 认证相关
- `/api/v1/users/*` - 用户管理
- `/api/v1/assets/*` - 资产管理
- `/api/v1/credentials/*` - 凭证管理
- `/api/v1/ssh/*` - SSH连接
- `/api/v1/audit/*` - 审计日志
- `/api/v1/dashboard/*` - 仪表盘数据

## 🚧 开发计划

- [ ] 支持更多协议（RDP、VNC、Telnet）
- [ ] 批量命令执行
- [ ] 自动化运维
- [ ] 移动端支持
- [ ] 集成第三方认证（LDAP、OAuth2）
- [ ] 高可用部署方案
- [ ] 国际化支持

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 联系我们

- 项目主页：https://github.com/yourusername/bastion
- Issue反馈：https://github.com/yourusername/bastion/issues

---

⚓ Built with ❤️ by Blackbeard Team