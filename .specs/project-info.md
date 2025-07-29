# Bastion项目基本信息

## 技术栈
- **后端**: Go语言 (Gin框架)
- **前端**: React + TypeScript + Ant Design
- **数据库**: MySQL (主数据库) + Redis (会话缓存)
- **WebSocket**: 用于SSH终端实时通信

## 数据库连接
- MySQL: mysql -uroot -ppassword123 -h10.0.0.7
- Redis: localhost:6379

## 主要模块
- SSH堡垒机功能
- 主机管理
- 用户权限管理
- 操作审计记录
- 会话管理

## 项目结构
- `/backend`: Go后端代码
- `/frontend`: React前端代码
- `/.specs`: SPECS工作流文档

## 服务端口
- 后端API: 8080
- 前端开发: 3000

## 服务管理
- 使用 `/Users/skip/workspace/bastion/manage.sh` 脚本进行前端和后端服务管理