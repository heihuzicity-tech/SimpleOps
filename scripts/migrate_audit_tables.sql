-- 审计表结构迁移脚本
-- 更新现有表结构并添加新的审计表

USE bastion;

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 创建登录日志表
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `method` varchar(10) DEFAULT 'web' COMMENT '登录方式: web-网页, api-API',
  `status` varchar(20) NOT NULL COMMENT '登录状态: success-成功, failed-失败, logout-登出',
  `message` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_ip` (`ip`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';

-- 2. 更新操作日志表结构
DROP TABLE IF EXISTS `operation_logs_old`;
DROP TABLE IF EXISTS `operation_logs_new`;
RENAME TABLE `operation_logs` TO `operation_logs_old`;

CREATE TABLE `operation_logs` (
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
  CONSTRAINT `fk_operation_logs_user_new` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 3. 更新会话记录表结构
DROP TABLE IF EXISTS `sessions_old`;
RENAME TABLE `sessions` TO `sessions_old`;

CREATE TABLE `session_records` (
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

-- 4. 创建命令日志表
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

-- 5. 添加审计相关权限
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

-- 6. 为admin角色分配审计权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'admin' AND p.name IN ('audit:read', 'audit:cleanup', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read')
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`);

-- 7. 为auditor角色分配审计权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`) 
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'auditor' AND p.name IN ('audit:read', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read')
ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`);

-- 8. 迁移旧数据（如果需要）
-- 注意：这里需要根据具体情况调整数据迁移逻辑

-- 迁移旧的会话记录数据
INSERT INTO `session_records` (`session_id`, `user_id`, `username`, `asset_id`, `asset_name`, `asset_address`, `credential_id`, `protocol`, `ip`, `status`, `start_time`, `end_time`, `duration`, `record_path`, `created_at`)
SELECT 
  s.session_id,
  s.user_id,
  u.username,
  s.asset_id,
  a.name,
  a.address,
  1, -- 默认凭证ID，需要根据实际情况调整
  s.protocol,
  COALESCE(s.client_ip, '127.0.0.1'),
  s.status,
  s.start_time,
  s.end_time,
  CASE 
    WHEN s.end_time IS NOT NULL 
    THEN TIMESTAMPDIFF(SECOND, s.start_time, s.end_time)
    ELSE NULL
  END,
  s.record_file,
  s.created_at
FROM sessions_old s
JOIN users u ON s.user_id = u.id
JOIN assets a ON s.asset_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM session_records sr WHERE sr.session_id = s.session_id
);

-- 迁移旧的操作日志数据
INSERT INTO `operation_logs` (`user_id`, `username`, `ip`, `method`, `url`, `action`, `resource`, `resource_id`, `status`, `message`, `duration`, `created_at`)
SELECT 
  ol.user_id,
  u.username,
  '127.0.0.1', -- 默认IP，旧表中没有IP字段
  'POST', -- 默认方法
  CONCAT('/api/v1/', ol.action), -- 根据action构造URL
  ol.action,
  CASE 
    WHEN ol.asset_id IS NOT NULL THEN 'asset'
    ELSE 'system'
  END,
  ol.asset_id,
  200, -- 默认状态码
  ol.result,
  NULL, -- 旧表中没有duration字段
  ol.timestamp
FROM operation_logs_old ol
JOIN users u ON ol.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM operation_logs o WHERE o.user_id = ol.user_id AND o.created_at = ol.timestamp
);

-- 9. 创建视图用于统计查询
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

-- 10. 创建清理过期日志的存储过程
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

-- 显示新的表结构
SHOW TABLES LIKE '%log%';
SHOW TABLES LIKE '%session%';

-- 添加表注释
ALTER TABLE login_logs COMMENT = '登录日志表 - 记录用户登录、登出和登录失败记录';
ALTER TABLE operation_logs COMMENT = '操作日志表 - 记录用户在系统中的所有操作';
ALTER TABLE session_records COMMENT = '会话记录表 - 记录用户的SSH/RDP等会话信息';
ALTER TABLE command_logs COMMENT = '命令日志表 - 记录用户在会话中执行的命令';

-- 显示审计表的结构
DESCRIBE login_logs;
DESCRIBE operation_logs;
DESCRIBE session_records;
DESCRIBE command_logs; 