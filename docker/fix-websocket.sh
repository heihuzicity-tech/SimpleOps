#!/bin/bash
# 修复WebSocket连接问题

echo "修复WebSocket连接配置..."

# 重新构建前端镜像（包含新的nginx配置）
echo "重新构建前端镜像..."
docker-compose build frontend

# 重启前端容器
echo "重启前端容器..."
docker-compose up -d frontend

echo "修复完成！"
echo ""
echo "测试WebSocket连接："
echo "1. 访问 http://你的IP:8080"
echo "2. 登录后进入'审计管理' -> '在线会话'"
echo "3. 查看是否能正常显示在线会话"
echo ""
echo "如果还有问题，请查看日志："
echo "docker logs bastion-frontend"
echo "docker logs bastion-backend"