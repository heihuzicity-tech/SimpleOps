-- ========================================
-- 命令过滤功能数据清理脚本 V2
-- 创建时间：2025-01-30
-- 功能：删除旧的命令过滤相关表和数据
-- 警告：此脚本将永久删除所有命令过滤相关数据！
-- ========================================

-- 使用bastion数据库
USE bastion;

-- ========================================
-- 显示即将删除的表和数据统计
-- ========================================
SELECT '=== 清理前数据统计 ===' AS info;
SELECT 'commands' as table_name, COUNT(*) as record_count FROM `commands`
UNION ALL
SELECT 'command_groups', COUNT(*) FROM `command_groups`
UNION ALL
SELECT 'command_group_commands', COUNT(*) FROM `command_group_commands`
UNION ALL
SELECT 'command_policies', COUNT(*) FROM `command_policies`
UNION ALL
SELECT 'policy_users', COUNT(*) FROM `policy_users`
UNION ALL
SELECT 'policy_commands', COUNT(*) FROM `policy_commands`
UNION ALL
SELECT 'command_intercept_logs', COUNT(*) FROM `command_intercept_logs`;

-- ========================================
-- 1. 删除外键约束
-- ========================================
SELECT '=== 开始删除外键约束 ===' AS info;

-- 删除命令拦截日志表的外键
SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- 2. 删除表（按依赖关系顺序）
-- ========================================
SELECT '=== 开始删除表 ===' AS info;

-- 删除命令拦截日志表
DROP TABLE IF EXISTS `command_intercept_logs`;
SELECT 'Dropped table: command_intercept_logs' AS status;

-- 删除策略相关表
DROP TABLE IF EXISTS `policy_commands`;
SELECT 'Dropped table: policy_commands' AS status;

DROP TABLE IF EXISTS `policy_users`;
SELECT 'Dropped table: policy_users' AS status;

DROP TABLE IF EXISTS `command_policies`;
SELECT 'Dropped table: command_policies' AS status;

-- 删除命令组相关表
DROP TABLE IF EXISTS `command_group_commands`;
SELECT 'Dropped table: command_group_commands' AS status;

DROP TABLE IF EXISTS `command_groups`;
SELECT 'Dropped table: command_groups' AS status;

-- 删除命令表
DROP TABLE IF EXISTS `commands`;
SELECT 'Dropped table: commands' AS status;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 3. 删除相关权限（如果存在）
-- ========================================
SELECT '=== 清理权限记录 ===' AS info;

-- 记录将要删除的权限
SELECT 'Permissions to be deleted:' AS info;
SELECT * FROM `permissions` WHERE `name` IN ('command_filter:read', 'command_filter:write');

-- 删除角色权限关联
DELETE rp FROM `role_permissions` rp
INNER JOIN `permissions` p ON rp.permission_id = p.id
WHERE p.name IN ('command_filter:read', 'command_filter:write');

SELECT CONCAT('Deleted ', ROW_COUNT(), ' role_permissions records') AS status;

-- 删除权限记录
DELETE FROM `permissions` 
WHERE `name` IN ('command_filter:read', 'command_filter:write');

SELECT CONCAT('Deleted ', ROW_COUNT(), ' permissions records') AS status;

-- ========================================
-- 4. 验证清理结果
-- ========================================
SELECT '=== 验证清理结果 ===' AS info;

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: All command filter tables have been dropped!'
        ELSE CONCAT('WARNING: ', COUNT(*), ' tables still exist!')
    END AS cleanup_status
FROM information_schema.tables 
WHERE table_schema = 'bastion' 
AND table_name IN (
    'commands',
    'command_groups',
    'command_group_commands',
    'command_policies',
    'policy_users',
    'policy_commands',
    'command_intercept_logs'
);

-- ========================================
-- 5. 显示备份表信息
-- ========================================
SELECT '=== 备份表信息 ===' AS info;

SELECT 
    table_name,
    CONCAT('Records: ', 
        CASE table_name
            WHEN 'commands_backup_20250130' THEN (SELECT COUNT(*) FROM `commands_backup_20250130`)
            WHEN 'command_groups_backup_20250130' THEN (SELECT COUNT(*) FROM `command_groups_backup_20250130`)
            WHEN 'command_group_commands_backup_20250130' THEN (SELECT COUNT(*) FROM `command_group_commands_backup_20250130`)
            WHEN 'command_policies_backup_20250130' THEN (SELECT COUNT(*) FROM `command_policies_backup_20250130`)
            WHEN 'policy_users_backup_20250130' THEN (SELECT COUNT(*) FROM `policy_users_backup_20250130`)
            WHEN 'policy_commands_backup_20250130' THEN (SELECT COUNT(*) FROM `policy_commands_backup_20250130`)
            WHEN 'command_intercept_logs_backup_20250130' THEN (SELECT COUNT(*) FROM `command_intercept_logs_backup_20250130`)
            ELSE '0'
        END
    ) AS backup_info
FROM information_schema.tables 
WHERE table_schema = 'bastion' 
AND table_name LIKE '%_backup_20250130'
ORDER BY table_name;

-- ========================================
-- 清理脚本完成
-- ========================================
SELECT '=== 清理完成 ===' AS info;
SELECT 'All command filter related tables and data have been removed.' AS message;
SELECT 'Backup tables are preserved for data recovery if needed.' AS message;