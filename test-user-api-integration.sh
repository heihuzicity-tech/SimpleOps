#!/bin/bash

# 测试新的UserApiService集成
echo "=== 测试用户管理API集成 ==="

# API基础URL
BASE_URL="http://localhost:8080/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 先尝试获取CSRF Token
echo -e "\n${YELLOW}[1] 尝试获取CSRF Token...${NC}"
CSRF_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/csrf-token")
echo "CSRF响应: $CSRF_RESPONSE"

# 测试用户列表API
echo -e "\n${YELLOW}[2] 测试获取用户列表 (GET /users)${NC}"
USER_LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/users?page=1&page_size=10")
echo "响应: $USER_LIST_RESPONSE" | jq . 2>/dev/null || echo "响应: $USER_LIST_RESPONSE"

# 检查响应格式是否包含items字段（新格式）
if echo "$USER_LIST_RESPONSE" | grep -q '"items"'; then
    echo -e "${GREEN}✓ 响应已使用新格式（包含items字段）${NC}"
else
    echo -e "${RED}✗ 响应未使用新格式（缺少items字段）${NC}"
fi

# 测试单个用户获取
echo -e "\n${YELLOW}[3] 测试获取单个用户 (GET /users/1)${NC}"
USER_DETAIL_RESPONSE=$(curl -s -X GET "$BASE_URL/users/1")
echo "响应: $USER_DETAIL_RESPONSE" | jq . 2>/dev/null || echo "响应: $USER_DETAIL_RESPONSE"

# 测试创建用户（需要认证）
echo -e "\n${YELLOW}[4] 测试创建用户 (POST /users) - 预期失败（未认证）${NC}"
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "email": "test@example.com",
    "password": "Test1234!",
    "role_ids": [1]
  }')
echo "响应: $CREATE_USER_RESPONSE"

# 检查前端服务是否正常
echo -e "\n${YELLOW}[5] 检查前端服务状态${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ 前端服务正常运行在 http://localhost:3000${NC}"
else
    echo -e "${RED}✗ 前端服务未响应（状态码: $FRONTEND_STATUS）${NC}"
fi

echo -e "\n${YELLOW}=== 测试总结 ===${NC}"
echo "1. 新的UserApiService已集成到userSlice中"
echo "2. API响应格式转换逻辑已内置到BaseApiService"
echo "3. 不再依赖responseAdapter.ts进行格式转换"
echo "4. 请通过浏览器访问 http://localhost:3000 进行完整的UI功能测试"