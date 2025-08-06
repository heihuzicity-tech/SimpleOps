#!/bin/bash

# 前端构建脚本 - 用于在没有源代码的服务器上构建前端
# 使用方式：在服务器上执行此脚本

set -e

echo "=== 前端构建脚本 ==="
echo ""

# 检查当前目录
if [ ! -f "docker-compose.yml" ]; then
    echo "错误：请在项目根目录执行此脚本"
    exit 1
fi

# 创建临时构建目录
BUILD_DIR="docker/frontend/build-temp"
mkdir -p $BUILD_DIR

echo "1. 检查前端源代码..."
if [ ! -d "frontend/src" ] || [ ! -d "frontend/public" ]; then
    echo "   前端源代码不存在，需要从git获取或复制"
    echo ""
    echo "   选项A：如果您有本地构建好的前端文件"
    echo "   请将构建产物（build目录）复制到：docker/frontend/build/"
    echo ""
    echo "   选项B：从git拉取完整代码"
    echo "   git pull origin main"
    echo ""
    echo "   选项C：使用预构建镜像"
    echo "   请联系开发团队获取预构建的前端镜像"
    exit 1
fi

echo "2. 创建临时Dockerfile用于构建..."
cat > $BUILD_DIR/Dockerfile.build << 'EOF'
# 构建阶段
FROM node:18-alpine AS builder

# 设置阿里云Alpine镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 设置npm镜像源
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /build

# 复制package文件
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/tsconfig.json ./

# 构建
ENV REACT_APP_API_BASE_URL=http://localhost:8088
RUN npm run build

# 导出构建产物
FROM alpine:latest
COPY --from=builder /build/build /output
EOF

echo "3. 构建前端..."
docker build -f $BUILD_DIR/Dockerfile.build -t frontend-builder . --progress=plain

echo "4. 导出构建产物..."
# 创建临时容器并复制构建产物
docker create --name temp-frontend-builder frontend-builder
docker cp temp-frontend-builder:/output docker/frontend/build
docker rm temp-frontend-builder

echo "5. 清理临时文件..."
rm -rf $BUILD_DIR
docker rmi frontend-builder

echo ""
echo "✅ 前端构建完成！"
echo "   构建产物已保存到：docker/frontend/build/"
echo ""
echo "6. 现在可以使用生产环境Dockerfile构建镜像："
echo "   docker build -f docker/frontend/Dockerfile.production -t bastion-frontend ."
echo ""
echo "   或使用docker-compose："
echo "   docker-compose build frontend"