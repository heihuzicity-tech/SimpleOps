# 被阻止命令记录功能测试

## 问题描述
之前被阻止的命令（如 'rm -rf'）虽然在终端中被成功阻止，但没有被记录到命令审计日志中。

## 修复内容
修改了 `/Users/skip/workspace/bastion/backend/controllers/ssh_controller.go` 中的命令处理逻辑：

### 修复前的问题
- 只有当 `matchResult.Matched` 为 `true` 时才记录命令
- 被阻止的命令如果因为其他原因被阻止，可能不会被记录

### 修复后的逻辑
- **只记录被阻断的命令**，符合用户需求
- 当 `!allowed` 时（命令被阻止），立即记录到审计日志
- 记录信息包括：
  - 命令内容
  - 阻断原因："Command blocked by filter rule"
  - 退出码：1（表示失败）
  - 动作：从匹配结果获取，默认为 "deny"

## 测试步骤

### 1. 确保有命令过滤规则
检查数据库中是否有针对 `rm -rf` 的过滤规则：
```sql
SELECT * FROM command_filters WHERE action = 'deny';
SELECT * FROM command_group_items WHERE content LIKE '%rm%';
```

### 2. 测试被阻止的命令
1. 启动后端服务
2. 创建SSH会话
3. 在终端中输入被禁止的命令，如：
   - `rm -rf /tmp/test`
   - `shutdown now`
   - `reboot`

### 3. 验证审计日志
检查命令是否被正确记录：
```sql
SELECT * FROM command_logs WHERE action = 'deny' ORDER BY created_at DESC;
```

### 4. 预期结果
- 被阻止的命令应该出现在审计日志中
- `action` 字段应该为 "deny" 或匹配规则中定义的动作
- `output` 字段应该包含 "Command blocked by filter rule"
- `exit_code` 应该为 1

## 代码变更摘要

**文件**: `/Users/skip/workspace/bastion/backend/controllers/ssh_controller.go`

**变更**:
- 将命令记录逻辑从 `if matchResult.Matched` 块移动到 `if !allowed` 块中
- 确保只有被阻断的命令才会被记录到审计日志
- 添加了详细的阻断信息记录

这样修复后，所有被阻止的命令都会被正确记录到审计日志中，满足安全审计要求。