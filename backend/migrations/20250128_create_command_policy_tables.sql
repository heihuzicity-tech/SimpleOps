-- 命令策略功能数据库迁移脚本
-- 创建时间：2025-01-28
-- 功能：创建命令过滤相关的数据表

USE bastion;

-- ========================================
-- 1. 命令表
-- ========================================
CREATE TABLE IF NOT EXISTS `commands` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '命令名称或正则表达式',
    `type` varchar(20) DEFAULT 'exact' COMMENT '匹配类型: exact-精确匹配, regex-正则表达式',
    `description` varchar(500) DEFAULT NULL COMMENT '命令描述',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_command_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令定义表';

-- ========================================
-- 2. 命令组表
-- ========================================
CREATE TABLE IF NOT EXISTS `command_groups` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '命令组名称',
    `description` varchar(500) DEFAULT NULL COMMENT '命令组描述',
    `is_preset` tinyint(1) DEFAULT 0 COMMENT '是否为系统预设组',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_group_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组表';

-- ========================================
-- 3. 命令组与命令关联表
-- ========================================
CREATE TABLE IF NOT EXISTS `command_group_commands` (
    `command_group_id` bigint unsigned NOT NULL,
    `command_id` bigint unsigned NOT NULL,
    PRIMARY KEY (`command_group_id`, `command_id`),
    KEY `idx_command_id` (`command_id`),
    CONSTRAINT `fk_cgc_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cgc_command` FOREIGN KEY (`command_id`) REFERENCES `commands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组与命令关联表';

-- ========================================
-- 4. 命令策略表
-- ========================================
CREATE TABLE IF NOT EXISTS `command_policies` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '策略名称',
    `description` varchar(500) DEFAULT NULL COMMENT '策略描述',
    `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
    `priority` int DEFAULT 50 COMMENT '优先级（预留字段）',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_enabled` (`enabled`),
    KEY `idx_priority` (`priority`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令策略表';

-- ========================================
-- 5. 策略与用户关联表
-- ========================================
CREATE TABLE IF NOT EXISTS `policy_users` (
    `policy_id` bigint unsigned NOT NULL,
    `user_id` bigint unsigned NOT NULL,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`policy_id`, `user_id`),
    KEY `idx_user_id` (`user_id`),
    CONSTRAINT `fk_pu_policy` FOREIGN KEY (`policy_id`) REFERENCES `command_policies`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pu_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略与用户关联表';

-- ========================================
-- 6. 策略与命令/命令组关联表
-- ========================================
CREATE TABLE IF NOT EXISTS `policy_commands` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `policy_id` bigint unsigned NOT NULL,
    `command_id` bigint unsigned DEFAULT NULL,
    `command_group_id` bigint unsigned DEFAULT NULL,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_policy_id` (`policy_id`),
    KEY `idx_command_id` (`command_id`),
    KEY `idx_command_group_id` (`command_group_id`),
    CONSTRAINT `fk_pc_policy` FOREIGN KEY (`policy_id`) REFERENCES `command_policies`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pc_command` FOREIGN KEY (`command_id`) REFERENCES `commands`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pc_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE,
    CONSTRAINT `chk_command_or_group` CHECK (
        (`command_id` IS NOT NULL AND `command_group_id` IS NULL) OR
        (`command_id` IS NULL AND `command_group_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略与命令/命令组关联表';

-- ========================================
-- 7. 命令拦截日志表
-- ========================================
CREATE TABLE IF NOT EXISTS `command_intercept_logs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `session_id` varchar(100) NOT NULL COMMENT 'SSH会话ID',
    `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
    `username` varchar(50) NOT NULL COMMENT '用户名',
    `asset_id` bigint unsigned NOT NULL COMMENT '资产ID',
    `command` text NOT NULL COMMENT '被拦截的命令',
    `policy_id` bigint unsigned NOT NULL COMMENT '触发的策略ID',
    `policy_name` varchar(100) NOT NULL COMMENT '策略名称',
    `policy_type` varchar(20) NOT NULL COMMENT '策略类型: command或command_group',
    `intercept_time` timestamp NOT NULL COMMENT '拦截时间',
    `alert_level` varchar(20) DEFAULT NULL COMMENT '告警级别（预留字段）',
    `alert_sent` tinyint(1) DEFAULT 0 COMMENT '是否已发送告警（预留字段）',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_policy_id` (`policy_id`),
    KEY `idx_intercept_time` (`intercept_time`),
    CONSTRAINT `fk_cil_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cil_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cil_policy` FOREIGN KEY (`policy_id`) REFERENCES `command_policies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令拦截日志表';

-- ========================================
-- 8. 插入预设命令组和命令
-- ========================================

-- 插入预设命令组
INSERT INTO `command_groups` (`name`, `description`, `is_preset`) VALUES 
('危险命令-系统管理', '可能影响系统稳定性的管理命令', 1),
('危险命令-文件操作', '可能导致数据丢失的文件操作命令', 1),
('危险命令-网络操作', '可能影响网络连接的命令', 1);

-- 插入预设命令
INSERT INTO `commands` (`name`, `type`, `description`) VALUES 
-- 系统管理类
('shutdown', 'exact', '关闭系统'),
('reboot', 'exact', '重启系统'),
('init', 'exact', '切换运行级别'),
('halt', 'exact', '停止系统'),
('poweroff', 'exact', '关闭电源'),
-- 文件操作类
('rm', 'exact', '删除文件或目录'),
('dd', 'exact', '底层数据复制命令'),
('mkfs', 'exact', '创建文件系统'),
('fdisk', 'exact', '磁盘分区工具'),
-- 网络操作类
('ifconfig', 'exact', '网络接口配置'),
('iptables', 'exact', '防火墙规则配置'),
('route', 'exact', '路由表配置');

-- 关联预设命令到命令组
-- 系统管理组
INSERT INTO `command_group_commands` (`command_group_id`, `command_id`)
SELECT g.id, c.id FROM `command_groups` g, `commands` c 
WHERE g.name = '危险命令-系统管理' AND c.name IN ('shutdown', 'reboot', 'init', 'halt', 'poweroff');

-- 文件操作组
INSERT INTO `command_group_commands` (`command_group_id`, `command_id`)
SELECT g.id, c.id FROM `command_groups` g, `commands` c 
WHERE g.name = '危险命令-文件操作' AND c.name IN ('rm', 'dd', 'mkfs', 'fdisk');

-- 网络操作组
INSERT INTO `command_group_commands` (`command_group_id`, `command_id`)
SELECT g.id, c.id FROM `command_groups` g, `commands` c 
WHERE g.name = '危险命令-网络操作' AND c.name IN ('ifconfig', 'iptables', 'route');

-- ========================================
-- 9. 添加命令过滤权限
-- ========================================
INSERT IGNORE INTO `permissions` (`name`, `description`, `category`) VALUES 
('command_filter:read', '查看命令过滤', 'access_control'),
('command_filter:write', '管理命令过滤', 'access_control');

-- 为管理员角色添加命令过滤权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'admin' AND p.name IN ('command_filter:read', 'command_filter:write');

-- ========================================
-- 10. 创建索引以优化查询性能
-- ========================================
-- 为命令名称创建索引（支持快速匹配）
CREATE INDEX idx_command_name_type ON `commands` (`name`, `type`);

-- 为策略查询创建复合索引
CREATE INDEX idx_policy_enabled_priority ON `command_policies` (`enabled`, `priority`);

-- ========================================
-- 迁移完成
-- ========================================