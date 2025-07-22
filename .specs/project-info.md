# 项目基础信息

## 项目路径
- **根路径**: /Users/skip/workspace/bastion
- **测试脚本保存路径**: /Users/skip/workspace/tests/[feature_name]

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
- `tests/` - 测试文件目录
- `manage.sh` - 服务管理脚本

## 测试管理
- **测试目录结构**: `tests/[feature_name]/` 
- **测试文件类型**: Go测试文件、测试脚本、测试文档、测试日志
- **说明**: 每个功能的测试文件统一存放在以功能名命名的子目录中

## 保存时间
- 创建时间: 2025-07-22
- 更新时间: 2025-07-22 (添加项目根路径和测试脚本路径)

---
*此文件由 Kiro SPECS 自动维护，用于保存项目基础信息供 AI 开发助手参考*