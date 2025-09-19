-- ========================================
-- Bastion 运维堡垒机系统数据库结构恢复脚本
-- 数据库误删恢复：完整表结构重建
-- 生成时间: 2025-07-19
-- ========================================

-- 设置基础配置
USE bastion;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ========================================
-- 1. 用户权限系统核心表
-- ========================================

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '1-启用, 0-禁用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表 - 存储系统用户信息';

-- 角色表
CREATE TABLE IF NOT EXISTS `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_role_name` (`name`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表 - 存储系统角色定义';

-- 权限表
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_permission_name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表 - 存储系统权限定义';

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表 - 多对多关系';

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表 - 多对多关系';

-- ========================================
-- 2. 资产分组管理系统
-- ========================================

-- 资产分组表（支持层级结构）
CREATE TABLE IF NOT EXISTS `asset_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'general' COMMENT '分组类型: production, test, dev, general',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父分组ID',
  `sort_order` int DEFAULT '0' COMMENT '排序字段',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_asset_group_name` (`name`),
  KEY `idx_asset_groups_parent_id` (`parent_id`),
  KEY `idx_asset_groups_type` (`type`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_asset_groups_parent` FOREIGN KEY (`parent_id`) REFERENCES `asset_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产分组表 - 支持层级结构的资产分组';

-- ========================================
-- 3. 资产和凭证管理系统
-- ========================================

-- 资产表
CREATE TABLE IF NOT EXISTS `assets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'server' COMMENT '资产类型: server, database',
  `os_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'linux' COMMENT '操作系统类型: linux, windows',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int DEFAULT '22',
  `protocol` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'ssh' COMMENT '协议: ssh, rdp, vnc, mysql, postgresql',
  `tags` json DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '状态: 1-启用, 0-禁用',
  `group_id` bigint unsigned DEFAULT NULL COMMENT '资产分组ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_status` (`status`),
  KEY `idx_assets_group_id` (`group_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_assets_group_id` FOREIGN KEY (`group_id`) REFERENCES `asset_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产表 - 存储服务器和数据库等资产';

-- 凭证表
CREATE TABLE IF NOT EXISTS `credentials` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'password' COMMENT '凭证类型: password, key',
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `private_key` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='凭证表 - 存储访问资产的认证信息';

-- 资产凭证关联表（多对多关系）
CREATE TABLE IF NOT EXISTS `asset_credentials` (
  `asset_id` bigint unsigned NOT NULL,
  `credential_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`asset_id`,`credential_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_credential_id` (`credential_id`),
  CONSTRAINT `fk_asset_credentials_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_credentials_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产凭证关联表 - 多对多关系';

-- ========================================
-- 4. 审计日志系统
-- ========================================

-- 登录日志表
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `method` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'web',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'success, failed, logout',
  `message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_ip` (`ip`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录日志表 - 记录用户登录、登出和登录失败记录';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'HTTP方法: GET, POST, PUT, DELETE',
  `url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型: create, read, update, delete',
  `resource` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '资源类型: user, role, asset, session',
  `resource_id` bigint unsigned DEFAULT NULL COMMENT '资源ID',
  `status` int NOT NULL COMMENT 'HTTP状态码',
  `message` text COLLATE utf8mb4_unicode_ci,
  `request_data` text COLLATE utf8mb4_unicode_ci,
  `response_data` text COLLATE utf8mb4_unicode_ci,
  `duration` bigint DEFAULT NULL COMMENT '请求耗时，毫秒',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_ip` (`ip`),
  KEY `idx_method` (`method`),
  KEY `idx_action` (`action`),
  KEY `idx_resource` (`resource`),
  KEY `idx_resource_id` (`resource_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_operation_logs_user_time` (`user_id`,`created_at`),
  CONSTRAINT `fk_operation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表 - 记录用户在系统中的所有操作';

-- ========================================
-- 5. 会话管理系统
-- ========================================

-- 会话记录表
CREATE TABLE IF NOT EXISTS `session_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_id` bigint unsigned NOT NULL,
  `asset_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credential_id` bigint unsigned NOT NULL,
  `protocol` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '协议: ssh, rdp, vnc',
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'active, closed, timeout, terminated',
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '会话持续时间，秒',
  `record_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '录制文件路径',
  `is_terminated` tinyint(1) DEFAULT '0' COMMENT '是否被终止',
  `termination_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '终止原因',
  `terminated_by` bigint unsigned DEFAULT NULL COMMENT '终止人',
  `terminated_at` timestamp NULL DEFAULT NULL COMMENT '终止时间',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_credential_id` (`credential_id`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_ip` (`ip`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_session_records_is_terminated` (`is_terminated`),
  KEY `idx_session_records_status_terminated` (`status`,`is_terminated`),
  KEY `idx_sessions_user_time` (`user_id`,`start_time`),
  KEY `idx_terminated_by` (`terminated_by`),
  CONSTRAINT `fk_session_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_terminated_by` FOREIGN KEY (`terminated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话记录表 - 记录用户的SSH/RDP等会话信息';

-- 命令日志表
CREATE TABLE IF NOT EXISTS `command_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_id` bigint unsigned NOT NULL,
  `command` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `output` text COLLATE utf8mb4_unicode_ci,
  `exit_code` int DEFAULT NULL,
  `risk` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'low' COMMENT '风险等级: low, medium, high',
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '命令执行时间，毫秒',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_risk` (`risk`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_command_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_command_logs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='命令日志表 - 记录用户在会话中执行的命令';

-- ========================================
-- 6. 实时监控系统
-- ========================================

-- 会话监控日志表
CREATE TABLE IF NOT EXISTS `session_monitor_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话ID',
  `monitor_user_id` bigint unsigned NOT NULL COMMENT '监控用户ID',
  `action_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型: terminate, warning, view',
  `action_data` json DEFAULT NULL COMMENT '操作数据',
  `reason` text COLLATE utf8mb4_unicode_ci COMMENT '操作原因',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_monitor_user` (`monitor_user_id`),
  KEY `idx_action_type` (`action_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_monitor_user` FOREIGN KEY (`monitor_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话监控日志表';

-- 会话警告消息表
CREATE TABLE IF NOT EXISTS `session_warnings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会话ID',
  `sender_user_id` bigint unsigned NOT NULL COMMENT '发送者用户ID',
  `receiver_user_id` bigint unsigned NOT NULL COMMENT '接收者用户ID',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '警告消息',
  `level` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'warning' COMMENT 'info, warning, error',
  `is_read` tinyint(1) DEFAULT '0' COMMENT '是否已读',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL COMMENT '阅读时间',
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_sender` (`sender_user_id`),
  KEY `idx_receiver` (`receiver_user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_is_read` (`is_read`),
  CONSTRAINT `fk_warning_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_warning_receiver` FOREIGN KEY (`receiver_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话警告消息表';

-- WebSocket连接日志表
CREATE TABLE IF NOT EXISTS `websocket_connections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户端ID',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `connect_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '连接时间',
  `disconnect_time` timestamp NULL DEFAULT NULL COMMENT '断开时间',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户端IP',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '用户代理',
  `duration` int DEFAULT NULL COMMENT '连接持续时间（秒）',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_connect_time` (`connect_time`),
  KEY `idx_client_id` (`client_id`),
  CONSTRAINT `fk_ws_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WebSocket连接日志表';

-- ========================================
-- 7. 初始化基础数据
-- ========================================

-- 插入默认权限
INSERT IGNORE INTO `permissions` (`name`, `description`, `category`) VALUES 
-- 用户管理权限
('user:create', '创建用户', 'user'),
('user:read', '查看用户', 'user'),
('user:update', '更新用户', 'user'),
('user:delete', '删除用户', 'user'),
-- 角色管理权限
('role:create', '创建角色', 'role'),
('role:read', '查看角色', 'role'),
('role:update', '更新角色', 'role'),
('role:delete', '删除角色', 'role'),
-- 资产管理权限
('asset:create', '创建资产', 'asset'),
('asset:read', '查看资产', 'asset'),
('asset:update', '更新资产', 'asset'),
('asset:delete', '删除资产', 'asset'),
('asset:connect', '连接资产', 'asset'),
-- 审计权限
('audit:read', '查看审计日志', 'audit'),
('audit:cleanup', '清理审计日志', 'audit'),
('audit:monitor', '实时监控权限', 'audit'),
('audit:terminate', '会话终止权限', 'audit'),
('audit:warning', '发送警告权限', 'audit'),
-- 具体审计模块权限
('login_logs:read', '查看登录日志', 'audit'),
('operation_logs:read', '查看操作日志', 'audit'),
('session_records:read', '查看会话记录', 'audit'),
('command_logs:read', '查看命令日志', 'audit'),
-- 会话管理权限
('session:read', '查看会话', 'session'),
('log:read', '查看日志', 'log'),
-- 系统权限
('all', '所有权限', 'system');

-- 插入默认角色
INSERT IGNORE INTO `roles` (`name`, `description`) VALUES 
('admin', '系统管理员'),
('operator', '运维人员'),
('auditor', '审计员');

-- 插入默认资产分组
INSERT IGNORE INTO `asset_groups` (`name`, `description`, `type`, `parent_id`, `sort_order`) VALUES
('生产环境', '生产环境资产分组', 'production', NULL, 1),
('测试环境', '测试环境资产分组', 'test', NULL, 2),
('开发环境', '开发环境资产分组', 'dev', NULL, 3),
('通用分组', '通用资产分组', 'general', NULL, 4);

-- 获取分组ID并创建子分组
SET @prod_group_id = (SELECT id FROM asset_groups WHERE name = '生产环境' AND type = 'production' LIMIT 1);
SET @test_group_id = (SELECT id FROM asset_groups WHERE name = '测试环境' AND type = 'test' LIMIT 1);
SET @dev_group_id = (SELECT id FROM asset_groups WHERE name = '开发环境' AND type = 'dev' LIMIT 1);

INSERT IGNORE INTO `asset_groups` (`name`, `description`, `type`, `parent_id`, `sort_order`) VALUES
('Web服务器', 'Web服务器分组', 'production', @prod_group_id, 1),
('应用服务器', '应用服务器分组', 'production', @prod_group_id, 2),
('数据库服务器', '数据库服务器分组', 'production', @prod_group_id, 3),
('测试服务器', '测试服务器分组', 'test', @test_group_id, 1),
('开发服务器', '开发服务器分组', 'dev', @dev_group_id, 1);

-- 创建默认管理员用户 (密码: admin123)
INSERT IGNORE INTO `users` (`username`, `password`, `email`, `status`) VALUES 
('admin', '$2a$10$x/i8F9qXh.tmIbwkLROCyeQleavmD4t0qR2BBQJ2cs57DvwaLbTs.', 'admin@bastion.local', 1);

-- 为管理员分配角色
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`) 
SELECT u.id, r.id FROM `users` u, `roles` r 
WHERE u.username = 'admin' AND r.name = 'admin';

-- 为admin角色分配所有权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'admin' AND p.name = 'all';

-- 为operator角色分配部分权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'operator' AND p.name IN ('asset:read', 'asset:connect', 'session:read');

-- 为auditor角色分配审计权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'auditor' AND p.name IN ('audit:read', 'audit:monitor', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read');

-- ========================================
-- 8. 创建审计统计视图
-- ========================================

CREATE OR REPLACE VIEW `audit_statistics` AS
SELECT 
  (SELECT COUNT(*) FROM login_logs) as total_login_logs,
  (SELECT COUNT(*) FROM operation_logs) as total_operation_logs,
  (SELECT COUNT(*) FROM session_records) as total_session_records,
  (SELECT COUNT(*) FROM command_logs) as total_command_logs,
  (SELECT COUNT(*) FROM login_logs WHERE status = 'failed') as failed_logins,
  (SELECT COUNT(*) FROM session_records WHERE status = 'active') as active_sessions,
  (SELECT COUNT(*) FROM command_logs WHERE risk = 'high') as dangerous_commands,
  (SELECT COUNT(*) FROM login_logs WHERE DATE(created_at) = CURDATE()) as today_logins,
  (SELECT COUNT(*) FROM operation_logs WHERE DATE(created_at) = CURDATE()) as today_operations,
  (SELECT COUNT(*) FROM session_records WHERE DATE(start_time) = CURDATE()) as today_sessions;

-- ========================================
-- 9. 创建清理存储过程
-- ========================================

DELIMITER //
CREATE PROCEDURE `CleanupAuditLogs`(IN retention_days INT)
BEGIN
    DECLARE cutoff_date DATETIME;
    SET cutoff_date = DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    -- 清理登录日志
    DELETE FROM login_logs WHERE created_at < cutoff_date;
    
    -- 清理操作日志
    DELETE FROM operation_logs WHERE created_at < cutoff_date;
    
    -- 清理会话记录
    DELETE FROM session_records WHERE created_at < cutoff_date;
    
    -- 清理命令日志
    DELETE FROM command_logs WHERE created_at < cutoff_date;
    
    -- 清理监控日志
    DELETE FROM session_monitor_logs WHERE created_at < cutoff_date;
    
    -- 清理警告消息
    DELETE FROM session_warnings WHERE created_at < cutoff_date;
    
    -- 清理WebSocket连接日志
    DELETE FROM websocket_connections WHERE connect_time < cutoff_date;
    
    -- 输出清理结果
    SELECT 
        'Cleanup completed' as message,
        cutoff_date as cutoff_date,
        retention_days as retention_days;
END //
DELIMITER ;

-- ========================================
-- 10. 恢复外键检查
-- ========================================

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 11. 验证脚本执行结果
-- ========================================

-- 显示所有表
SELECT 
    TABLE_NAME as '表名',
    TABLE_COMMENT as '表说明',
    TABLE_ROWS as '行数',
    DATA_LENGTH as '数据大小',
    INDEX_LENGTH as '索引大小'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion' 
ORDER BY TABLE_NAME;

-- 显示外键关系
SELECT 
    TABLE_NAME as '表名',
    COLUMN_NAME as '列名',
    REFERENCED_TABLE_NAME as '引用表',
    REFERENCED_COLUMN_NAME as '引用列',
    CONSTRAINT_NAME as '约束名'
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'bastion' 
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 显示权限配置统计
SELECT 
    r.name as '角色名',
    r.description as '角色描述',
    COUNT(rp.permission_id) as '权限数量',
    GROUP_CONCAT(p.name SEPARATOR ', ') as '权限列表'
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.id, r.name, r.description
ORDER BY r.name;

-- 显示资产分组层级结构
SELECT 
    ag.id,
    ag.name as '分组名',
    ag.type as '类型',
    parent.name as '父分组',
    ag.sort_order as '排序',
    COUNT(a.id) as '资产数量'
FROM asset_groups ag
LEFT JOIN asset_groups parent ON ag.parent_id = parent.id
LEFT JOIN assets a ON ag.id = a.group_id
GROUP BY ag.id, ag.name, ag.type, parent.name, ag.sort_order
ORDER BY ag.parent_id, ag.sort_order;

-- 完成提示
SELECT 
    '数据库表结构恢复完成！' as message,
    COUNT(*) as total_tables,
    NOW() as recovery_time
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion';

-- ========================================
-- 恢复脚本执行完成
-- ========================================