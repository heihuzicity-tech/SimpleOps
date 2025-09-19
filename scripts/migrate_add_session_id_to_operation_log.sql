-- 为操作日志表添加SessionID字段的数据库迁移脚本
-- 执行时间：2025-07-22
-- 目的：支持完整会话标识符存储，与会话审计保持一致性

USE bastion;

-- 添加SessionID字段
ALTER TABLE operation_logs 
ADD COLUMN session_id VARCHAR(100) NULL COMMENT '完整会话标识符' 
AFTER resource_id;

-- 为SessionID字段创建索引以提升查询性能
CREATE INDEX idx_operation_logs_session_id ON operation_logs(session_id);

-- 验证表结构
DESCRIBE operation_logs;

-- 显示新增字段信息
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'bastion' 
    AND TABLE_NAME = 'operation_logs' 
    AND COLUMN_NAME = 'session_id';

-- 统计现有记录数（迁移前）
SELECT COUNT(*) as total_records FROM operation_logs;

-- 显示会话相关记录（验证迁移效果）
SELECT 
    id,
    user_id,
    username,
    action,
    resource,
    resource_id,
    session_id,
    url,
    created_at
FROM operation_logs 
WHERE resource = 'session' 
ORDER BY created_at DESC 
LIMIT 5;

COMMIT;