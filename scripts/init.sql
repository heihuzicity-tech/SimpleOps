-- 运维堡垒机系统数据库初始化脚本
-- 数据库: bastion

USE bastion;

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` tinyint DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 角色表
CREATE TABLE IF NOT EXISTS `roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL UNIQUE,
  `description` text,
  `permissions` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` bigint NOT NULL,
  `role_id` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- 资产表
CREATE TABLE IF NOT EXISTS `assets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'server' COMMENT '资产类型: server-服务器, database-数据库',
  `address` varchar(255) NOT NULL,
  `port` int DEFAULT 22,
  `protocol` varchar(10) DEFAULT 'ssh' COMMENT '协议: ssh, rdp, vnc, mysql, etc.',
  `tags` json DEFAULT NULL,
  `status` tinyint DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产表';

-- 凭证表
CREATE TABLE IF NOT EXISTS `credentials` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'password' COMMENT '凭证类型: password-密码, key-密钥',
  `username` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `private_key` text DEFAULT NULL,
  `asset_id` bigint NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_type` (`type`),
  CONSTRAINT `fk_credentials_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='凭证表';

-- 会话记录表
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL UNIQUE,
  `user_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `protocol` varchar(10) NOT NULL DEFAULT 'ssh',
  `start_time` timestamp DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active' COMMENT '会话状态: active-活跃, closed-已关闭, timeout-超时',
  `client_ip` varchar(45) DEFAULT NULL,
  `record_file` varchar(255) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_sessions_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话记录表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `asset_id` bigint DEFAULT NULL,
  `action` varchar(50) NOT NULL COMMENT '操作类型: login-登录, logout-登出, ssh_connect-SSH连接, command-命令执行',
  `command` text DEFAULT NULL,
  `result` text DEFAULT NULL,
  `risk_level` varchar(10) DEFAULT 'low' COMMENT '风险级别: low-低, medium-中, high-高',
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_action` (`action`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_risk_level` (`risk_level`),
  CONSTRAINT `fk_operation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_operation_logs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 插入默认数据

-- 默认角色
INSERT INTO `roles` (`name`, `description`, `permissions`) VALUES 
('admin', '系统管理员', '["all"]'),
('operator', '运维人员', '["asset:read", "asset:connect", "session:read"]'),
('auditor', '审计员', '["audit:read", "session:read", "log:read"]')
ON DUPLICATE KEY UPDATE 
`description` = VALUES(`description`),
`permissions` = VALUES(`permissions`);

-- 默认管理员用户 (密码: admin123)
INSERT INTO `users` (`username`, `password`, `email`, `status`) VALUES 
('admin', '$2a$10$8X8Z8Z8Z8Z8Z8Z8Z8Z8Z8u...', 'admin@bastion.local', 1)
ON DUPLICATE KEY UPDATE 
`email` = VALUES(`email`),
`status` = VALUES(`status`);

-- 为管理员分配角色
INSERT INTO `user_roles` (`user_id`, `role_id`) 
SELECT u.id, r.id FROM `users` u, `roles` r 
WHERE u.username = 'admin' AND r.name = 'admin'
ON DUPLICATE KEY UPDATE `user_id` = VALUES(`user_id`);

-- 示例资产数据
INSERT INTO `assets` (`name`, `type`, `address`, `port`, `protocol`, `tags`) VALUES 
('开发服务器-01', 'server', '192.168.1.10', 22, 'ssh', '{"env": "dev", "team": "backend"}'),
('生产数据库-01', 'database', '192.168.1.20', 3306, 'mysql', '{"env": "prod", "team": "dba"}')
ON DUPLICATE KEY UPDATE 
`address` = VALUES(`address`),
`port` = VALUES(`port`);

SET FOREIGN_KEY_CHECKS = 1;

-- 创建索引优化查询性能
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_sessions_user_time ON sessions(user_id, start_time);
CREATE INDEX idx_operation_logs_user_time ON operation_logs(user_id, timestamp);

-- 添加注释
ALTER TABLE users COMMENT = '用户表 - 存储系统用户信息';
ALTER TABLE roles COMMENT = '角色表 - 存储系统角色定义';
ALTER TABLE user_roles COMMENT = '用户角色关联表 - 多对多关系';
ALTER TABLE assets COMMENT = '资产表 - 存储服务器和数据库等资产';
ALTER TABLE credentials COMMENT = '凭证表 - 存储访问资产的认证信息';
ALTER TABLE sessions COMMENT = '会话记录表 - 存储用户访问会话';
ALTER TABLE operation_logs COMMENT = '操作日志表 - 存储用户操作记录';

-- 显示表结构
SHOW TABLES; 