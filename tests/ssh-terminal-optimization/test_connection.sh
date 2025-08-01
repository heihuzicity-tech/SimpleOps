#!/bin/bash

# 测试连接脚本

if [ -z "$AUTH_TOKEN" ]; then
    echo "请设置AUTH_TOKEN环境变量"
    exit 1
fi

echo "测试API连接..."

# 获取资产列表
echo -e "\n1. 获取资产列表："
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/v1/assets | python3 -m json.tool 2>/dev/null || \
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/v1/assets

# 获取当前用户信息
echo -e "\n\n2. 获取当前用户信息："
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/v1/me | python3 -m json.tool 2>/dev/null || \
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/v1/me

echo -e "\n"