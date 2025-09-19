-- 实时监控功能数据库迁移脚本 - 简化版

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

-- 2. 创建会话警告消息表
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

-- 3. 创建WebSocket连接日志表
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

-- 4. 插入权限数据
INSERT IGNORE INTO permissions (name, description, category) VALUES 
('audit:monitor', '实时监控权限', 'audit'),
('audit:terminate', '会话终止权限', 'audit'),
('audit:warning', '发送警告权限', 'audit');

-- 5. 为admin角色添加新权限（如果permissions表和roles表存在）
INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, NOW()
FROM roles r, permissions p 
WHERE r.name = 'admin' 
AND p.name IN ('audit:monitor', 'audit:terminate', 'audit:warning');

-- 完成提示
SELECT 'Core real-time monitoring tables created successfully!' as status;