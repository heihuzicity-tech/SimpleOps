-- 实时监控功能数据库迁移脚本

-- 1. 创建会话监控日志表
CREATE TABLE IF NOT EXISTS session_monitor_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL COMMENT '会话ID',
    monitor_user_id BIGINT NOT NULL COMMENT '监控用户ID',
    action_type VARCHAR(50) NOT NULL COMMENT '操作类型: terminate, warning, view',
    action_data JSON COMMENT '操作数据',
    reason TEXT COMMENT '操作原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_session_id (session_id),
    INDEX idx_monitor_user (monitor_user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at),
    
    CONSTRAINT fk_monitor_user FOREIGN KEY (monitor_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话监控日志表';

-- 2. 扩展会话记录表，添加监控相关字段
ALTER TABLE session_records 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
ADD COLUMN IF NOT EXISTS monitor_count INT DEFAULT 0 COMMENT '监控次数',
ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN DEFAULT FALSE COMMENT '是否被终止',
ADD COLUMN IF NOT EXISTS termination_reason TEXT COMMENT '终止原因',
ADD COLUMN IF NOT EXISTS terminated_by BIGINT COMMENT '终止者用户ID',
ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP NULL COMMENT '终止时间';

-- 3. 添加索引优化查询性能
ALTER TABLE session_records 
ADD INDEX IF NOT EXISTS idx_last_activity (last_activity),
ADD INDEX IF NOT EXISTS idx_is_terminated (is_terminated),
ADD INDEX IF NOT EXISTS idx_terminated_by (terminated_by);

-- 4. 创建会话警告消息表
CREATE TABLE IF NOT EXISTS session_warnings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL COMMENT '会话ID',
    sender_user_id BIGINT NOT NULL COMMENT '发送者用户ID',
    receiver_user_id BIGINT NOT NULL COMMENT '接收者用户ID',
    message TEXT NOT NULL COMMENT '警告消息',
    level ENUM('info', 'warning', 'error') DEFAULT 'warning' COMMENT '消息级别',
    is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    read_at TIMESTAMP NULL COMMENT '阅读时间',
    
    INDEX idx_session_id (session_id),
    INDEX idx_sender (sender_user_id),
    INDEX idx_receiver (receiver_user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read),
    
    CONSTRAINT fk_warning_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_warning_receiver FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话警告消息表';

-- 5. 创建WebSocket连接日志表（可选，用于调试和统计）
CREATE TABLE IF NOT EXISTS websocket_connections (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id VARCHAR(100) NOT NULL COMMENT '客户端ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    connect_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '连接时间',
    disconnect_time TIMESTAMP NULL COMMENT '断开时间',
    ip_address VARCHAR(45) COMMENT '客户端IP',
    user_agent TEXT COMMENT '用户代理',
    duration INT COMMENT '连接持续时间（秒）',
    
    INDEX idx_user_id (user_id),
    INDEX idx_connect_time (connect_time),
    INDEX idx_client_id (client_id),
    
    CONSTRAINT fk_ws_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WebSocket连接日志表';

-- 6. 更新session_records表的外键约束
ALTER TABLE session_records 
ADD CONSTRAINT IF NOT EXISTS fk_terminated_by 
FOREIGN KEY (terminated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 7. 插入权限数据
INSERT INTO permissions (name, description, category) VALUES 
('audit:monitor', '实时监控权限', 'audit'),
('audit:terminate', '会话终止权限', 'audit'),
('audit:warning', '发送警告权限', 'audit')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 8. 为admin角色添加新权限
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, NOW()
FROM roles r, permissions p 
WHERE r.name = 'admin' 
AND p.name IN ('audit:monitor', 'audit:terminate', 'audit:warning')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- 9. 创建视图方便查询活跃会话详情
CREATE OR REPLACE VIEW active_sessions_view AS
SELECT 
    sr.id,
    sr.session_id,
    sr.user_id,
    sr.username,
    sr.asset_id,
    sr.asset_name,
    sr.asset_address,
    sr.credential_id,
    sr.protocol,
    sr.ip,
    sr.status,
    sr.start_time,
    sr.last_activity,
    sr.monitor_count,
    sr.is_terminated,
    TIMESTAMPDIFF(SECOND, sr.start_time, NOW()) as connection_duration,
    TIMESTAMPDIFF(SECOND, sr.last_activity, NOW()) as inactive_duration,
    u.email as user_email,
    a.type as asset_type
FROM session_records sr
LEFT JOIN users u ON sr.user_id = u.id
LEFT JOIN assets a ON sr.asset_id = a.id
WHERE sr.status = 'active' AND sr.is_terminated = FALSE
ORDER BY sr.start_time DESC;

-- 10. 创建存储过程用于清理过期连接日志
DELIMITER //
CREATE PROCEDURE CleanupWebSocketLogs(IN retention_days INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 清理过期的WebSocket连接日志
    DELETE FROM websocket_connections 
    WHERE connect_time < DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    -- 清理过期的会话监控日志
    DELETE FROM session_monitor_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    -- 清理过期的会话警告消息
    DELETE FROM session_warnings 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
    
    COMMIT;
    
    SELECT ROW_COUNT() as cleaned_rows;
END //
DELIMITER ;

-- 完成提示
SELECT 'Real-time monitoring database migration completed successfully!' as status;