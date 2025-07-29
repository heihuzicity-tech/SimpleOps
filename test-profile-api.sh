#!/bin/bash

# 测试用户Profile接口是否返回角色信息

BASE_URL="http://localhost:8080/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 先登录获取token
echo -e "${BLUE}=== 测试用户登录 ===${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

echo "登录响应："
echo "$LOGIN_RESPONSE" | jq .

# 提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}登录失败，无法获取token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 成功获取token${NC}"
echo

# 2. 测试获取用户Profile
echo -e "${BLUE}=== 测试获取用户Profile ===${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "Profile原始响应："
echo "$PROFILE_RESPONSE"
echo
echo "Profile格式化响应："
echo "$PROFILE_RESPONSE" | jq . 2>/dev/null || echo "无法解析JSON"

# 检查响应中是否包含roles字段
if echo "$PROFILE_RESPONSE" | jq -e '.data.roles' > /dev/null 2>&1; then
  ROLES=$(echo "$PROFILE_RESPONSE" | jq '.data.roles')
  if [ "$ROLES" != "null" ] && [ "$ROLES" != "[]" ]; then
    echo -e "${GREEN}✓ Profile接口正确返回了roles字段${NC}"
    echo "用户角色："
    echo "$ROLES" | jq .
  else
    echo -e "${YELLOW}⚠ Profile接口返回了roles字段，但内容为空${NC}"
  fi
else
  echo -e "${RED}✗ Profile接口未返回roles字段${NC}"
fi

# 3. 直接检查后端日志中的数据结构
echo
echo -e "${BLUE}=== 分析响应数据结构 ===${NC}"
echo "$PROFILE_RESPONSE" | jq '.data | keys'