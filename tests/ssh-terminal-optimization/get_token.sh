#!/bin/bash

# 获取测试用的认证Token

echo "获取测试认证Token..."

# 测试账号信息
USERNAME="admin"
PASSWORD="admin123"

# 登录获取Token
response=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

# 提取Token
token=$(echo $response | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$token" ]; then
    echo "获取Token失败，响应: $response"
    exit 1
fi

echo "Token获取成功!"
echo ""
echo "请执行以下命令设置环境变量："
echo "export AUTH_TOKEN=\"$token\""
echo ""
echo "或直接运行："
echo "export AUTH_TOKEN=\"$token\" && ./run_tests.sh"