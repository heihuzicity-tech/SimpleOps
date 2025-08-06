#!/bin/bash

# 获取管理员token的脚本
API_URL="http://47.115.133.178:8080"

# 登录获取token
response=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

# 提取token (macOS兼容版本)
token=$(echo "$response" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

if [ -n "$token" ]; then
  echo "Token获取成功："
  echo "$token"
  echo ""
  echo "测试WebSocket URL："
  echo "ws://47.115.133.178:8080/api/v1/ws/monitor?token=${token}"
else
  echo "Token获取失败，响应："
  echo "$response"
fi