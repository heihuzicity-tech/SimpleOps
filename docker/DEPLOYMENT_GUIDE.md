# Bastion 公网部署指南

## 问题诊断

### 403 Forbidden 错误原因
当部署到公网服务器时出现403错误，主要原因是：
1. 后端CORS配置硬编码，只允许localhost和127.0.0.1访问
2. 配置文件中的CORS设置未被正确读取

## 快速修复方案

### 方案1：使用更新后的代码（推荐）
代码已更新，支持动态CORS配置：
- `backend/routers/router.go` 已修改为读取配置文件中的CORS设置
- 如果配置文件未设置，默认允许所有来源（开发环境）

### 方案2：使用生产环境配置文件
1. 使用提供的生产环境配置：
```bash
# 复制生产环境配置
cp docker/backend/config.docker.production.yaml docker/backend/config.docker.yaml
```

2. 编辑配置文件，添加您的实际IP/域名：
```yaml
security:
  cors:
    allowOrigins: [
      "http://你的公网IP:8080",
      "https://你的域名.com"
    ]
```

## 部署步骤

### 1. 准备工作
```bash
# 确保在项目根目录
cd /path/to/bastion

# 停止现有容器
docker-compose down

# 清理旧镜像（可选）
docker system prune -af
```

### 2. 构建镜像
```bash
# 构建所有镜像
docker-compose build

# 或者只重新构建后端
docker-compose build backend
```

### 3. 启动服务
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 验证部署
```bash
# 检查服务状态
docker-compose ps

# 测试后端健康检查
curl http://你的IP:8088/api/v1/health

# 测试前端访问
curl http://你的IP:8080/
```

## 端口映射说明
- 前端Web界面：8080 -> 80 (nginx)
- 后端API服务：8088 -> 8080 (内部)
- 访问地址：http://你的公网IP:8080

## 安全建议

### 生产环境CORS配置
不要使用`AllowOriginFunc: return true`，而是明确指定允许的域名：

```go
// backend/routers/router.go
corsConfig.AllowOrigins = []string{
    "https://your-domain.com",
    "https://www.your-domain.com",
}
```

### 使用HTTPS
1. 配置nginx SSL证书
2. 更新CORS配置为https
3. 强制HTTP重定向到HTTPS

### 修改默认密码
```sql
-- 连接到MySQL容器
docker exec -it bastion-mysql mysql -uroot -ppassword123 bastion

-- 更新管理员密码
UPDATE users SET password='新密码的bcrypt哈希' WHERE username='admin';
```

## 故障排查

### 1. 403 Forbidden
- 检查CORS配置是否包含访问来源
- 确认后端服务正常运行
- 查看后端日志：`docker logs bastion-backend`

### 2. 无法连接后端
- 检查防火墙规则
- 确认端口映射正确
- 验证nginx反向代理配置

### 3. 查看详细日志
```bash
# 后端日志
docker logs -f bastion-backend

# 前端nginx日志
docker logs -f bastion-frontend

# MySQL日志
docker logs -f bastion-mysql
```

## 环境变量配置（可选）

如果需要通过环境变量配置CORS，可以创建`.env`文件：
```env
CORS_ALLOWED_ORIGINS=http://47.115.133.178:8080,https://your-domain.com
JWT_SECRET=your-secure-secret-key
MYSQL_PASSWORD=your-secure-password
```

然后在docker-compose.yml中引用：
```yaml
backend:
  environment:
    CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS}
```

## 监控和维护

### 健康检查
- 前端：http://你的IP:8080/health
- 后端：http://你的IP:8088/api/v1/health

### 日志轮转
配置已包含日志轮转设置，自动管理日志文件大小。

### 数据备份
```bash
# 备份MySQL数据
docker exec bastion-mysql mysqldump -uroot -ppassword123 bastion > backup.sql

# 恢复数据
docker exec -i bastion-mysql mysql -uroot -ppassword123 bastion < backup.sql
```