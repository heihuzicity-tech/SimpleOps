#!/bin/bash

echo "=== 测试镜像源加速效果 ==="
echo ""

# 测试后端镜像构建
echo "构建后端镜像（使用阿里云镜像源）..."
time docker build -f docker/backend/Dockerfile -t bastion-backend-test . --no-cache

echo ""
echo "构建完成！"
echo ""
echo "注意事项："
echo "1. 使用阿里云Alpine镜像源：mirrors.aliyun.com"
echo "2. 使用Go代理：goproxy.cn"
echo "3. 使用npm镜像源：registry.npmmirror.com"
echo "4. 使用阿里云Ubuntu镜像源：mirrors.aliyun.com"