-- ========================================
-- Bastion 数据库清理脚本
-- 清理所有旧表、视图和存储过程
-- ========================================

USE bastion;
SET FOREIGN_KEY_CHECKS = 0;

-- 删除所有视图
DROP VIEW IF EXISTS audit_statistics;

-- 删除所有存储过程
DROP PROCEDURE IF EXISTS CleanupAuditLogs;

-- 删除所有表（按依赖顺序）
DROP TABLE IF EXISTS asset_credentials;
DROP TABLE IF EXISTS asset_group_assets;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS command_logs;
DROP TABLE IF EXISTS session_monitor_logs;
DROP TABLE IF EXISTS session_warnings;
DROP TABLE IF EXISTS session_records;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS operation_logs;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS websocket_connections;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS asset_groups;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 显示清理结果
SELECT 'Database cleanup completed!' as message;
SELECT COUNT(*) as remaining_tables FROM information_schema.tables WHERE table_schema='bastion';