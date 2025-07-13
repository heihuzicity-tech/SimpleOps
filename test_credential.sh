#!/bin/bash

# 获取JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H "Content-Type: application/json" -d '{"username": "admin", "password": "admin123"}' | jq -r '.data.access_token')

echo "Token: $TOKEN"

# 测试凭证创建
echo "Testing credential creation..."
curl -s -X POST http://localhost:8080/api/v1/credentials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "测试凭证",
    "type": "password",
    "username": "testuser",
    "password": "testpass123",
    "asset_id": 1
  }' | jq 