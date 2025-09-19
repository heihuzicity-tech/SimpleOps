# 前端Docker构建修复说明

## 问题描述
在服务器上构建前端Docker镜像时出现以下错误：
```
Could not find a required file. Name: index.html
```

## 问题原因
Dockerfile中的COPY指令路径不正确。原来的指令 `COPY frontend/ ./` 会复制整个frontend目录，包括其中的嵌套目录结构，导致文件路径错误。

## 解决方案
修改Dockerfile中的COPY指令，明确指定需要复制的目录：

```dockerfile
# 原来的写法（错误）
COPY frontend/ ./

# 修正后的写法（正确）
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/tsconfig.json ./
```

## 构建验证
在项目根目录执行以下命令测试构建：

```bash
# 确保在项目根目录
cd /path/to/bastion

# 构建前端镜像
docker build -f docker/frontend/Dockerfile -t bastion-frontend:latest .

# 或使用docker-compose构建
docker-compose build frontend
```

## 注意事项
1. 必须在项目根目录执行构建命令，因为docker-compose.yml中配置的context是 `.`
2. 确保frontend目录下包含以下必要文件：
   - package.json
   - package-lock.json
   - public/index.html
   - src/App.tsx
   - tsconfig.json

## 已修改的文件
- `/docker/frontend/Dockerfile`
- `/docker/frontend/Dockerfile.debug`

修改已经过本地测试验证，可以正常构建。