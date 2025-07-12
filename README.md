# 运维堡垒机系统 (Bastion)

[![Go Version](https://img.shields.io/badge/Go-1.19+-blue.svg)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🚀 项目简介

运维堡垒机系统是一个基于Go和React的企业级运维安全管理平台，专注于提供安全的服务器访问控制和操作审计功能。

### 核心特性

- 🔐 **用户认证与权限管理** - 基于JWT的认证系统和RBAC权限控制
- 🖥️ **服务器资产管理** - 统一的服务器资产和凭证管理
- 🔗 **SSH访问代理** - 安全的SSH协议代理和WebSSH终端
- 📊 **操作审计** - 完整的操作日志记录和会话审计
- 🎨 **现代化界面** - 基于Ant Design的美观管理界面

### 技术栈

#### 后端
- **Go 1.19+** - 高性能的后端服务
- **Gin** - 轻量级Web框架
- **GORM** - 优雅的ORM框架
- **JWT** - 无状态认证
- **MySQL 8.0** - 主数据库
- **Redis** - 缓存和会话存储

#### 前端
- **React 18** - 现代化前端框架
- **Ant Design** - 企业级UI组件库
- **TypeScript** - 类型安全的JavaScript
- **Axios** - HTTP客户端

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
├── frontend/               # 前端React应用
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   ├── public/             # 静态资源
│   └── package.json        # npm依赖
├── docs/                   # 项目文档
├── scripts/                # 部署脚本
└── docker-compose.yml      # Docker编排
```

## 🚀 快速开始

### 环境要求

- Go 1.19+
- Node.js 16+
- MySQL 8.0+
- Redis 7+
- Docker & Docker Compose

### 1. 克隆项目

```bash
git clone https://github.com/your-org/bastion.git
cd bastion
```

### 2. 启动依赖服务

```bash
# 启动MySQL和Redis
docker-compose up -d mysql redis

# 等待服务启动
sleep 10
```

### 3. 后端开发

```bash
# 进入后端目录
cd backend

# 初始化Go模块
go mod init bastion
go mod tidy

# 创建配置文件
cp config/config.example.yaml config/config.yaml

# 编辑配置文件（数据库连接等）
vim config/config.yaml

# 运行数据库迁移
go run main.go --migrate

# 启动开发服务器
go run main.go
```

### 4. 前端开发

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 5. 访问应用

- 🌐 前端界面: http://localhost:3000
- 🔧 后端API: http://localhost:8080
- 👤 默认管理员: admin/admin123

## 📖 文档

- [📋 需求分析文档](docs/运维堡垒机系统需求分析文档.md)
- [🚀 MVP快速指南](docs/MVP快速开始指南.md)
- [📊 项目架构图表](docs/项目架构图表集.md)
- [✅ 任务检查表](docs/任务需求一致性检查表.md)

## 🔧 开发指南

### 后端开发

```bash
# 格式化代码
go fmt ./...

# 运行测试
go test ./...

# 构建应用
go build -o bastion main.go

# 运行应用
./bastion
```

### 前端开发

```bash
# 运行测试
npm test

# 构建生产版本
npm run build

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## 🐳 Docker部署

### 开发环境

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境

```bash
# 构建生产镜像
docker-compose -f docker-compose.prod.yml build

# 启动生产服务
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 测试

### 后端测试

```bash
cd backend
go test ./... -v
```

### 前端测试

```bash
cd frontend
npm test
```

### 集成测试

```bash
# 运行端到端测试
npm run test:e2e
```

## 📊 监控

### 健康检查

- 后端健康检查: http://localhost:8080/health
- 前端健康检查: http://localhost:3000/health

### 指标监控

- 系统指标: http://localhost:8080/metrics
- 应用日志: `logs/app.log`

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 后端: 遵循Go标准编码规范
- 前端: 遵循React和TypeScript最佳实践
- 提交: 使用 [Conventional Commits](https://conventionalcommits.org/) 格式

## 📝 变更日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本变更记录。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目和社区：

- [Gin](https://github.com/gin-gonic/gin) - Go Web框架
- [GORM](https://github.com/go-gorm/gorm) - Go ORM
- [React](https://github.com/facebook/react) - 前端框架
- [Ant Design](https://github.com/ant-design/ant-design) - UI组件库

## 📞 支持

如果您有任何问题或建议，请：

1. 查看 [文档](docs/)
2. 搜索 [Issues](https://github.com/your-org/bastion/issues)
3. 创建新的 [Issue](https://github.com/your-org/bastion/issues/new)

---

**开始您的安全运维之旅！** 🚀 