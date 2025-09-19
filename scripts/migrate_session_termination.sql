-- 添加会话终止相关字段
-- 这个迁移脚本用于添加会话终止跟踪功能

USE bastion;

-- 添加会话终止相关字段
ALTER TABLE session_records 
ADD COLUMN is_terminated BOOLEAN DEFAULT FALSE COMMENT '是否被终止',
ADD COLUMN termination_reason VARCHAR(255) COMMENT '终止原因',
ADD COLUMN terminated_by INT UNSIGNED COMMENT '终止人ID',
ADD COLUMN terminated_at TIMESTAMP NULL COMMENT '终止时间';

-- 添加外键约束
ALTER TABLE session_records
ADD CONSTRAINT fk_session_terminated_by
FOREIGN KEY (terminated_by) REFERENCES users(id);

-- 更新现有记录，将已关闭的会话设为非终止状态
UPDATE session_records 
SET is_terminated = FALSE 
WHERE status IN ('closed', 'timeout') AND is_terminated IS NULL;

-- 创建索引以优化查询性能
CREATE INDEX idx_session_records_is_terminated ON session_records(is_terminated);
CREATE INDEX idx_session_records_status_terminated ON session_records(status, is_terminated);

-- 显示迁移完成信息
SELECT 'Session termination fields migration completed' AS message;