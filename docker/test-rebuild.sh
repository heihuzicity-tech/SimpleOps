#!/bin/bash

echo "=== 开始完全重建测试 ==="
echo ""

# 1. 停止所有容器
echo "1. 停止所有容器..."
docker-compose down
echo "✓ 容器已停止"
echo ""

# 2. 删除所有相关镜像
echo "2. 删除所有Bastion相关镜像..."
docker rmi -f bastion-frontend bastion-backend bastion-mysql bastion-ssh-server-1 bastion-ssh-server-2 2>/dev/null || true
echo "✓ 镜像已删除"
echo ""

# 3. 清理未使用的卷（可选）
echo "3. 清理Docker卷..."
docker volume prune -f
echo "✓ 卷已清理"
echo ""

# 4. 重新构建所有镜像
echo "4. 重新构建所有镜像..."
docker-compose build --no-cache
echo "✓ 镜像构建完成"
echo ""

# 5. 启动所有服务
echo "5. 启动所有服务..."
docker-compose up -d
echo "✓ 服务已启动"
echo ""

# 6. 等待服务就绪
echo "6. 等待服务就绪..."
sleep 10

# 7. 检查服务状态
echo "7. 检查服务状态..."
docker-compose ps
echo ""

# 8. 测试健康检查
echo "8. 测试服务健康状态..."
echo -n "Frontend健康检查: "
curl -s http://localhost:8080/health || echo "失败"
echo -n "Backend健康检查: "
curl -s http://localhost:8088/api/v1/health || echo "失败"
echo ""

# 9. 测试登录
echo "9. 测试登录功能..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
  echo "✓ 登录测试成功"
else
  echo "✗ 登录测试失败"
  echo "响应: $LOGIN_RESPONSE"
fi
echo ""

echo "=== 测试完成 ==="