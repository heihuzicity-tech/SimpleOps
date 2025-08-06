#!/bin/bash
# WebSocket连接测试脚本

echo "======================================"
echo "WebSocket连接问题诊断"
echo "======================================"
echo ""

# 服务器IP
SERVER_IP="47.115.133.178"

echo "1. 检查容器运行状态："
echo "-------------------"
docker ps | grep bastion
echo ""

echo "2. 测试后端健康检查："
echo "-------------------"
curl -I http://${SERVER_IP}:8088/api/v1/health
echo ""

echo "3. 检查后端日志（最近的WebSocket错误）："
echo "-------------------"
docker logs bastion-backend 2>&1 | grep -i websocket | tail -5
echo ""

echo "4. 检查前端nginx日志："
echo "-------------------"
docker logs bastion-frontend 2>&1 | tail -10
echo ""

echo "5. 测试直接访问后端（绕过nginx）："
echo "-------------------"
echo "如果你能访问，请尝试："
echo "http://${SERVER_IP}:8088/api/v1/auth/login"
echo ""

echo "6. 检查防火墙规则："
echo "-------------------"
echo "确保以下端口已开放："
echo "- 8080 (前端nginx)"
echo "- 8088 (后端API，用于测试)"
echo ""

echo "======================================"
echo "修复建议："
echo "======================================"
echo ""
echo "1. 重新构建并重启容器："
echo "   docker-compose down"
echo "   docker-compose build frontend"
echo "   docker-compose up -d"
echo ""
echo "2. 如果还是不行，尝试直接访问后端："
echo "   修改前端代码，将WebSocket URL改为："
echo "   ws://${SERVER_IP}:8088/api/v1/ws/monitor"
echo ""
echo "3. 检查服务器防火墙："
echo "   firewall-cmd --list-all"
echo "   或"
echo "   iptables -L -n"
echo ""