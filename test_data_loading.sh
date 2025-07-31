#!/bin/bash

# 测试数据加载 API

echo "测试用户和资产数据加载..."

# 设置基础 URL
BASE_URL="http://localhost:8080/api/v1"

# 获取 token（需要先登录）
echo "1. 登录获取 token..."
TOKEN=$(curl -s -X POST "${BASE_URL}/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}' | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "登录失败，请检查用户名密码"
    exit 1
fi

echo "登录成功，Token: ${TOKEN:0:20}..."

# 测试用户列表 API
echo -e "\n2. 测试获取用户列表..."
echo "请求: GET ${BASE_URL}/users?page=1&page_size=100"
curl -s -X GET "${BASE_URL}/users?page=1&page_size=100" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" | jq '.data | {total, page_size, user_count: (.users | length), first_user: .users[0].username}'

# 测试资产列表 API
echo -e "\n3. 测试获取资产列表..."
echo "请求: GET ${BASE_URL}/assets?page=1&page_size=100"
curl -s -X GET "${BASE_URL}/assets?page=1&page_size=100" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" | jq '.data | {total, page_size, asset_count: (.assets | length), first_asset: .assets[0].name}'

# 测试命令组列表 API
echo -e "\n4. 测试获取命令组列表..."
echo "请求: GET ${BASE_URL}/command-filter/groups?page=1&page_size=10"
curl -s -X GET "${BASE_URL}/command-filter/groups?page=1&page_size=10" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" | jq '.data | {total, page_size, group_count: (.items | length)}'

echo -e "\n测试完成！"