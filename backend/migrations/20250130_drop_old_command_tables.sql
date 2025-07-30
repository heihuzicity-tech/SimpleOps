-- ========================================
-- 命令过滤功能数据清理脚本
-- 创建时间：2025-01-30
-- 功能：删除旧的命令过滤相关表和数据
-- 警告：此脚本将永久删除所有命令过滤相关数据！
-- ========================================

-- 使用bastion数据库
USE bastion;

-- ========================================
-- 安全检查：确认备份表存在
-- ========================================
-- 如果备份表不存在，脚本将停止执行
SELECT 
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'bastion' 
            AND table_name IN (
                'commands_backup_20250130',
                'command_groups_backup_20250130',
                'command_group_commands_backup_20250130',
                'command_policies_backup_20250130',
                'policy_users_backup_20250130',
                'policy_commands_backup_20250130',
                'command_intercept_logs_backup_20250130'
            )
        ) < 7 
        THEN SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error: Backup tables not found. Please run backup script first!';
    ELSE 'Backup tables found, proceeding with cleanup...'
    END AS status;

-- ========================================
-- 1. 删除外键约束
-- ========================================
-- 由于表之间存在外键关系，需要先删除外键约束

-- 删除命令拦截日志表的外键
ALTER TABLE `command_intercept_logs` 
    DROP FOREIGN KEY IF EXISTS `fk_cil_user`,
    DROP FOREIGN KEY IF EXISTS `fk_cil_asset`,
    DROP FOREIGN KEY IF EXISTS `fk_cil_policy`;

-- 删除策略命令关联表的外键
ALTER TABLE `policy_commands` 
    DROP FOREIGN KEY IF EXISTS `fk_pc_policy`,
    DROP FOREIGN KEY IF EXISTS `fk_pc_command`,
    DROP FOREIGN KEY IF EXISTS `fk_pc_command_group`;

-- 删除策略用户关联表的外键
ALTER TABLE `policy_users` 
    DROP FOREIGN KEY IF EXISTS `fk_pu_policy`,
    DROP FOREIGN KEY IF EXISTS `fk_pu_user`;

-- 删除命令组命令关联表的外键
ALTER TABLE `command_group_commands` 
    DROP FOREIGN KEY IF EXISTS `fk_cgc_command_group`,
    DROP FOREIGN KEY IF EXISTS `fk_cgc_command`;

-- ========================================
-- 2. 删除表（按依赖关系顺序）
-- ========================================

-- 删除命令拦截日志表
DROP TABLE IF EXISTS `command_intercept_logs`;

-- 删除策略相关表
DROP TABLE IF EXISTS `policy_commands`;
DROP TABLE IF EXISTS `policy_users`;
DROP TABLE IF EXISTS `command_policies`;

-- 删除命令组相关表
DROP TABLE IF EXISTS `command_group_commands`;
DROP TABLE IF EXISTS `command_groups`;

-- 删除命令表
DROP TABLE IF EXISTS `commands`;

-- ========================================
-- 3. 删除相关权限（如果存在）
-- ========================================
-- 删除命令过滤相关的权限记录
DELETE FROM `role_permissions` 
WHERE `permission_id` IN (
    SELECT `id` FROM `permissions` 
    WHERE `name` IN ('command_filter:read', 'command_filter:write')
);

DELETE FROM `permissions` 
WHERE `name` IN ('command_filter:read', 'command_filter:write');

-- ========================================
-- 4. 清理相关索引（如果独立存在）
-- ========================================
-- 注：大部分索引会随表一起删除，这里列出是为了完整性

-- ========================================
-- 5. 验证清理结果
-- ========================================
SELECT 
    'Tables dropped successfully!' AS status,
    (
        SELECT COUNT(*) 
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
        )
    ) AS remaining_tables_count;

-- ========================================
-- 6. 显示备份表信息（提醒用户）
-- ========================================
SELECT 
    CONCAT('Backup table: ', table_name) AS backup_info,
    (
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'bastion' 
        AND table_name = t.table_name
    ) AS exists
FROM (
    SELECT 'commands_backup_20250130' AS table_name
    UNION ALL SELECT 'command_groups_backup_20250130'
    UNION ALL SELECT 'command_group_commands_backup_20250130'
    UNION ALL SELECT 'command_policies_backup_20250130'
    UNION ALL SELECT 'policy_users_backup_20250130'
    UNION ALL SELECT 'policy_commands_backup_20250130'
    UNION ALL SELECT 'command_intercept_logs_backup_20250130'
) t;

-- ========================================
-- 注意事项：
-- 1. 执行此脚本前请确保已运行备份脚本
-- 2. 此操作不可逆，除非从备份恢复
-- 3. 如需恢复数据，请参考备份脚本中的恢复说明
-- ========================================

-- ========================================
-- 清理脚本完成
-- ========================================