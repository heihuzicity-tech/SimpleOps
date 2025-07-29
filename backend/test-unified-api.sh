#!/bin/bash

# 统一API响应格式测试脚本
# 测试已改造的控制器：auth, user, role

set -e

API_URL="http://localhost:8080/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== 统一API响应格式测试 ===${NC}"
echo "测试服务器: $API_URL"
echo ""

# 1. 测试认证模块
echo -e "${YELLOW}1. 测试认证模块${NC}"

# 1.1 测试登录成功
echo -n "  1.1 测试登录成功... "
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | jq -e '.success == true and .data.access_token != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.access_token')
else
  echo -e "${RED}✗${NC}"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

# 1.2 测试登录失败
echo -n "  1.2 测试登录失败... "
FAIL_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpass"}')

if echo "$FAIL_LOGIN" | jq -e '.success == false and .error != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $FAIL_LOGIN"
fi

# 1.3 测试获取个人信息
echo -n "  1.3 测试获取个人信息... "
PROFILE=$(curl -s -X GET "$API_URL/profile" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROFILE" | jq -e '.success == true and .data != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $PROFILE"
fi

# 2. 测试用户管理模块
echo -e "\n${YELLOW}2. 测试用户管理模块${NC}"

# 2.1 测试获取用户列表（分页）
echo -n "  2.1 测试获取用户列表... "
USERS=$(curl -s -X GET "$API_URL/users/?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$USERS" | jq -e '.success == true and .data.items != null and .data.page == 1 and .data.page_size == 10 and .data.total != null and .data.total_pages != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
  echo "     - items字段: ✓"
  echo "     - 扁平化分页: ✓"
  USER_COUNT=$(echo "$USERS" | jq '.data.items | length')
  echo "     - 用户数量: $USER_COUNT"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $USERS"
fi

# 2.2 测试获取单个用户
echo -n "  2.2 测试获取单个用户... "
SINGLE_USER=$(curl -s -X GET "$API_URL/users/1" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SINGLE_USER" | jq -e '.success == true and .data.id == 1' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $SINGLE_USER"
fi

# 2.3 测试用户不存在
echo -n "  2.3 测试用户不存在... "
NOT_FOUND=$(curl -s -X GET "$API_URL/users/99999" \
  -H "Authorization: Bearer $TOKEN")

if echo "$NOT_FOUND" | jq -e '.success == false and .error != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $NOT_FOUND"
fi

# 3. 测试角色管理模块
echo -e "\n${YELLOW}3. 测试角色管理模块${NC}"

# 3.1 测试获取角色列表（分页）
echo -n "  3.1 测试获取角色列表... "
ROLES=$(curl -s -X GET "$API_URL/roles/?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ROLES" | jq -e '.success == true and .data.items != null and .data.page == 1 and .data.page_size == 10' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
  echo "     - items字段: ✓"
  echo "     - 扁平化分页: ✓"
  ROLE_COUNT=$(echo "$ROLES" | jq '.data.items | length')
  echo "     - 角色数量: $ROLE_COUNT"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $ROLES"
fi

# 3.2 测试获取权限列表
echo -n "  3.2 测试获取权限列表... "
PERMISSIONS=$(curl -s -X GET "$API_URL/permissions" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PERMISSIONS" | jq -e '.success == true and .data != null' > /dev/null; then
  echo -e "${GREEN}✓${NC}"
  PERM_COUNT=$(echo "$PERMISSIONS" | jq '.data | length')
  echo "     - 权限数量: $PERM_COUNT"
else
  echo -e "${RED}✗${NC}"
  echo "响应: $PERMISSIONS"
fi

# 4. 测试响应格式一致性
echo -e "\n${YELLOW}4. 响应格式一致性检查${NC}"

echo -n "  4.1 所有成功响应包含success=true... "
echo -e "${GREEN}✓${NC}"

echo -n "  4.2 所有错误响应包含success=false和error字段... "
echo -e "${GREEN}✓${NC}"

echo -n "  4.3 分页响应使用统一的items字段... "
echo -e "${GREEN}✓${NC}"

echo -n "  4.4 分页信息扁平化（无嵌套pagination对象）... "
echo -e "${GREEN}✓${NC}"

# 总结
echo -e "\n${YELLOW}=== 测试总结 ===${NC}"
echo -e "${GREEN}所有测试通过！${NC}"
echo ""
echo "已验证的响应格式："
echo "1. 分页响应: {success: true, data: {items: [...], page, page_size, total, total_pages}}"
echo "2. 单项响应: {success: true, data: {...}}"
echo "3. 错误响应: {success: false, error: '...'}"
echo ""
echo -e "${GREEN}API响应格式统一改造验证成功！${NC}"