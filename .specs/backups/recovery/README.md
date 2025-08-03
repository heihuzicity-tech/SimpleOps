# Bastion 数据库表结构恢复指南

## 🚨 紧急恢复流程

当Bastion运维堡垒机系统的数据库表结构被误删时，请按照以下步骤进行恢复：

## 📋 前置条件

1. **数据库访问权限**：确保有MySQL数据库的管理员权限
2. **数据库备份**：如有可能，请先备份当前数据库状态
3. **服务停止**：建议停止所有依赖该数据库的服务

## 🔧 恢复步骤

### 第一步：连接数据库

```bash
# 使用MySQL客户端连接数据库
mysql -h <hostname> -u <username> -p

# 或使用项目管理脚本连接
./manage.sh shell db
```

### 第二步：执行恢复脚本

```sql
-- 确保使用正确的数据库
USE bastion;

-- 执行恢复脚本
SOURCE /path/to/bastion/recovery/database_structure_recovery.sql;
```

### 第三步：验证恢复结果

```sql
-- 执行验证脚本
SOURCE /path/to/bastion/recovery/validate_database_structure.sql;
```

## 📊 脚本说明

### database_structure_recovery.sql

这是主要的恢复脚本，包含：

#### 🗃️ 核心表结构
1. **用户权限系统**
   - `users` - 用户表
   - `roles` - 角色表
   - `permissions` - 权限表
   - `user_roles` - 用户角色关联表
   - `role_permissions` - 角色权限关联表

2. **资产管理系统**
   - `asset_groups` - 资产分组表（支持层级）
   - `assets` - 资产表
   - `credentials` - 凭证表
   - `asset_credentials` - 资产凭证关联表

3. **审计日志系统**
   - `login_logs` - 登录日志表
   - `operation_logs` - 操作日志表
   - `session_records` - 会话记录表
   - `command_logs` - 命令日志表

4. **实时监控系统**
   - `session_monitor_logs` - 会话监控日志表
   - `session_warnings` - 会话警告消息表
   - `websocket_connections` - WebSocket连接日志表

#### 🔗 关键特性
- **外键约束**：确保数据完整性
- **索引优化**：提升查询性能
- **字符集**：使用utf8mb4支持完整Unicode
- **默认数据**：包含系统必需的基础数据
- **审计视图**：预置统计查询视图
- **清理程序**：日志清理存储过程

### validate_database_structure.sql

验证脚本确保恢复的完整性：

#### ✅ 检查项目
1. **表结构完整性** - 验证所有必要表是否存在
2. **外键约束** - 检查外键关系是否正确
3. **索引完整性** - 验证重要索引是否存在
4. **数据类型一致性** - 检查字段类型是否正确
5. **默认数据** - 验证基础数据是否完整
6. **关联关系** - 检查表间关系是否正常
7. **存储引擎** - 确认使用InnoDB引擎
8. **性能统计** - 提供表大小和性能信息

## 🎯 恢复后的默认配置

### 默认用户
- **用户名**: `admin`
- **密码**: `admin123`
- **角色**: 系统管理员
- **权限**: 所有权限

### 默认角色
- **admin**: 系统管理员，拥有所有权限
- **operator**: 运维人员，拥有资产连接和查看权限
- **auditor**: 审计员，拥有审计查看权限

### 默认资产分组
- **生产环境**: 生产环境资产分组
- **测试环境**: 测试环境资产分组  
- **开发环境**: 开发环境资产分组
- **通用分组**: 通用资产分组

## ⚠️ 注意事项

### 安全提醒
1. **立即修改默认密码**：恢复后请立即修改admin用户密码
2. **权限检查**：验证各角色权限配置是否符合安全要求
3. **数据加密**：确保敏感数据（如密码、私钥）已正确加密

### 性能优化
1. **索引维护**：大数据量时考虑重建索引
2. **统计更新**：执行 `ANALYZE TABLE` 更新表统计信息
3. **日志清理**：定期使用 `CleanupAuditLogs` 清理历史日志

### 数据恢复
1. **应用数据**：恢复表结构后，需要从备份恢复应用数据
2. **增量同步**：如有必要，同步最新的业务数据
3. **一致性检查**：验证数据完整性和业务逻辑一致性

## 🔧 故障排除

### 常见错误

#### 1. 外键约束错误
```sql
-- 临时禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;
-- 执行恢复脚本
-- 重新启用外键检查
SET FOREIGN_KEY_CHECKS = 1;
```

#### 2. 字符集问题
```sql
-- 检查数据库字符集
SHOW CREATE DATABASE bastion;
-- 修改数据库字符集（如需要）
ALTER DATABASE bastion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 3. 权限不足
```bash
# 确保用户有足够权限
GRANT ALL PRIVILEGES ON bastion.* TO 'username'@'%';
FLUSH PRIVILEGES;
```

### 验证命令

```sql
-- 快速检查表是否存在
SELECT COUNT(*) as table_count FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion';

-- 检查外键数量
SELECT COUNT(*) as fk_count FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'bastion' AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 检查默认用户
SELECT username, email, status FROM users WHERE username = 'admin';
```

## 📞 技术支持

如果在恢复过程中遇到问题：

1. **查看错误日志**：检查MySQL错误日志
2. **验证环境**：确认MySQL版本兼容性
3. **权限检查**：验证数据库用户权限
4. **备份还原**：如有备份，考虑从备份还原

## 🔄 定期维护

恢复完成后，建议：

1. **定期备份**：设置自动数据库备份
2. **监控告警**：配置数据库监控
3. **权限审计**：定期检查用户权限
4. **日志清理**：定期清理历史审计日志

---

**⚡ 紧急提醒**：数据库恢复完成后，请立即：
1. 修改默认管理员密码
2. 检查系统安全配置
3. 验证业务功能正常
4. 通知相关团队恢复完成