# Docker 部署配置指南

## 快速开始

### 1. 默认部署（前后端同机）

如果前后端部署在同一台机器上，无需任何额外配置：

```bash
docker-compose up -d
```

访问 `http://localhost:8080` 即可使用。

### 2. 生产环境部署（前后端分离）

如果前端和后端部署在不同的服务器上，需要配置API地址：

#### 方法一：使用环境变量文件（推荐）

1. 复制环境变量模板：
```bash
cp .env.docker .env
```

2. 编辑 `.env` 文件，设置后端API地址：
```bash
# 使用IP地址
REACT_APP_API_URL=http://47.115.133.178:8088

# 或使用域名
REACT_APP_API_URL=https://api.bastion.example.com
```

3. 构建并启动：
```bash
docker-compose up -d --build
```

#### 方法二：命令行指定

```bash
REACT_APP_API_URL=http://47.115.133.178:8088 docker-compose up -d --build
```

#### 方法三：修改 docker-compose.yml

直接在 `docker-compose.yml` 中设置：

```yaml
frontend:
  build:
    args:
      REACT_APP_API_URL: "http://47.115.133.178:8088"
  environment:
    REACT_APP_API_URL: "http://47.115.133.178:8088"
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| REACT_APP_API_URL | 后端API地址 | 空（使用nginx代理） | http://47.115.133.178:8088 |

### 网络架构

#### 同机部署（默认）
```
用户浏览器 -> :8080 -> Nginx -> :8088 -> Backend
                         ↓
                    静态文件
```

#### 分离部署
```
用户浏览器 -> :8080 -> Nginx -> 静态文件
     ↓                             
     └─────> API请求 -> 外部后端服务器:8088
```

## 常见问题

### Q1: WebSocket连接失败

**问题**：在线会话监控功能无法连接WebSocket

**解决**：
1. 确保 `REACT_APP_API_URL` 配置正确
2. 确保后端服务器的WebSocket端口可访问
3. 检查防火墙是否允许WebSocket连接

### Q2: 如何更新配置

**步骤**：
1. 修改 `.env` 文件
2. 重新构建前端：`docker-compose build frontend`
3. 重启服务：`docker-compose up -d frontend`

### Q3: 如何验证配置是否生效

在浏览器控制台执行：
```javascript
console.log(process.env.REACT_APP_API_URL)
```

如果返回配置的值，说明配置生效。

## 部署检查清单

- [ ] 确认后端服务可访问
- [ ] 配置正确的 `REACT_APP_API_URL`
- [ ] 防火墙开放必要端口（8080, 8088）
- [ ] 验证WebSocket连接正常
- [ ] 测试SSH终端功能
- [ ] 测试在线会话监控功能

## 升级到域名

当您准备使用域名时：

1. 申请域名和SSL证书
2. 配置DNS解析
3. 更新 `.env` 文件：
```bash
REACT_APP_API_URL=https://api.bastion.example.com
```
4. 重新构建并部署

## 故障排查

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看前端日志
docker-compose logs -f frontend

# 查看后端日志
docker-compose logs -f backend
```

### 检查网络连接
```bash
# 进入前端容器
docker exec -it bastion-frontend sh

# 测试后端连接
curl http://172.20.0.6:8080/api/v1/health
```

### 重置环境
```bash
# 停止并删除所有容器
docker-compose down

# 清理并重新构建
docker-compose build --no-cache

# 启动服务
docker-compose up -d
```