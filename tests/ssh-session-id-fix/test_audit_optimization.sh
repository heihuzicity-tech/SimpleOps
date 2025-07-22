#!/bin/bash

# 测试审计策略优化效果
echo "🔍 测试审计策略优化效果..."

# 1. 登录获取token
echo "1. 正在登录获取JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.access_token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取token"
  exit 1
fi

echo "✅ 登录成功"

# 2. 记录当前操作日志数量
echo -e "\n2. 记录当前操作日志数量..."
mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "SELECT COUNT(*) as count FROM operation_logs;" 2>/dev/null | tail -1 > /tmp/audit_count_before.txt
BEFORE_COUNT=$(cat /tmp/audit_count_before.txt)
echo "优化前操作日志数量: $BEFORE_COUNT"

# 3. 执行多个GET请求（应该不被记录）
echo -e "\n3. 执行多个GET请求（应该不被记录）..."

echo "  - 查询资产列表"
curl -s -X GET "http://localhost:8080/api/v1/assets/" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "  - 查询用户信息"
curl -s -X GET "http://localhost:8080/api/v1/profile" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "  - 查询审计日志"
curl -s -X GET "http://localhost:8080/api/v1/audit/operation-logs" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

# 4. 执行一个POST请求（应该被记录）
echo -e "\n4. 执行POST请求（应该被记录）..."
curl -s -X POST "http://localhost:8080/api/v1/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "audit-test-optimized",
    "type": "server", 
    "os_type": "linux",
    "address": "10.0.0.101",
    "port": 22,
    "protocol": "ssh",
    "description": "测试审计优化的服务器"
  }' > /dev/null

echo "POST请求已发送"

# 5. 等待审计日志写入
echo -e "\n5. 等待审计日志写入..."
sleep 3

# 6. 检查操作日志变化
echo -e "\n6. 检查操作日志变化..."
mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "SELECT COUNT(*) as count FROM operation_logs;" 2>/dev/null | tail -1 > /tmp/audit_count_after.txt
AFTER_COUNT=$(cat /tmp/audit_count_after.txt)
echo "优化后操作日志数量: $AFTER_COUNT"

# 7. 验证结果
echo -e "\n7. 验证结果..."
DIFF_COUNT=$((AFTER_COUNT - BEFORE_COUNT))

if [ "$DIFF_COUNT" -eq 1 ]; then
  echo "✅ 审计策略优化成功！"
  echo "  - GET请求未被记录（符合预期）"
  echo "  - POST请求被正确记录"
  echo "  - 日志增量: $DIFF_COUNT 条（仅POST操作）"
  
  # 显示最新的操作日志
  echo -e "\n最新记录的操作日志:"
  mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "
    SELECT id, username, method, url, action, resource, status, created_at 
    FROM operation_logs 
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
    ORDER BY created_at DESC;" 2>/dev/null
    
elif [ "$DIFF_COUNT" -eq 0 ]; then
  echo "⚠️  没有新的操作日志记录"
  echo "可能原因："
  echo "  - POST请求失败"
  echo "  - 审计中间件配置问题"
  
elif [ "$DIFF_COUNT" -gt 3 ]; then
  echo "❌ 审计优化可能未生效"
  echo "日志增量过多: $DIFF_COUNT 条"
  echo "可能仍在记录GET请求"
else
  echo "⚠️  记录了 $DIFF_COUNT 条日志"
  echo "需要检查具体记录内容"
fi

# 清理临时文件
rm -f /tmp/audit_count_*.txt

echo -e "\n🎯 测试完成！"