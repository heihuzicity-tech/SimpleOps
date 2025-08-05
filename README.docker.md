# 黑胡子堡垒机 Docker 部署指南

## 概述

本指南介绍如何使用Docker Compose快速部署黑胡子堡垒机系统。整个系统包含6个容器：
- 前端Web界面
- 后端API服务
- MySQL数据库
- Redis缓存
- 2个SSH测试服务器

## 系统要求

- Docker Engine 20.10+
- Docker Compose v2.0+
- 至少4GB可用内存
- 10GB可用磁盘空间

## 快速开始

### 1. 构建镜像

```bash
# 构建所有镜像
docker-compose build

# 或者单独构建某个镜像
docker-compose build mysql      # ✅ 已测试
docker-compose build backend    # ✅ 已测试  
docker-compose build frontend   # ✅ 已测试
docker-compose build ssh-server-1
docker-compose build ssh-server-2
```

**注意**: SSH服务器镜像构建时间较长（约2-3分钟），因为需要安装较多系统包。

### 2. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 访问系统

- **Web界面**: http://localhost:8080
- **后端API**: http://localhost:8088

## 默认账号

### 堡垒机系统账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | Admin@123456 | 系统管理员 |
| testuser | Test@123456 | 普通用户 |
| auditor | Test@123456 | 审计员 |

### SSH测试服务器账号

| 服务器 | IP地址 | 用户名 | 密码 |
|--------|--------|--------|------|
| SSH测试服务器1 | 172.20.0.10 | root | root123 |
| SSH测试服务器1 | 172.20.0.10 | testuser | testpass |
| SSH测试服务器2 | 172.20.0.11 | root | root123 |
| SSH测试服务器2 | 172.20.0.11 | testuser | testpass |

## 服务架构

```
┌─────────────────┐
│   前端 (8080)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  后端 (8088)    │
└───┬───┬─────┬───┘
    │   │     │
┌───▼─┐┌▼───┐┌▼────┐
│MySQL││Redis││SSH │
│ (7) ││ (8) ││(10,11)│
└─────┘└─────┘└──────┘
```

### 网络配置

- 网络名称: bastion-network
- 网段: 172.20.0.0/16
- 服务IP分配:
  - 前端: 172.20.0.5
  - 后端: 172.20.0.6
  - MySQL: 172.20.0.7
  - Redis: 172.20.0.8
  - SSH服务器1: 172.20.0.10
  - SSH服务器2: 172.20.0.11

## 常用操作

### 停止服务

```bash
# 停止所有服务
docker-compose stop

# 停止并删除容器（数据不会丢失）
docker-compose down
```

### 重置环境

```bash
# 完全重置（删除容器和数据）
docker-compose down -v

# 重新启动
docker-compose up -d
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs mysql
docker-compose logs backend
docker-compose logs frontend

# 实时查看日志
docker-compose logs -f backend
```

### 进入容器

```bash
# 进入MySQL容器
docker-compose exec mysql mysql -uroot -ppassword123

# 进入后端容器
docker-compose exec backend sh

# 进入SSH服务器
docker-compose exec ssh-server-1 bash
```

## 故障排查

### 1. 服务启动失败

检查端口占用：
```bash
# 检查8080端口（前端）
lsof -i :8080

# 检查8088端口（后端）
lsof -i :8088
```

### 2. 数据库连接失败

检查MySQL服务状态：
```bash
docker-compose logs mysql
docker-compose exec mysql mysqladmin -uroot -ppassword123 ping
```

### 3. SSH连接失败

检查SSH服务状态：
```bash
docker-compose exec ssh-server-1 service ssh status
```

## 注意事项

1. **数据持久化**: 根据设计要求，容器不会持久化数据到宿主机。重启容器后所有数据将恢复到初始状态。

2. **安全提醒**: 
   - 默认密码仅用于演示环境
   - 生产环境请修改所有默认密码
   - 建议启用HTTPS和更严格的安全配置

3. **资源限制**: 可以在docker-compose.yml中添加资源限制：
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 1G
   ```

## 开发调试

### 修改配置

- 后端配置: `docker/backend/config.docker.yaml`
- 前端配置: `docker/frontend/env-config.js`
- Nginx配置: `docker/frontend/nginx.conf`

### 重新构建

修改代码后需要重新构建镜像：
```bash
docker-compose build --no-cache [service_name]
docker-compose up -d
```

## 卸载

完全删除所有容器、镜像和网络：
```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker-compose down --rmi all

# 删除网络
docker network rm bastion_bastion-network
```

## 技术支持

如有问题，请查看：
- 项目文档: `/docs`
- SPECS文档: `/.specs/制作镜像/`
- GitHub Issues: [项目地址]

---
*黑胡子堡垒机 Docker版 v1.0.0*