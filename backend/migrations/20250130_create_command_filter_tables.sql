-- ========================================
-- 命令过滤功能新表结构创建脚本
-- 创建时间：2025-01-30
-- 功能：创建全新的命令过滤相关表
-- ========================================

USE bastion;

-- ========================================
-- 1. 命令组表 (command_groups)
-- ========================================
CREATE TABLE IF NOT EXISTS `command_groups` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '命令组名称',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组表';

-- ========================================
-- 2. 命令组项表 (command_group_items)
-- ========================================
CREATE TABLE IF NOT EXISTS `command_group_items` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `command_group_id` bigint unsigned NOT NULL COMMENT '所属命令组ID',
    `type` varchar(20) NOT NULL DEFAULT 'command' COMMENT '类型: command-命令, regex-正则表达式',
    `content` varchar(500) NOT NULL COMMENT '命令内容或正则表达式',
    `ignore_case` tinyint(1) DEFAULT 0 COMMENT '是否忽略大小写',
    `sort_order` int DEFAULT 0 COMMENT '排序顺序',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_command_group_id` (`command_group_id`),
    KEY `idx_content` (`content`(100)),
    CONSTRAINT `fk_cgi_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组项表';

-- ========================================
-- 3. 命令过滤表 (command_filters)
-- ========================================
CREATE TABLE IF NOT EXISTS `command_filters` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '过滤规则名称',
    `priority` int NOT NULL DEFAULT 50 COMMENT '优先级，1-100，数字越小优先级越高',
    `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
    `user_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '用户类型: all-全部, specific-指定, attribute-属性',
    `asset_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '资产类型: all-全部, specific-指定, attribute-属性',
    `account_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '账号类型: all-全部, specific-指定',
    `account_names` varchar(500) DEFAULT NULL COMMENT '指定账号名称，逗号分隔',
    `command_group_id` bigint unsigned NOT NULL COMMENT '关联的命令组ID',
    `action` varchar(20) NOT NULL COMMENT '动作: deny-拒绝, allow-接受, alert-告警, prompt_alert-提示并告警',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_priority_enabled` (`priority`, `enabled`),
    KEY `idx_command_group_id` (`command_group_id`),
    KEY `idx_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_cf_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令过滤规则表';

-- ========================================
-- 4. 过滤规则用户关联表 (filter_users)
-- ========================================
CREATE TABLE IF NOT EXISTS `filter_users` (
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
    PRIMARY KEY (`filter_id`, `user_id`),
    KEY `idx_user_id` (`user_id`),
    CONSTRAINT `fk_fu_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_fu_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则用户关联表';

-- ========================================
-- 5. 过滤规则资产关联表 (filter_assets)
-- ========================================
CREATE TABLE IF NOT EXISTS `filter_assets` (
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `asset_id` bigint unsigned NOT NULL COMMENT '资产ID',
    PRIMARY KEY (`filter_id`, `asset_id`),
    KEY `idx_asset_id` (`asset_id`),
    CONSTRAINT `fk_fa_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_fa_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则资产关联表';

-- ========================================
-- 6. 过滤规则属性表 (filter_attributes)
-- ========================================
CREATE TABLE IF NOT EXISTS `filter_attributes` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `target_type` varchar(20) NOT NULL COMMENT '目标类型: user-用户属性, asset-资产属性',
    `attribute_name` varchar(50) NOT NULL COMMENT '属性名称',
    `attribute_value` varchar(200) NOT NULL COMMENT '属性值',
    PRIMARY KEY (`id`),
    KEY `idx_filter_id` (`filter_id`),
    KEY `idx_target_attribute` (`target_type`, `attribute_name`),
    CONSTRAINT `fk_fattr_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则属性表';

-- ========================================
-- 7. 命令过滤日志表 (command_filter_logs)
-- ========================================
CREATE TABLE IF NOT EXISTS `command_filter_logs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `session_id` varchar(100) NOT NULL COMMENT 'SSH会话ID',
    `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
    `username` varchar(50) NOT NULL COMMENT '用户名',
    `asset_id` bigint unsigned NOT NULL COMMENT '资产ID',
    `asset_name` varchar(100) NOT NULL COMMENT '资产名称',
    `account` varchar(50) NOT NULL COMMENT '登录账号',
    `command` text NOT NULL COMMENT '执行的命令',
    `filter_id` bigint unsigned NOT NULL COMMENT '触发的过滤规则ID',
    `filter_name` varchar(100) NOT NULL COMMENT '过滤规则名称',
    `action` varchar(20) NOT NULL COMMENT '执行的动作',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_filter_id` (`filter_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令过滤日志表';

-- ========================================
-- 8. 添加命令过滤权限
-- ========================================
INSERT IGNORE INTO `permissions` (`name`, `description`, `category`) VALUES 
('command_filter:read', '查看命令过滤', 'access_control'),
('command_filter:write', '管理命令过滤', 'access_control');

-- 为管理员角色添加命令过滤权限
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r, `permissions` p 
WHERE r.name = 'admin' AND p.name IN ('command_filter:read', 'command_filter:write');

-- ========================================
-- 9. 创建索引优化查询性能
-- ========================================
-- 命令内容索引（支持快速匹配）
CREATE INDEX idx_cgi_type_content ON `command_group_items` (`type`, `content`(100));

-- 过滤规则查询优化
CREATE INDEX idx_cf_user_type ON `command_filters` (`user_type`);
CREATE INDEX idx_cf_asset_type ON `command_filters` (`asset_type`);
CREATE INDEX idx_cf_account_type ON `command_filters` (`account_type`);

-- 日志查询优化
CREATE INDEX idx_cfl_user_asset ON `command_filter_logs` (`user_id`, `asset_id`);

-- ========================================
-- 10. 插入示例数据（可选）
-- ========================================
-- 创建一个示例命令组
INSERT INTO `command_groups` (`name`, `remark`) VALUES 
('危险命令示例', '包含一些常见的危险命令，仅供参考');

-- 获取刚插入的命令组ID
SET @group_id = LAST_INSERT_ID();

-- 添加一些示例命令
INSERT INTO `command_group_items` (`command_group_id`, `type`, `content`, `ignore_case`, `sort_order`) VALUES 
(@group_id, 'command', 'rm -rf', 0, 1),
(@group_id, 'command', 'shutdown', 0, 2),
(@group_id, 'command', 'reboot', 0, 3),
(@group_id, 'regex', '^dd\\s+if=', 0, 4),
(@group_id, 'regex', '^mkfs', 0, 5);

-- ========================================
-- 11. 验证表创建结果
-- ========================================
SELECT '=== 新表创建结果 ===' AS info;
SELECT 
    table_name,
    table_comment
FROM information_schema.tables 
WHERE table_schema = 'bastion' 
AND table_name IN (
    'command_groups',
    'command_group_items',
    'command_filters',
    'filter_users',
    'filter_assets',
    'filter_attributes',
    'command_filter_logs'
)
ORDER BY table_name;

-- 显示表记录统计
SELECT '=== 表记录统计 ===' AS info;
SELECT 'command_groups' as table_name, COUNT(*) as record_count FROM `command_groups`
UNION ALL
SELECT 'command_group_items', COUNT(*) FROM `command_group_items`
UNION ALL
SELECT 'command_filters', COUNT(*) FROM `command_filters`
UNION ALL
SELECT 'filter_users', COUNT(*) FROM `filter_users`
UNION ALL
SELECT 'filter_assets', COUNT(*) FROM `filter_assets`
UNION ALL
SELECT 'filter_attributes', COUNT(*) FROM `filter_attributes`
UNION ALL
SELECT 'command_filter_logs', COUNT(*) FROM `command_filter_logs`;

-- ========================================
-- 迁移脚本完成
-- ========================================
SELECT '=== 迁移完成 ===' AS info;
SELECT 'New command filter tables have been created successfully!' AS message;