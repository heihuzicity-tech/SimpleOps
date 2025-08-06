# Docker配置优化更新说明

## 更新日期：2025-01-30

## 主要改进

### 1. 安全性提升
- ✅ **移除后端端口暴露**：backend不再暴露8088端口，减少攻击面
- ✅ **统一入口**：所有请求通过nginx（8080端口）进入
- ✅ **内部网络隔离**：MySQL和Redis完全内部化

### 2. WebSocket问题修复
- ✅ **修复路径匹配**：nginx正确处理 `/api/v1/ws/` 路径
- ✅ **优化配置**：WebSocket配置移到最前，确保优先匹配

### 3. 配置简化
- ✅ **使用服务名**：移除硬编码IP，使用Docker服务发现
- ✅ **减少固定IP**：仅SSH测试服务器保留固定IP
- ✅ **环境变量简化**：Docker Compose模式不需要配置API_URL

## 配置变更详情

### docker-compose.yml
```yaml
# 变更前
backend:
  ports:
    - "8088:8080"  # 暴露了后端端口
  networks:
    bastion-network:
      ipv4_address: 172.20.0.6  # 固定IP

# 变更后
backend:
  # 移除ports配置
  networks:
    - bastion-network  # 不固定IP
```

### nginx.conf
```nginx
# 变更前
proxy_pass http://172.20.0.6:8080;  # 硬编码IP

# 变更后
proxy_pass http://backend:8080;  # 使用服务名
```

### config.docker.yaml
```yaml
# 变更前
database:
  host: "172.20.0.7"  # 固定IP
redis:
  host: "172.20.0.8"  # 固定IP

# 变更后
database:
  host: "mysql"  # 服务名
redis:
  host: "redis"  # 服务名
```

## 部署步骤

### 1. 停止当前服务
```bash
docker-compose down
```

### 2. 清理旧容器和网络（可选）
```bash
docker system prune -f
docker network prune -f
```

### 3. 重新构建镜像
```bash
# 清理构建缓存（如果需要）
docker-compose build --no-cache

# 或普通构建
docker-compose build
```

### 4. 启动服务
```bash
docker-compose up -d
```

### 5. 验证服务状态
```bash
# 查看所有服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 检查网络连通性
docker exec bastion-frontend ping backend
docker exec bastion-backend ping mysql
docker exec bastion-backend ping redis
```

## 验证清单

### 基础功能
- [ ] 访问 `http://服务器IP:8080` 能正常显示页面
- [ ] 能正常登录系统
- [ ] API请求正常（查看用户列表等）

### WebSocket功能
- [ ] SSH终端连接正常
- [ ] 在线会话监控WebSocket连接成功
- [ ] 实时日志推送正常

### 内部连接
- [ ] 后端能连接MySQL（查看数据）
- [ ] 后端能连接Redis（会话管理）
- [ ] SSH测试服务器连接正常

## 故障排查

### 问题1：服务无法启动
```bash
# 检查容器状态
docker-compose ps

# 查看具体错误
docker-compose logs backend
docker-compose logs frontend
```

### 问题2：WebSocket连接失败
```bash
# 进入frontend容器检查nginx配置
docker exec -it bastion-frontend sh
cat /etc/nginx/conf.d/default.conf

# 测试后端连通性
wget http://backend:8080/api/v1/health
```

### 问题3：数据库连接失败
```bash
# 检查服务名解析
docker exec bastion-backend ping mysql

# 检查数据库服务
docker exec bastion-mysql mysql -uroot -ppassword123 -e "SELECT 1"
```

## 回滚方案

如果更新后出现问题，可以回滚到之前的配置：

```bash
# 1. 恢复之前的配置文件
git checkout HEAD~1 docker-compose.yml
git checkout HEAD~1 docker/frontend/nginx.conf
git checkout HEAD~1 docker/backend/config.docker.yaml

# 2. 重新部署
docker-compose down
docker-compose up -d
```

## 注意事项

1. **端口变更**：后端不再暴露8088端口，所有请求通过8080端口的nginx
2. **环境变量**：不需要设置 `REACT_APP_API_URL`
3. **网络模式**：确保所有服务在同一个network中
4. **DNS解析**：Docker会自动处理服务名到IP的解析

## 性能优化

本次更新带来的性能提升：
- 减少了网络跳转（直接使用内部网络）
- 优化了WebSocket连接（正确的路径匹配）
- 简化了配置管理（减少维护成本）

## 后续建议

1. **监控**：建议添加Prometheus监控
2. **日志**：考虑使用ELK栈进行日志管理
3. **备份**：定期备份数据库
4. **SSL**：生产环境建议配置SSL证书

---

更新完成后，系统将更加安全、稳定和易于维护。