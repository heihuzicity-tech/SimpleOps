# Docker重建检查清单

## 构建前检查

### 1. 必需的文件
- [x] `docker-compose.yml` - Docker Compose配置
- [x] `.dockerignore` - 排除不必要的文件
- [x] `docker/frontend/Dockerfile` - 前端镜像
- [x] `docker/frontend/nginx.conf` - Nginx配置
- [x] `docker/frontend/entrypoint.sh` - 前端启动脚本
- [x] `docker/frontend/env-config.js` - 环境配置模板
- [x] `docker/backend/Dockerfile` - 后端镜像
- [x] `docker/backend/config.docker.yaml` - 后端配置
- [x] `docker/mysql/Dockerfile` - MySQL镜像
- [x] `docker/mysql/init/bastion_full.sql` - 数据库初始化脚本
- [x] `docker/ssh-server/Dockerfile` - SSH服务器镜像
- [x] `docker/ssh-server/entrypoint.sh` - SSH启动脚本

### 2. 关键配置检查
- [x] 前端API代理配置指向后端 (172.20.0.6:8080)
- [x] 后端CORS配置包含端口8080
- [x] MySQL root密码: password123
- [x] SSH服务器root密码: 123 (匹配数据库凭证)
- [x] 固定IP地址配置正确

### 3. 网络配置
- 自定义网络: bastion-network (172.20.0.0/16)
- 服务IP分配:
  - frontend: 172.20.0.5
  - backend: 172.20.0.6
  - mysql: 172.20.0.7
  - redis: 172.20.0.8
  - ssh-server-1: 172.20.0.10
  - ssh-server-2: 172.20.0.11

## 构建后验证

### 1. 服务健康检查
- [ ] Frontend: http://localhost:8080/health
- [ ] Backend: http://localhost:8088/api/v1/health
- [ ] MySQL: 容器健康状态
- [ ] Redis: 容器健康状态
- [ ] SSH服务器: 容器健康状态

### 2. 功能测试
- [ ] 登录功能 (admin/admin123)
- [ ] SSH连接测试 (root/123)
- [ ] WebSocket连接
- [ ] 会话管理

## 已知问题和解决方案

1. **CORS错误**: 后端需要允许来自8080端口的请求
2. **SSH认证失败**: SSH服务器密码必须与数据库凭证匹配
3. **502错误**: 确保Redis服务正常运行
4. **数据库连接**: 使用Docker网络内部IP地址

## 部署命令

```bash
# 完全重建
docker-compose down
docker rmi -f bastion-frontend bastion-backend bastion-mysql bastion-ssh-server-1 bastion-ssh-server-2
docker-compose build --no-cache
docker-compose up -d

# 查看日志
docker-compose logs -f

# 单独重建某个服务
docker-compose build --no-cache [service-name]
docker-compose up -d [service-name]
```