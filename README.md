# 运维堡垒机系统 (Bastion)

[![Go Version](https://img.shields.io/badge/Go-1.19+-blue.svg)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/Coverage-85%25-green.svg)]()

## 🚀 项目简介

运维堡垒机系统是一个基于Go和React的企业级运维安全管理平台，专注于提供安全的服务器访问控制和操作审计功能。

### 核心特性

- 🔐 **用户认证与权限管理** - 基于JWT的认证系统和RBAC权限控制
- 🖥️ **服务器资产管理** - 统一的服务器资产和凭证管理
- 🔗 **SSH访问代理** - 安全的SSH协议代理和WebSSH终端
- 📊 **操作审计** - 完整的操作日志记录和会话审计
- 🎨 **现代化界面** - 基于Ant Design的美观管理界面 (开发中)

### 技术栈

#### 后端
- **Go 1.19+** - 高性能的后端服务
- **Gin** - 轻量级Web框架
- **GORM** - 优雅的ORM框架
- **JWT** - 无状态认证
- **MySQL 8.0** - 主数据库
- **Redis** - 缓存和会话存储

#### 前端
- **React 18** - 现代化前端框架 (开发中)
- **Ant Design** - 企业级UI组件库 (开发中)
- **TypeScript** - 类型安全的JavaScript (开发中)
- **Axios** - HTTP客户端 (开发中)

### 当前功能状态 ✅

- **✅ 用户认证系统** - JWT认证、密码安全、会话管理
- **✅ 权限管理** - 基于角色的访问控制(RBAC)
- **✅ 用户管理** - 完整的用户和角色管理
- **✅ 资产管理** - 服务器资产和凭证管理
- **✅ SSH访问代理** - SSH协议代理和会话管理
- **✅ 操作审计** - 全面的日志记录和审计追踪
- **✅ API文档** - 完整的Swagger文档

### 开发中功能 🚧

- **🚧 前端界面** - React + Ant Design管理界面
  - **✅ 基础界面** - 登录页面、用户管理、资产管理页面已完成
  - **✅ 权限系统** - 基于角色的菜单控制和页面访问控制已完成
  - **🚧 SSH终端** - WebSSH终端界面、会话管理界面开发中
- **🚧 集成测试** - 完整功能测试和性能测试
- **🚧 部署文档** - 完善的部署和使用文档

## 🏗️ 项目结构

```
bastion/
├── backend/                 # 后端Go服务
│   ├── main.go             # 应用入口
│   ├── config/             # 配置文件
│   ├── models/             # 数据模型
│   ├── controllers/        # 控制器层
│   ├── services/           # 业务逻辑层
│   ├── middleware/         # 中间件
│   ├── routers/            # 路由定义
│   └── utils/              # 工具函数
├── frontend/               # 前端React应用 (开发中)
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
├── scripts/                # 数据库脚本
├── docs/                   # 项目文档
├── docker-compose.yml      # Docker配置
└── README.md              # 项目说明
```

## 🛠️ 核心功能

### 1. 用户认证与权限管理
- JWT令牌认证
- 密码强度验证和哈希存储
- 基于角色的访问控制(RBAC)
- 权限动态分配和检查
- 会话管理和Token刷新

### 2. 资产管理
- 服务器资产录入和管理
- 支持多种资产类型 (服务器、数据库、网络设备)
- AES-GCM加密的凭证存储
- 连接测试功能 (SSH、RDP、数据库)
- 资产分组和批量操作

### 3. SSH访问代理
- 完整的SSH协议代理实现
- WebSocket支持的实时终端
- SSH会话管理和连接池
- SSH密钥生成和管理
- 自动清理超时会话

### 4. 审计系统
- 登录日志记录
- 操作日志记录
- SSH会话记录
- 命令执行日志
- 统计分析和报表
- 日志查询和清理

## 🔧 API接口

系统提供完整的RESTful API，支持以下功能：

### 认证相关
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/logout` - 用户登出
- `POST /api/v1/auth/refresh` - 刷新Token
- `GET /api/v1/profile` - 获取用户资料
- `PUT /api/v1/profile` - 更新用户资料
- `POST /api/v1/change-password` - 修改密码

### 用户管理
- `GET /api/v1/users` - 获取用户列表
- `POST /api/v1/users` - 创建用户
- `PUT /api/v1/users/{id}` - 更新用户
- `DELETE /api/v1/users/{id}` - 删除用户

### 资产管理
- `GET /api/v1/assets` - 获取资产列表
- `POST /api/v1/assets` - 创建资产
- `PUT /api/v1/assets/{id}` - 更新资产
- `POST /api/v1/assets/{id}/test-connection` - 测试连接

### SSH管理
- `POST /api/v1/ssh/sessions` - 创建SSH会话
- `GET /api/v1/ssh/sessions` - 获取会话列表
- `DELETE /api/v1/ssh/sessions/{id}` - 终止SSH会话
- `GET /api/v1/ssh/websocket/{sessionId}` - WebSocket连接

### 审计管理
- `GET /api/v1/audit/login-logs` - 获取登录日志
- `GET /api/v1/audit/operation-logs` - 获取操作日志
- `GET /api/v1/audit/session-records` - 获取会话记录
- `GET /api/v1/audit/statistics` - 获取审计统计

**完整API文档**: [http://localhost:8080/swagger/index.html](http://localhost:8080/swagger/index.html)

## 🚀 快速开始

### 环境要求
- Go 1.19+
- MySQL 8.0+
- Redis 6.0+
- Node.js 18+ (前端开发)

### 后端启动

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd bastion
   ```

2. **配置数据库**
   ```bash
   # 创建数据库
   mysql -u root -p
   CREATE DATABASE bastion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   # 导入数据库结构
   mysql -u root -p bastion < scripts/init.sql
   mysql -u root -p bastion < scripts/create_audit_tables.sql
   ```

3. **配置应用**
   ```bash
   cd backend
   cp config/config.yaml.example config/config.yaml
   # 编辑配置文件，修改数据库连接信息
   ```

4. **安装依赖并运行**
   ```bash
   go mod download
   go run main.go
   ```

5. **验证启动**
   ```bash
   curl http://localhost:8080/health
   ```

### 前端启动 (开发中)

```bash
cd frontend
npm install
npm start
```

## 📊 数据库结构

系统使用MySQL数据库，包含以下核心表：

- `users` - 用户信息
- `roles` - 角色定义
- `permissions` - 权限定义
- `user_roles` - 用户角色关联
- `role_permissions` - 角色权限关联
- `assets` - 资产信息
- `credentials` - 凭证信息
- `sessions` - SSH会话记录
- `login_logs` - 登录日志
- `operation_logs` - 操作日志
- `session_records` - 会话记录
- `command_logs` - 命令日志

## 🔒 安全特性

- **JWT认证** - 无状态的用户认证
- **密码哈希** - bcrypt密码安全存储
- **AES加密** - 敏感数据AES-GCM加密
- **权限控制** - 基于角色的访问控制
- **审计日志** - 完整的操作追踪
- **会话管理** - 安全的会话生命周期管理
- **输入验证** - 严格的输入参数验证

## 🎯 默认账户

系统默认创建以下账户：

- **管理员账户**
  - 用户名: `admin`
  - 密码: `admin123`
  - 角色: 系统管理员 (拥有所有权限)

- **预设角色**
  - `admin`: 系统管理员 (所有权限)
  - `operator`: 运维人员 (资产管理、SSH访问)
  - `auditor`: 审计员 (日志查看权限)

## 📖 文档

- [项目进度总结](docs/项目进度总结.md) - 详细的项目进度和技术实现
- [API使用指南](docs/API使用指南.md) - API接口使用说明
- [数据库导入指南](docs/数据库导入指南.md) - 数据库设置指南
- [SSH模块测试报告](SSH模块测试报告.md) - SSH功能测试报告
- [审计系统测试指南](audit_system_test.md) - 审计系统测试指南

## 🤝 贡献

欢迎贡献代码和提出建议！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目主页: [GitHub Repository]
- 问题反馈: [GitHub Issues]
- 邮箱: [your-email@example.com]

---

**项目状态**: 🟢 核心后端功能已完成，前端开发中
**版本**: v2.0.0
**最后更新**: 2025-01-13 