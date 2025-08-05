#!/bin/bash

echo "=== 测试前端镜像构建 ==="
echo ""

# 清理本地缓存（可选）
echo "1. 清理Docker缓存..."
docker builder prune -f

echo ""
echo "2. 使用调试Dockerfile构建..."
docker build -f docker/frontend/Dockerfile.debug -t bastion-frontend-debug . --no-cache --progress=plain

echo ""
echo "3. 如果构建失败，请查看上面的调试信息"
echo ""
echo "可能的原因："
echo "- 构建上下文不同（确保在项目根目录执行）"
echo "- 文件权限问题"
echo "- .dockerignore 文件差异"
echo "- Docker 版本差异（本地: 28.3.2, 服务器: 26.1.3）"