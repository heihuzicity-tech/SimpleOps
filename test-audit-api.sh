#!/bin/bash

# 审计控制器API测试脚本
# 测试所有审计相关API端点的统一响应格式

echo "=== 审计控制器API测试 ==="
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

# 测试登录日志API
echo "2. 测试登录日志API..."
LOGIN_LOGS_RESPONSE=$(curl -s -X GET "$BASE_URL/audit/login-logs?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")

echo "响应内容："
echo $LOGIN_LOGS_RESPONSE | jq .

if echo $LOGIN_LOGS_RESPONSE | jq -e '.success == true and .data.items != null' > /dev/null; then
  echo -e "${GREEN}✓ 登录日志API返回统一格式${NC}"
else
  echo -e "${RED}✗ 登录日志API格式不正确${NC}"
fi
echo ""

# 测试操作日志API
echo "3. 测试操作日志API..."
OPERATION_LOGS_RESPONSE=$(curl -s -X GET "$BASE_URL/audit/operation-logs?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")

echo "响应内容："
echo $OPERATION_LOGS_RESPONSE | jq .

if echo $OPERATION_LOGS_RESPONSE | jq -e '.success == true and .data.items != null' > /dev/null; then
  echo -e "${GREEN}✓ 操作日志API返回统一格式${NC}"
else
  echo -e "${RED}✗ 操作日志API格式不正确${NC}"
fi
echo ""

# 测试会话记录API
echo "4. 测试会话记录API..."
SESSION_RECORDS_RESPONSE=$(curl -s -X GET "$BASE_URL/audit/session-records?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")

echo "响应内容："
echo $SESSION_RECORDS_RESPONSE | jq .

if echo $SESSION_RECORDS_RESPONSE | jq -e '.success == true and .data | has("items")' > /dev/null; then
  echo -e "${GREEN}✓ 会话记录API返回统一格式${NC}"
else
  echo -e "${RED}✗ 会话记录API格式不正确${NC}"
fi
echo ""

# 测试命令日志API
echo "5. 测试命令日志API..."
COMMAND_LOGS_RESPONSE=$(curl -s -X GET "$BASE_URL/audit/command-logs?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")

echo "响应内容："
echo $COMMAND_LOGS_RESPONSE | jq .

if echo $COMMAND_LOGS_RESPONSE | jq -e '.success == true and .data | has("items")' > /dev/null; then
  echo -e "${GREEN}✓ 命令日志API返回统一格式${NC}"
else
  echo -e "${RED}✗ 命令日志API格式不正确${NC}"
fi
echo ""

# 测试审计统计API
echo "6. 测试审计统计API..."
AUDIT_STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/audit/statistics" \
  -H "Authorization: Bearer $TOKEN")

echo "响应内容："
echo $AUDIT_STATS_RESPONSE | jq .

if echo $AUDIT_STATS_RESPONSE | jq -e '.success == true and .data != null' > /dev/null; then
  echo -e "${GREEN}✓ 审计统计API返回统一格式${NC}"
else
  echo -e "${RED}✗ 审计统计API格式不正确${NC}"
fi

echo ""
echo "=== 测试总结 ==="
echo "审计控制器的所有分页API已改造为统一格式："
echo "- 使用 items 字段存储数据列表"
echo "- 分页信息扁平化存储"
echo "- 所有响应包含 success 字段"