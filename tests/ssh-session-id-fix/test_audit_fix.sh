#!/bin/bash

# 测试审计中间件修复是否有效
echo "🔍 测试审计中间件修复..."

# 1. 登录获取token
echo "1. 正在登录获取JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

echo "登录响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.access_token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取token"
  exit 1
fi

echo "✅ 登录成功，获取到token: ${TOKEN:0:50}..."

# 2. 记录当前操作日志数量
echo -e "\n2. 记录当前操作日志数量..."
mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "SELECT COUNT(*) as count FROM operation_logs;" 2>/dev/null | tail -1 > /tmp/audit_count_before.txt
BEFORE_COUNT=$(cat /tmp/audit_count_before.txt)
echo "修复前操作日志数量: $BEFORE_COUNT"

# 3. 执行需要认证的API操作
echo -e "\n3. 执行资产列表查询操作..."
ASSETS_RESPONSE=$(curl -s -X GET http://localhost:8080/api/v1/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "资产查询响应状态: $(echo $ASSETS_RESPONSE | jq -r '.success' 2>/dev/null || echo '响应格式错误')"

# 4. 等待审计日志写入（异步操作）
echo -e "\n4. 等待审计日志写入..."
sleep 3

# 5. 检查操作日志是否增加
echo -e "\n5. 检查操作日志是否增加..."
mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "SELECT COUNT(*) as count FROM operation_logs;" 2>/dev/null | tail -1 > /tmp/audit_count_after.txt
AFTER_COUNT=$(cat /tmp/audit_count_after.txt)
echo "修复后操作日志数量: $AFTER_COUNT"

# 6. 验证结果
echo -e "\n6. 验证结果..."
if [ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]; then
  echo "✅ 审计中间件修复成功！操作日志从 $BEFORE_COUNT 增加到 $AFTER_COUNT"
  
  # 显示最新的操作日志
  echo -e "\n最新的操作日志记录:"
  mysql -h 10.0.0.7 -u root -ppassword123 bastion -e "
    SELECT id, username, method, url, action, resource, status, created_at 
    FROM operation_logs 
    ORDER BY created_at DESC 
    LIMIT 5;" 2>/dev/null
else
  echo "❌ 审计中间件可能未正常工作，操作日志数量未增加"
  echo "可能原因："
  echo "  - 审计配置未启用"
  echo "  - 数据库连接问题"
  echo "  - 中间件配置错误"
fi

# 清理临时文件
rm -f /tmp/audit_count_*.txt

echo -e "\n🎯 测试完成！"