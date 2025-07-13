# 基础审计系统功能测试指南

## 测试环境信息
- 后端服务地址: http://localhost:8080
- 数据库: MySQL 8.0 (10.0.0.7:3306)
- 测试用户: admin/admin123

## 1. 审计系统概述

基础审计系统已完成开发，包含以下功能：

### 1.1 主要功能
- **登录日志**: 记录用户登录、登出和登录失败记录
- **操作日志**: 记录用户在系统中的所有操作行为
- **会话记录**: 记录用户的SSH/RDP等会话信息
- **命令日志**: 记录用户在会话中执行的命令

### 1.2 数据库表结构
- `login_logs`: 登录日志表
- `operation_logs`: 操作日志表
- `session_records`: 会话记录表
- `command_logs`: 命令日志表

### 1.3 API接口
- 登录日志查询: `GET /api/v1/audit/login-logs`
- 操作日志查询: `GET /api/v1/audit/operation-logs`
- 会话记录查询: `GET /api/v1/audit/session-records`
- 命令日志查询: `GET /api/v1/audit/command-logs`
- 审计统计: `GET /api/v1/audit/statistics`

## 2. 功能测试步骤

### 2.1 启动服务

```bash
cd backend
./bastion
```

### 2.2 测试登录日志功能

#### 2.2.1 测试成功登录
```bash
# 正常登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

#### 2.2.2 测试失败登录
```bash
# 错误密码登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "wrongpassword"
  }'
```

#### 2.2.3 查看登录日志
```bash
# 获取JWT Token后查看登录日志
curl -X GET http://localhost:8080/api/v1/audit/login-logs \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2.3 测试操作日志功能

#### 2.3.1 执行一些操作
```bash
# 查看用户列表（会产生操作日志）
curl -X GET http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 查看资产列表（会产生操作日志）
curl -X GET http://localhost:8080/api/v1/assets \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

#### 2.3.2 查看操作日志
```bash
curl -X GET http://localhost:8080/api/v1/audit/operation-logs \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2.4 测试会话记录功能

#### 2.4.1 创建SSH会话
```bash
# 创建SSH会话到测试服务器
curl -X POST http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": 1,
    "credential_id": 1,
    "protocol": "ssh",
    "width": 80,
    "height": 24
  }'
```

#### 2.4.2 查看会话记录
```bash
curl -X GET http://localhost:8080/api/v1/audit/session-records \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### 2.5 测试审计统计功能

```bash
# 获取审计统计数据
curl -X GET http://localhost:8080/api/v1/audit/statistics \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## 3. 预期测试结果

### 3.1 登录日志预期结果
- 成功登录应产生status为"success"的记录
- 失败登录应产生status为"failed"的记录
- 登出应产生status为"logout"的记录
- 记录包含用户ID、用户名、IP地址、User-Agent等信息

### 3.2 操作日志预期结果
- 每个API请求应产生对应的操作日志记录
- 记录包含用户ID、IP地址、HTTP方法、URL、操作类型、状态码等信息
- 记录请求耗时信息

### 3.3 会话记录预期结果
- SSH会话创建应产生对应的会话记录
- 记录包含会话ID、用户信息、资产信息、协议类型、状态等
- 会话结束时应更新结束时间和持续时间

### 3.4 审计统计预期结果
- 返回各类日志的总数统计
- 返回今天的登录、操作、会话统计
- 返回失败登录、活跃会话、危险命令等统计

## 4. 数据库验证

### 4.1 检查表结构
```sql
-- 检查审计表是否创建成功
SHOW TABLES LIKE '%log%';
SHOW TABLES LIKE '%session%';

-- 检查表结构
DESCRIBE login_logs;
DESCRIBE operation_logs;
DESCRIBE session_records;
DESCRIBE command_logs;
```

### 4.2 检查数据
```sql
-- 检查登录日志数据
SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 10;

-- 检查操作日志数据
SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 10;

-- 检查会话记录数据
SELECT * FROM session_records ORDER BY start_time DESC LIMIT 10;

-- 检查命令日志数据
SELECT * FROM command_logs ORDER BY start_time DESC LIMIT 10;
```

### 4.3 检查统计视图
```sql
-- 查看审计统计
SELECT * FROM audit_statistics;
```

## 5. 权限验证

### 5.1 检查权限配置
```sql
-- 检查审计相关权限
SELECT * FROM permissions WHERE category = 'audit';

-- 检查admin角色的审计权限
SELECT p.name, p.description 
FROM permissions p 
JOIN role_permissions rp ON p.id = rp.permission_id 
JOIN roles r ON rp.role_id = r.id 
WHERE r.name = 'admin' AND p.category = 'audit';
```

### 5.2 测试权限控制
```bash
# 使用非admin用户测试（应该失败）
curl -X GET http://localhost:8080/api/v1/audit/login-logs \
  -H "Authorization: Bearer <NON_ADMIN_TOKEN>"
```

## 6. 测试清理

### 6.1 清理测试数据
```sql
-- 清理测试产生的审计数据
DELETE FROM login_logs WHERE username = 'admin';
DELETE FROM operation_logs WHERE username = 'admin';
DELETE FROM session_records WHERE username = 'admin';
DELETE FROM command_logs WHERE username = 'admin';
```

### 6.2 测试日志清理功能
```bash
# 测试日志清理API
curl -X POST http://localhost:8080/api/v1/audit/cleanup \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## 7. 故障排除

### 7.1 常见问题
1. **权限不足**: 确保使用具有audit:read权限的用户
2. **数据库连接**: 检查数据库配置和连接状态
3. **表不存在**: 确保执行了审计表创建脚本

### 7.2 日志查看
```bash
# 查看应用程序日志
tail -f logs/app.log

# 查看MySQL错误日志
tail -f /var/log/mysql/error.log
```

## 8. 性能考虑

### 8.1 索引优化
- 已为常用查询字段添加索引
- 建议定期分析查询性能并优化索引

### 8.2 数据清理
- 配置适当的日志保留期限
- 定期执行日志清理任务

## 9. 安全注意事项

### 9.1 敏感信息
- 密码等敏感信息已在日志中过滤
- 建议定期审查日志内容，避免敏感信息泄露

### 9.2 访问控制
- 审计日志访问需要相应权限
- 建议定期审查用户权限分配

## 10. 总结

基础审计系统已成功实现以下功能：

✅ **登录日志记录** - 完整记录用户登录、登出和失败登录
✅ **操作日志记录** - 自动记录用户的所有操作行为  
✅ **会话记录管理** - 跟踪SSH会话的完整生命周期
✅ **命令日志记录** - 记录会话中执行的命令（待完善）
✅ **审计查询API** - 提供完整的审计日志查询接口
✅ **统计分析功能** - 提供审计数据的统计分析
✅ **权限控制** - 基于RBAC的审计日志访问控制
✅ **数据库结构** - 完整的审计数据库表结构和索引
✅ **日志清理** - 支持过期日志自动清理

系统已具备完整的审计功能，可以有效监控和记录用户在系统中的所有活动。 