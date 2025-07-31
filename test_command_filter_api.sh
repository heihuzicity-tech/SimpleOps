#!/bin/bash

# 测试命令过滤 API 端点

echo "测试命令过滤 API 端点..."

# 设置基础 URL
BASE_URL="http://localhost:8080/api/v1"

# 获取 token（假设已经有用户登录）
# 这里需要您提供一个有效的 token 或者先执行登录
TOKEN="${AUTH_TOKEN:-}"

if [ -z "$TOKEN" ]; then
    echo "请设置 AUTH_TOKEN 环境变量或修改脚本中的 TOKEN 值"
    echo "例如: export AUTH_TOKEN='your-jwt-token'"
    exit 1
fi

echo "使用 Token: ${TOKEN:0:20}..."

# 测试命令组列表 API
echo -e "\n1. 测试获取命令组列表..."
curl -X GET "${BASE_URL}/command-filter/groups?page=1&page_size=10" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n"

# 测试过滤规则列表 API
echo -e "\n2. 测试获取过滤规则列表..."
curl -X GET "${BASE_URL}/command-filter/filters?page=1&page_size=10" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n"

echo -e "\n测试完成！"