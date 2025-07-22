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
  - `controllers/` - API控制器层
  - `services/` - 业务逻辑层
  - `models/` - 数据模型定义
  - `migrations/` - 数据库迁移脚本
- `frontend/` - React 前端代码
  - `src/components/` - React组件
  - `src/services/` - API服务调用
  - `src/hooks/` - 自定义React Hook
  - `src/store/` - Redux状态管理
- `scripts/` - 数据库脚本和工具
- `docs/` - 项目文档
- `tests/` - 测试文件目录
- `.specs/` - SPECS工作流文档
- `manage.sh` - 服务管理脚本

## 测试管理
- **测试目录结构**: `tests/[feature_name]/` 
- **测试文件类型**: Go测试文件、测试脚本、测试文档、测试日志
- **说明**: 每个功能的测试文件统一存放在以功能名命名的子目录中

## 核心功能特性
### SSH会话管理
- **会话创建**: 支持控制台和主机连接两种创建方式
- **会话超时**: 可配置超时时间，支持自动断开和手动延长
- **活动检测**: 键盘和鼠标活动自动刷新超时计时
- **标签页管理**: 支持多标签页SSH会话，安全关闭清理

### 会话清理机制
- **应用内关闭**: 标签页关闭时自动调用后端清理API
- **浏览器关闭**: beforeunload/unload事件+keepalive/sendBeacon双重保障
- **批量清理**: 页面卸载时批量清理所有活跃会话
- **权限验证**: 用户只能清理属于自己的会话

### 审计与监控
- **操作审计**: 完整记录会话创建、操作、关闭等行为
- **实时监控**: 在线会话列表实时更新，显示超时状态
- **详细记录**: 审计记录包含会话ID、资源ID、详细描述信息
- **数据一致性**: Redis+MySQL双重存储，自动同步清理

### 技术架构
- **后端服务**: Go + Gin + GORM + Redis + WebSocket
- **前端界面**: React + Redux + Ant Design + TypeScript
- **数据存储**: MySQL(业务数据) + Redis(会话缓存)
- **实时通信**: WebSocket连接管理和消息传递

## 保存时间
- 创建时间: 2025-07-22
- 更新时间: 2025-07-23 (添加SSH会话管理功能完整说明)

---
*此文件由 Kiro SPECS 自动维护，用于保存项目基础信息供 AI 开发助手参考*