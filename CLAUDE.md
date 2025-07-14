# Bastion 项目开发指南

## 语言要求
- 所有对话请使用中文
- 代码注释使用中文
- 文档和说明使用中文

## SuperClaude指令集成

### 当用户提到以下关键词时，自动使用相应的SuperClaude指令：
- **"修复bug"、"问题排查"** → 建议使用: `/troubleshoot --prod --five-whys --persona-backend`
- **"性能优化"、"卡顿"** → 建议使用: `/improve --performance --iterate --persona-performance`
- **"新功能开发"** → 建议使用: `/design --api --ddd --persona-architect`
- **"安全问题"** → 建议使用: `/analyze --code --think-hard --persona-security`
- **"代码分析"** → 建议使用: `/analyze --code --think --persona-architect`

### 标准项目上下文模板
当使用SuperClaude指令时，请自动包含以下项目信息：
```
【项目】Bastion运维堡垒机系统  
【技术栈】Go + React + TypeScript + Docker + MySQL + Redis
【架构】前后端分离，微服务架构
【约束】必须使用./manage.sh管理服务，保持Docker架构
```

## 服务管理
- **重要**: 始终使用 `./manage.sh` 脚本来管理服务
- 不要直接使用 docker 或 docker-compose 命令
- 可用的管理命令：
  - `./manage.sh start` - 启动所有服务
  - `./manage.sh stop` - 停止所有服务
  - `./manage.sh restart` - 重启所有服务
  - `./manage.sh status` - 查看服务状态
  - `./manage.sh logs [service]` - 查看日志
  - `./manage.sh build` - 构建服务

## 项目结构
- 这是一个基于 Docker 的 Web SSH 终端项目
- 前端使用 React + TypeScript
- 后端使用 Go (不是Node.js)
- 使用 Docker Compose 进行容器编排

## 开发规范
- 修改代码后使用 `./manage.sh restart` 重启相关服务
- 查看日志时使用 `./manage.sh logs` 命令
- 遇到问题时先检查服务状态：`./manage.sh status`

## 数据库连接信息
- mysql -uroot -ppassword -h10.0.0.7
- redis-cli -h 10.0.0.7