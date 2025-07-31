#!/bin/bash

# 测试命令审计API响应格式

echo "=== 测试命令审计API响应格式 ==="
echo ""

# API基础URL
API_URL="http://localhost:8080/api/v1"

# 测试用的token（需要先登录获取）
echo "1. 登录获取token..."
LOGIN_RESPONSE=$(curl --noproxy localhost -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "登录失败，请检查用户名密码"
  exit 1
fi

echo "登录成功，获取到token"
echo ""

# 测试获取命令日志列表
echo "2. 测试 GET /api/audit/command-logs"
echo "请求URL: ${API_URL}/audit/command-logs?page=1&page_size=10"
echo "响应内容:"
curl --noproxy localhost -s -X GET "${API_URL}/audit/command-logs?page=1&page_size=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "3. 检查响应格式结构"
RESPONSE=$(curl --noproxy localhost -s -X GET "${API_URL}/audit/command-logs?page=1&page_size=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

# 检查关键字段
echo -n "- 包含 success 字段: "
echo $RESPONSE | jq -e '.success' > /dev/null && echo "✓" || echo "✗"

echo -n "- 包含 data 字段: "
echo $RESPONSE | jq -e '.data' > /dev/null && echo "✓" || echo "✗"

echo -n "- 包含 data.items 字段: "
echo $RESPONSE | jq -e '.data.items' > /dev/null && echo "✓" || echo "✗"

echo -n "- 包含分页信息 (page, page_size, total, total_pages): "
echo $RESPONSE | jq -e '.data | has("page") and has("page_size") and has("total") and has("total_pages")' > /dev/null && echo "✓" || echo "✗"

echo ""
echo "4. 测试获取单个命令日志详情（如果有数据）"
FIRST_ID=$(echo $RESPONSE | jq -r '.data.items[0].id // empty')

if [ -n "$FIRST_ID" ]; then
  echo "请求URL: ${API_URL}/audit/command-logs/${FIRST_ID}"
  echo "响应内容:"
  curl --noproxy localhost -s -X GET "${API_URL}/audit/command-logs/${FIRST_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" | jq '.'
else
  echo "暂无命令日志数据，跳过详情测试"
fi

echo ""
echo "=== 测试完成 ==="