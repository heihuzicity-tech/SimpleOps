-- ========================================
-- 命令过滤功能数据备份脚本
-- 创建时间：2025-01-30
-- 功能：备份现有命令过滤相关的所有数据
-- ========================================

-- 使用bastion数据库
USE bastion;

-- ========================================
-- 1. 创建备份表（添加时间戳后缀）
-- ========================================

-- 备份命令表
CREATE TABLE IF NOT EXISTS `commands_backup_20250130` AS 
SELECT * FROM `commands`;

-- 备份命令组表
CREATE TABLE IF NOT EXISTS `command_groups_backup_20250130` AS 
SELECT * FROM `command_groups`;

-- 备份命令组与命令关联表
CREATE TABLE IF NOT EXISTS `command_group_commands_backup_20250130` AS 
SELECT * FROM `command_group_commands`;

-- 备份命令策略表
CREATE TABLE IF NOT EXISTS `command_policies_backup_20250130` AS 
SELECT * FROM `command_policies`;

-- 备份策略与用户关联表
CREATE TABLE IF NOT EXISTS `policy_users_backup_20250130` AS 
SELECT * FROM `policy_users`;

-- 备份策略与命令/命令组关联表
CREATE TABLE IF NOT EXISTS `policy_commands_backup_20250130` AS 
SELECT * FROM `policy_commands`;

-- 备份命令拦截日志表
CREATE TABLE IF NOT EXISTS `command_intercept_logs_backup_20250130` AS 
SELECT * FROM `command_intercept_logs`;

-- ========================================
-- 2. 验证备份结果
-- ========================================

-- 显示备份表的记录数
SELECT 'commands' as table_name, COUNT(*) as record_count FROM `commands`
UNION ALL
SELECT 'commands_backup_20250130', COUNT(*) FROM `commands_backup_20250130`
UNION ALL
SELECT 'command_groups', COUNT(*) FROM `command_groups`
UNION ALL
SELECT 'command_groups_backup_20250130', COUNT(*) FROM `command_groups_backup_20250130`
UNION ALL
SELECT 'command_group_commands', COUNT(*) FROM `command_group_commands`
UNION ALL
SELECT 'command_group_commands_backup_20250130', COUNT(*) FROM `command_group_commands_backup_20250130`
UNION ALL
SELECT 'command_policies', COUNT(*) FROM `command_policies`
UNION ALL
SELECT 'command_policies_backup_20250130', COUNT(*) FROM `command_policies_backup_20250130`
UNION ALL
SELECT 'policy_users', COUNT(*) FROM `policy_users`
UNION ALL
SELECT 'policy_users_backup_20250130', COUNT(*) FROM `policy_users_backup_20250130`
UNION ALL
SELECT 'policy_commands', COUNT(*) FROM `policy_commands`
UNION ALL
SELECT 'policy_commands_backup_20250130', COUNT(*) FROM `policy_commands_backup_20250130`
UNION ALL
SELECT 'command_intercept_logs', COUNT(*) FROM `command_intercept_logs`
UNION ALL
SELECT 'command_intercept_logs_backup_20250130', COUNT(*) FROM `command_intercept_logs_backup_20250130`;

-- ========================================
-- 3. 生成导出命令（用于命令行执行）
-- ========================================

-- 注意：以下命令需要在shell中执行，不是SQL语句
-- 请根据实际的数据库连接信息修改参数

/*
-- 导出所有命令过滤相关表的数据到文件
mysqldump -u root -p bastion \
  commands \
  command_groups \
  command_group_commands \
  command_policies \
  policy_users \
  policy_commands \
  command_intercept_logs \
  > /Users/skip/workspace/bastion/.specs/backups/db/command_filter_backup_20250130.sql

-- 或者只导出数据（不含表结构）
mysqldump -u root -p bastion \
  --no-create-info \
  commands \
  command_groups \
  command_group_commands \
  command_policies \
  policy_users \
  policy_commands \
  command_intercept_logs \
  > /Users/skip/workspace/bastion/.specs/backups/db/command_filter_data_20250130.sql
*/

-- ========================================
-- 4. 恢复数据的SQL（如需要回滚）
-- ========================================

/*
-- 如果需要从备份表恢复数据，可以使用以下SQL：

-- 清空当前表
TRUNCATE TABLE `commands`;
TRUNCATE TABLE `command_groups`;
TRUNCATE TABLE `command_group_commands`;
TRUNCATE TABLE `command_policies`;
TRUNCATE TABLE `policy_users`;
TRUNCATE TABLE `policy_commands`;
TRUNCATE TABLE `command_intercept_logs`;

-- 从备份表恢复数据
INSERT INTO `commands` SELECT * FROM `commands_backup_20250130`;
INSERT INTO `command_groups` SELECT * FROM `command_groups_backup_20250130`;
INSERT INTO `command_group_commands` SELECT * FROM `command_group_commands_backup_20250130`;
INSERT INTO `command_policies` SELECT * FROM `command_policies_backup_20250130`;
INSERT INTO `policy_users` SELECT * FROM `policy_users_backup_20250130`;
INSERT INTO `policy_commands` SELECT * FROM `policy_commands_backup_20250130`;
INSERT INTO `command_intercept_logs` SELECT * FROM `command_intercept_logs_backup_20250130`;
*/

-- ========================================
-- 备份脚本完成
-- ========================================