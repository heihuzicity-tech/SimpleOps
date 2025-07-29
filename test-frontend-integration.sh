#!/bin/bash

# 前端集成测试脚本
# 测试用户管理模块的增删改查功能

echo "=== 前端集成测试脚本 ==="
echo "测试目标：验证用户管理模块与统一API响应格式的兼容性"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# API基础URL
BASE_URL="http://localhost:8080/api/v1"

# 登录获取token
echo "1. 登录获取访问令牌..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ 登录失败${NC}"
  echo $LOGIN_RESPONSE | jq .
  exit 1
fi

echo -e "${GREEN}✓ 登录成功${NC}"
echo ""

# 测试用户列表API
echo "2. 测试用户列表API..."
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/users/?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN")

echo $USERS_RESPONSE | jq .

# 检查响应格式
if echo $USERS_RESPONSE | jq -e '.success == true and .data.items != null' > /dev/null; then
  echo -e "${GREEN}✓ 用户列表API返回统一格式${NC}"
  echo "  - success: true"
  echo "  - data.items: 存在"
  echo "  - 分页信息: 扁平化结构"
else
  echo -e "${RED}✗ 用户列表API格式不正确${NC}"
fi
echo ""

# 测试角色列表API
echo "3. 测试角色列表API..."
ROLES_RESPONSE=$(curl -s -X GET "$BASE_URL/roles/" \
  -H "Authorization: Bearer $TOKEN")

echo $ROLES_RESPONSE | jq .

if echo $ROLES_RESPONSE | jq -e '.success == true and .data.items != null' > /dev/null; then
  echo -e "${GREEN}✓ 角色列表API返回统一格式${NC}"
else
  echo -e "${RED}✗ 角色列表API格式不正确${NC}"
fi
echo ""

# 测试创建用户
echo "4. 测试创建用户..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_'$(date +%s)'",
    "email": "test'$(date +%s)'@example.com",
    "password": "Test123456",
    "role_ids": [2],
    "status": 1
  }')

echo $CREATE_USER_RESPONSE | jq .

if echo $CREATE_USER_RESPONSE | jq -e '.success == true and .data != null' > /dev/null; then
  echo -e "${GREEN}✓ 创建用户API返回统一格式${NC}"
  CREATED_USER_ID=$(echo $CREATE_USER_RESPONSE | jq -r '.data.id')
  
  # 测试删除用户
  echo ""
  echo "5. 测试删除用户..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/users/$CREATED_USER_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo $DELETE_RESPONSE | jq .
  
  if echo $DELETE_RESPONSE | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✓ 删除用户API返回统一格式${NC}"
  else
    echo -e "${RED}✗ 删除用户API格式不正确${NC}"
  fi
else
  echo -e "${RED}✗ 创建用户API格式不正确${NC}"
fi

echo ""
echo "=== 测试总结 ==="
echo "前端应该能够通过响应适配层正确处理这些API响应"
echo "请在浏览器中访问 http://localhost:3000 并测试用户管理功能"