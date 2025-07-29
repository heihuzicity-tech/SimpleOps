-- 创建session_timeouts表
-- 用于管理会话超时配置

START TRANSACTION;

-- 创建session_timeouts表
CREATE TABLE IF NOT EXISTS `session_timeouts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` VARCHAR(100) NOT NULL COMMENT '关联的会话ID',
  `timeout_minutes` INT NOT NULL DEFAULT 0 COMMENT '超时时间(分钟)，0表示无限制',
  `policy` VARCHAR(20) NOT NULL DEFAULT 'fixed' COMMENT '超时策略',
  `idle_minutes` INT DEFAULT NULL COMMENT '空闲时间(分钟)，适用于idle_kick策略',
  `last_activity` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
  `warnings_sent` INT DEFAULT 0 COMMENT '已发送警告次数',
  `last_warning_at` DATETIME DEFAULT NULL COMMENT '最后警告时间',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `extension_count` INT DEFAULT 0 COMMENT '延期次数',
  `max_extensions` INT DEFAULT 3 COMMENT '最大延期次数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话超时配置表';

-- 验证表创建成功
SELECT 'session_timeouts table created successfully' as status;

COMMIT;