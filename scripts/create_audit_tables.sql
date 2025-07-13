-- 创建审计表脚本 (简化版本)
-- 只创建缺少的审计表

USE bastion;

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 创建操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `method` varchar(10) NOT NULL COMMENT 'HTTP方法: GET, POST, PUT, DELETE',
  `url` varchar(255) NOT NULL,
  `action` varchar(50) NOT NULL COMMENT '操作类型: create, read, update, delete',
  `resource` varchar(50) DEFAULT NULL COMMENT '资源类型: user, role, asset, session',
  `resource_id` bigint DEFAULT NULL COMMENT '资源ID',
  `status` int NOT NULL COMMENT 'HTTP状态码',
  `message` text DEFAULT NULL,
  `request_data` text DEFAULT NULL,
  `response_data` text DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '请求耗时，毫秒',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  CONSTRAINT `fk_operation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 2. 创建会话记录表
CREATE TABLE IF NOT EXISTS `session_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL UNIQUE,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `asset_id` bigint NOT NULL,
  `asset_name` varchar(100) NOT NULL,
  `asset_address` varchar(255) NOT NULL,
  `credential_id` bigint NOT NULL,
  `protocol` varchar(10) NOT NULL COMMENT '协议: ssh, rdp, vnc',
  `ip` varchar(45) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '会话状态: active-活跃, closed-已关闭, timeout-超时',
  `start_time` timestamp DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '会话持续时间，秒',
  `record_path` varchar(255) DEFAULT NULL COMMENT '录制文件路径',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  CONSTRAINT `fk_session_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话记录表';

-- 3. 创建命令日志表
CREATE TABLE IF NOT EXISTS `command_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `asset_id` bigint NOT NULL,
  `command` text NOT NULL,
  `output` text DEFAULT NULL,
  `exit_code` int DEFAULT NULL,
  `risk` varchar(20) DEFAULT 'low' COMMENT '风险等级: low-低, medium-中, high-高',
  `start_time` timestamp DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '命令执行时间，毫秒',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令日志表';

-- 4. 添加审计相关权限
INSERT INTO `permissions` (`name`, `description`, `category`) VALUES 
('audit:read', '查看审计日志', 'audit'),
('audit:cleanup', '清理审计日志', 'audit'),
('login_logs:read', '查看登录日志', 'audit'),
('operation_logs:read', '查看操作日志', 'audit'),
('session_records:read', '查看会话记录', 'audit'),
('command_logs:read', '查看命令日志', 'audit')
ON DUPLICATE KEY UPDATE 
`description` = VALUES(`description`),
`category` = VALUES(`category`);

-- 5. 为admin角色分配审计权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'admin' AND p.name IN ('audit:read', 'audit:cleanup', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read')
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`);

-- 6. 为auditor角色分配审计权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'auditor' AND p.name IN ('audit:read', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read')
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`);

-- 7. 创建视图用于统计查询
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

-- 8. 创建清理过期日志的存储过程
DELIMITER //
CREATE PROCEDURE CleanupAuditLogs(IN retention_days INT)
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
    
    -- 输出清理结果
    SELECT 
        'Cleanup completed' as message,
        cutoff_date as cutoff_date,
        retention_days as retention_days;
END //
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- 显示新创建的表
SHOW TABLES LIKE '%log%';
SHOW TABLES LIKE '%session%';

-- 添加表注释
ALTER TABLE login_logs COMMENT = '登录日志表 - 记录用户登录、登出和登录失败记录';
ALTER TABLE operation_logs COMMENT = '操作日志表 - 记录用户在系统中的所有操作';
ALTER TABLE session_records COMMENT = '会话记录表 - 记录用户的SSH/RDP等会话信息';
ALTER TABLE command_logs COMMENT = '命令日志表 - 记录用户在会话中执行的命令'; 