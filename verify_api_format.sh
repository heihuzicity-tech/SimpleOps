#!/bin/bash

# 验证API响应格式是否符合统一标准

echo "验证后端API响应格式..."

# 设置基础 URL
BASE_URL="http://localhost:8080/api/v1"

# 先获取一个有效的 token
echo -e "\n1. 获取认证 token..."
# 尝试使用默认的管理员账号
AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"Admin@123"}')

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.data.token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "无法获取 token，请手动设置 AUTH_TOKEN 环境变量"
    echo "使用方法: export AUTH_TOKEN='your-token-here' && $0"
    
    if [ -n "$AUTH_TOKEN" ]; then
        echo "使用环境变量中的 TOKEN..."
        TOKEN="$AUTH_TOKEN"
    else
        exit 1
    fi
fi

echo "Token 获取成功: ${TOKEN:0:20}..."

# 测试用户列表 API
echo -e "\n2. 测试用户列表 API 响应格式..."
echo "请求: GET ${BASE_URL}/users?page=1&page_size=10"
USER_RESPONSE=$(curl -s -X GET "${BASE_URL}/users?page=1&page_size=10" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json")

echo "响应内容:"
echo "$USER_RESPONSE" | jq '.'

# 验证响应格式
echo -e "\n验证用户API响应格式:"
echo "$USER_RESPONSE" | jq -e '.success == true' > /dev/null && echo "✓ success 字段存在且为 true" || echo "✗ success 字段缺失或不为 true"
echo "$USER_RESPONSE" | jq -e '.data.items' > /dev/null && echo "✓ data.items 字段存在" || echo "✗ data.items 字段缺失"
echo "$USER_RESPONSE" | jq -e '.data.page' > /dev/null && echo "✓ data.page 字段存在" || echo "✗ data.page 字段缺失"
echo "$USER_RESPONSE" | jq -e '.data.page_size' > /dev/null && echo "✓ data.page_size 字段存在" || echo "✗ data.page_size 字段缺失"
echo "$USER_RESPONSE" | jq -e '.data.total' > /dev/null && echo "✓ data.total 字段存在" || echo "✗ data.total 字段缺失"
echo "$USER_RESPONSE" | jq -e '.data.total_pages' > /dev/null && echo "✓ data.total_pages 字段存在" || echo "✗ data.total_pages 字段缺失"

# 测试资产列表 API
echo -e "\n3. 测试资产列表 API 响应格式..."
echo "请求: GET ${BASE_URL}/assets?page=1&page_size=10"
ASSET_RESPONSE=$(curl -s -X GET "${BASE_URL}/assets?page=1&page_size=10" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json")

echo "响应内容:"
echo "$ASSET_RESPONSE" | jq '.'

# 验证响应格式
echo -e "\n验证资产API响应格式:"
echo "$ASSET_RESPONSE" | jq -e '.success == true' > /dev/null && echo "✓ success 字段存在且为 true" || echo "✗ success 字段缺失或不为 true"
echo "$ASSET_RESPONSE" | jq -e '.data.items' > /dev/null && echo "✓ data.items 字段存在" || echo "✗ data.items 字段缺失"
echo "$ASSET_RESPONSE" | jq -e '.data.page' > /dev/null && echo "✓ data.page 字段存在" || echo "✗ data.page 字段缺失"
echo "$ASSET_RESPONSE" | jq -e '.data.page_size' > /dev/null && echo "✓ data.page_size 字段存在" || echo "✗ data.page_size 字段缺失"
echo "$ASSET_RESPONSE" | jq -e '.data.total' > /dev/null && echo "✓ data.total 字段存在" || echo "✗ data.total 字段缺失"
echo "$ASSET_RESPONSE" | jq -e '.data.total_pages' > /dev/null && echo "✓ data.total_pages 字段存在" || echo "✗ data.total_pages 字段缺失"

echo -e "\n验证完成！"