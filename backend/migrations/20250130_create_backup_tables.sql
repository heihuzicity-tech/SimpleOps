-- ========================================
-- 创建备份表脚本（用于测试环境）
-- 创建时间：2025-01-30
-- 功能：创建命令过滤相关表的备份（如果无法执行mysqldump）
-- ========================================

USE bastion;

-- 创建备份表（保留原始数据）
CREATE TABLE IF NOT EXISTS `commands_backup_20250130` AS 
SELECT * FROM `commands`;

CREATE TABLE IF NOT EXISTS `command_groups_backup_20250130` AS 
SELECT * FROM `command_groups`;

CREATE TABLE IF NOT EXISTS `command_group_commands_backup_20250130` AS 
SELECT * FROM `command_group_commands`;

CREATE TABLE IF NOT EXISTS `command_policies_backup_20250130` AS 
SELECT * FROM `command_policies`;

CREATE TABLE IF NOT EXISTS `policy_users_backup_20250130` AS 
SELECT * FROM `policy_users`;

CREATE TABLE IF NOT EXISTS `policy_commands_backup_20250130` AS 
SELECT * FROM `policy_commands`;

CREATE TABLE IF NOT EXISTS `command_intercept_logs_backup_20250130` AS 
SELECT * FROM `command_intercept_logs`;

-- 显示备份结果
SELECT 'Backup tables created successfully!' AS status;