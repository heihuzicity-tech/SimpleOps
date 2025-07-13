#!/bin/bash

# 获取JWT token
echo "获取JWT token..."
RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $RESPONSE | python3 -c "import json,sys; data=json.load(sys.stdin); print(data['data']['access_token'])")

echo "Token获取成功"

# 测试创建资产
echo "测试创建资产..."
ASSET_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试端口修复",
    "type": "server",
    "address": "192.168.1.100",
    "port": 8080,
    "protocol": "ssh",
    "tags": "test-port-fix"
  }')

echo "API原始响应:"
echo "$ASSET_RESPONSE"

echo "测试完成" 