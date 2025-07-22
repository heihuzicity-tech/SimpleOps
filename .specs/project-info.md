# 项目基础信息

## 服务管理方式
- **管理脚本**: 使用当前目录下的 `manage.sh` 来管理服务状态
- **启动服务**: `./manage.sh start`
- **停止服务**: `./manage.sh stop`  
- **重启服务**: `./manage.sh restart`
- **查看状态**: `./manage.sh status`

## 数据库配置
### MySQL 数据库
- 连接信息: `mysql -uroot -ppassword123 -h10.0.0.7`
- 数据库名: `bastion`
- 主要用途: 业务数据存储

### Redis 数据库  
- 连接信息: `redis-cli -h 10.0.0.7`
- 主要用途: 会话管理、缓存

## 技术栈
- **后端**: Go (端口: 8080)
- **前端**: React (端口: 3000)
- **数据库**: MySQL + Redis
- **项目类型**: 运维堡垒机系统

## 项目结构
- `backend/` - Go 后端代码
- `frontend/` - React 前端代码
- `scripts/` - 数据库脚本和工具
- `docs/` - 项目文档
- `manage.sh` - 服务管理脚本

## 保存时间
- 创建时间: 2025-07-22

---
*此文件由 Kiro SPECS 自动维护，用于保存项目基础信息供 AI 开发助手参考*