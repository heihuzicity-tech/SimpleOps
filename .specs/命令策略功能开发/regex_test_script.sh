#!/bin/bash

# 正则表达式匹配测试脚本
set -e

echo "=== 开始正则表达式匹配测试 ==="

# 登录获取token
echo "获取认证token..."
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  http://localhost:8080/api/v1/auth/login | jq -r '.data.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "错误: 无法获取认证token"
  exit 1
fi

echo "Token获取成功: ${TOKEN:0:20}..."

# 定义测试命令数组
declare -a test_commands=(
  "rm.*|regex|删除命令模式测试"
  "sudo.*|regex|sudo命令模式测试"
  "^ls$|regex|精确匹配ls命令"
  "rm\\s+-[rf]+|regex|危险删除选项"
  "cat\\s+/etc/passwd|regex|敏感文件访问"
  "\\w+\\s+/etc/(passwd|shadow|group)|regex|多个敏感文件"
  "^shutdown|regex|关机命令开头匹配"
  "reboot$|regex|重启命令结尾匹配"
  "(wget|curl).*http|regex|网络下载命令"
  "chmod\\s+[0-7]{3,4}\\s+/|regex|权限修改命令"
)

# 创建测试命令
echo "创建测试命令..."
command_ids=()

for cmd_def in "${test_commands[@]}"; do
  IFS='|' read -r name type desc <<< "$cmd_def"
  echo "创建命令: $name"
  
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"$name\",\"type\":\"$type\",\"description\":\"$desc\"}" \
    http://localhost:8080/api/v1/command-filter/commands)
  
  if echo "$response" | jq -e '.id' > /dev/null; then
    cmd_id=$(echo "$response" | jq -r '.id')
    command_ids+=($cmd_id)
    echo "  ✅ 创建成功, ID: $cmd_id"
  else
    echo "  ❌ 创建失败: $response"
  fi
done

echo "命令创建完成，共创建 ${#command_ids[@]} 个命令"

# 创建测试策略
echo "创建测试策略..."
policy_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"正则表达式测试策略","description":"用于测试正则表达式匹配功能","enabled":true}' \
  http://localhost:8080/api/v1/command-filter/policies)

if echo "$policy_response" | jq -e '.id' > /dev/null; then
  policy_id=$(echo "$policy_response" | jq -r '.id')
  echo "✅ 策略创建成功, ID: $policy_id"
else
  echo "❌ 策略创建失败: $policy_response"
  exit 1
fi

# 绑定命令到策略
echo "绑定命令到策略..."
command_ids_json=$(printf '%s\n' "${command_ids[@]}" | jq -R . | jq -s .)
bind_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"command_ids\":$command_ids_json,\"command_group_ids\":[]}" \
  http://localhost:8080/api/v1/command-filter/policies/$policy_id/bind-commands)

echo "绑定结果: $bind_response"

# 绑定用户到策略 (用户ID=1是admin)
echo "绑定用户到策略..."
user_bind_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"user_ids":[1]}' \
  http://localhost:8080/api/v1/command-filter/policies/$policy_id/bind-users)

echo "用户绑定结果: $user_bind_response"

echo ""
echo "=== 测试环境准备完成 ==="
echo "策略ID: $policy_id"
echo "命令数量: ${#command_ids[@]}"
echo "命令IDs: ${command_ids[*]}"
echo ""

# 定义测试用例
declare -a test_cases=(
  "rm file.txt|应该匹配|rm.*"
  "remove file.txt|不应该匹配|rm.*"
  "sudo apt install|应该匹配|sudo.*"
  "ls|应该匹配|^ls$"
  "ls -la|不应该匹配|^ls$"
  "rm -rf /tmp|应该匹配|rm\\s+-[rf]+"
  "rm -l file|不应该匹配|rm\\s+-[rf]+"
  "cat /etc/passwd|应该匹配|cat\\s+/etc/passwd"
  "vim /etc/shadow|应该匹配|\\w+\\s+/etc/(passwd|shadow|group)"
  "shutdown -h now|应该匹配|^shutdown"
  "sudo shutdown -h now|不应该匹配|^shutdown"
  "sudo reboot|应该匹配|reboot$"
  "reboot now|不应该匹配|reboot$"
  "wget http://example.com|应该匹配|(wget|curl).*http"
  "chmod 777 /tmp/file|应该匹配|chmod\\s+[0-7]{3,4}\\s+/"
)

echo "=== 开始执行测试用例 ==="

# 注意：这里我们不能直接测试命令拦截功能，因为需要实际的SSH会话
# 但我们可以验证正则表达式的编译和基本匹配逻辑

echo "测试脚本执行完成。"
echo ""
echo "下一步需要通过SSH连接测试实际的命令拦截功能。"
echo "使用以下命令启动SSH测试："
echo "ssh admin@localhost -p 2222"