-- 录屏功能数据库迁移脚本
-- 创建时间: 2025-07-19
-- 功能: 添加会话录制相关表

-- 创建会话录制表
CREATE TABLE IF NOT EXISTS `session_recordings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(255) NOT NULL COMMENT '会话ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户ID',
  `asset_id` bigint(20) unsigned NOT NULL COMMENT '资产ID',
  `start_time` datetime NOT NULL COMMENT '录制开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '录制结束时间',
  `duration` bigint(20) DEFAULT 0 COMMENT '录制时长(秒)',
  `file_path` varchar(500) NOT NULL COMMENT '录制文件路径',
  `file_size` bigint(20) DEFAULT 0 COMMENT '文件大小(字节)',
  `compressed_size` bigint(20) DEFAULT 0 COMMENT '压缩后大小(字节)',
  `format` varchar(50) DEFAULT 'asciicast' COMMENT '录制格式',
  `checksum` varchar(100) DEFAULT NULL COMMENT '文件校验和',
  `terminal_width` int(11) DEFAULT 80 COMMENT '终端宽度',
  `terminal_height` int(11) DEFAULT 24 COMMENT '终端高度',
  `total_bytes` bigint(20) DEFAULT 0 COMMENT '总字节数',
  `compressed_bytes` bigint(20) DEFAULT 0 COMMENT '压缩字节数',
  `compression_ratio` decimal(5,2) DEFAULT 0.00 COMMENT '压缩比',
  `record_count` int(11) DEFAULT 0 COMMENT '记录条数',
  `status` varchar(50) DEFAULT 'recording' COMMENT '状态: recording,completed,failed',
  `metadata` text COMMENT '录制元数据(JSON)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话录制记录表';

-- 创建录制配置表
CREATE TABLE IF NOT EXISTS `recording_configs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '配置名称',
  `description` text COMMENT '配置描述',
  `enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `auto_recording` tinyint(1) NOT NULL DEFAULT 1 COMMENT '自动录制',
  `formats` varchar(255) DEFAULT 'asciicast' COMMENT '录制格式',
  `compression_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '启用压缩',
  `compression_level` int(11) DEFAULT 6 COMMENT '压缩级别(1-9)',
  `max_file_size` bigint(20) DEFAULT 0 COMMENT '最大文件大小(字节,0为无限制)',
  `max_duration` bigint(20) DEFAULT 0 COMMENT '最大录制时长(秒,0为无限制)',
  `storage_path` varchar(500) DEFAULT '/var/bastion/recordings' COMMENT '存储路径',
  `retention_days` int(11) DEFAULT 30 COMMENT '保留天数',
  `cloud_storage_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT '启用云存储',
  `cloud_storage_config` text COMMENT '云存储配置(JSON)',
  `user_filters` text COMMENT '用户过滤器(JSON)',
  `asset_filters` text COMMENT '资产过滤器(JSON)',
  `permission_filters` text COMMENT '权限过滤器(JSON)',
  `created_by` bigint(20) unsigned NOT NULL COMMENT '创建者ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_enabled` (`enabled`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='录制配置表';

-- 插入默认配置
INSERT INTO `recording_configs` (
  `name`, 
  `description`, 
  `enabled`, 
  `auto_recording`, 
  `formats`, 
  `compression_enabled`, 
  `compression_level`, 
  `max_file_size`, 
  `max_duration`, 
  `storage_path`, 
  `retention_days`, 
  `cloud_storage_enabled`, 
  `created_by`
) VALUES (
  'default', 
  '默认录制配置', 
  1, 
  1, 
  'asciicast', 
  1, 
  6, 
  104857600, -- 100MB
  7200, -- 2小时
  '/var/bastion/recordings', 
  30, 
  0, 
  1
) ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `updated_at` = CURRENT_TIMESTAMP;

-- 为录屏功能添加权限
INSERT INTO `permissions` (`name`, `description`, `category`) VALUES
('recording:view', '查看会话录制列表和详情', 'recording'),
('recording:download', '下载录制文件', 'recording'),
('recording:delete', '删除录制记录和文件', 'recording'),
('recording:config', '管理录制配置', 'recording')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `category` = VALUES(`category`);

-- 为管理员角色分配录屏权限
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p 
WHERE p.name IN ('recording:view', 'recording:download', 'recording:delete', 'recording:config')
AND NOT EXISTS (
  SELECT 1 FROM `role_permissions` rp 
  WHERE rp.role_id = 1 AND rp.permission_id = p.id
);

-- 创建录制存储目录(如果可能的话)
-- 注意: 这个操作可能需要在应用层完成