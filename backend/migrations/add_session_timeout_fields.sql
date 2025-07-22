-- 会话超时字段迁移脚本
-- 执行前请确保已备份数据库
-- 备份命令: mysqldump -uroot -ppassword123 -h10.0.0.7 bastion > session_timeout_backup_$(date +%Y%m%d_%H%M%S).sql

-- 开始事务
START TRANSACTION;

-- 检查session_records表是否存在
SELECT COUNT(*) as table_exists FROM information_schema.tables 
WHERE table_schema = 'bastion' AND table_name = 'session_records';

-- 添加超时管理相关字段到session_records表
ALTER TABLE session_records 
ADD COLUMN timeout_minutes INT DEFAULT 0 COMMENT '会话超时时间(分钟)，0表示无限制',
ADD COLUMN last_activity DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后活动时间',
ADD COLUMN close_reason VARCHAR(50) DEFAULT 'user_close' COMMENT '关闭原因: user_close, timeout, admin_force, system_error';

-- 为新字段添加索引以优化查询性能
CREATE INDEX idx_session_timeout ON session_records(timeout_minutes, last_activity);
CREATE INDEX idx_session_close_reason ON session_records(close_reason);
CREATE INDEX idx_last_activity ON session_records(last_activity);

-- 更新现有记录的last_activity字段
UPDATE session_records 
SET last_activity = COALESCE(updated_at, created_at, NOW())
WHERE last_activity IS NULL;

-- 为已关闭的会话设置合理的close_reason
UPDATE session_records 
SET close_reason = CASE 
    WHEN status = 'closed' AND close_reason = 'user_close' THEN 'user_close'
    WHEN status = 'active' THEN 'user_close'
    ELSE close_reason
END;

-- 验证表结构
DESCRIBE session_records;

-- 验证字段添加成功
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE table_schema = 'bastion' 
  AND table_name = 'session_records'
  AND COLUMN_NAME IN ('timeout_minutes', 'last_activity', 'close_reason');

-- 检查索引创建
SHOW INDEX FROM session_records WHERE Key_name IN ('idx_session_timeout', 'idx_session_close_reason', 'idx_last_activity');

-- 提交事务
COMMIT;

-- 显示迁移完成信息
SELECT 
    'Migration completed successfully!' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN timeout_minutes IS NOT NULL THEN 1 END) as records_with_timeout,
    COUNT(CASE WHEN last_activity IS NOT NULL THEN 1 END) as records_with_activity,
    COUNT(CASE WHEN close_reason IS NOT NULL THEN 1 END) as records_with_close_reason
FROM session_records;