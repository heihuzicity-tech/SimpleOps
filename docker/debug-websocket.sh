#!/bin/bash

echo "==================================="
echo "WebSocket连接诊断脚本"
echo "==================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查容器运行状态
echo -e "\n${YELLOW}1. 检查容器状态：${NC}"
docker-compose ps

# 2. 检查nginx配置是否正确加载
echo -e "\n${YELLOW}2. 检查nginx配置：${NC}"
echo "查看nginx配置中的WebSocket部分："
docker exec bastion-frontend grep -A 10 "location ~ /ws/" /etc/nginx/conf.d/default.conf

# 3. 测试后端健康检查
echo -e "\n${YELLOW}3. 测试后端健康检查：${NC}"
docker exec bastion-frontend wget -qO- http://backend:8080/api/v1/health || echo -e "${RED}后端健康检查失败${NC}"

# 4. 检查后端日志
echo -e "\n${YELLOW}4. 后端最近的错误日志：${NC}"
docker logs bastion-backend --tail 20 2>&1 | grep -i "error\|websocket\|ws" || echo "无相关错误"

# 5. 测试WebSocket路径
echo -e "\n${YELLOW}5. 测试WebSocket连接（从nginx容器内）：${NC}"
docker exec bastion-frontend sh -c 'curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  http://backend:8080/api/v1/ws/monitor?token=test 2>&1 | head -20'

# 6. 检查网络连通性
echo -e "\n${YELLOW}6. 检查容器间网络连通性：${NC}"
docker exec bastion-frontend ping -c 1 backend && echo -e "${GREEN}✓ frontend -> backend 连通${NC}" || echo -e "${RED}✗ frontend -> backend 不通${NC}"
docker exec bastion-backend ping -c 1 mysql && echo -e "${GREEN}✓ backend -> mysql 连通${NC}" || echo -e "${RED}✗ backend -> mysql 不通${NC}"
docker exec bastion-backend ping -c 1 redis && echo -e "${GREEN}✓ backend -> redis 连通${NC}" || echo -e "${RED}✗ backend -> redis 不通${NC}"

# 7. 检查监听端口
echo -e "\n${YELLOW}7. 检查后端监听端口：${NC}"
docker exec bastion-backend netstat -tuln | grep 8080 || echo -e "${RED}后端未监听8080端口${NC}"

# 8. 检查WebSocket路由注册
echo -e "\n${YELLOW}8. 检查后端WebSocket路由：${NC}"
docker logs bastion-backend 2>&1 | grep -i "monitor\|websocket" | tail -10

echo -e "\n${YELLOW}==================================="
echo "诊断完成"
echo "===================================${NC}"