-- 添加action列到command_logs表
-- 日期: 2025-01-31
-- 描述: 为命令日志表添加action字段，用于记录命令过滤动作类型

-- 添加action列，默认值为'allow'，表示允许执行
ALTER TABLE command_logs 
ADD COLUMN action VARCHAR(20) NOT NULL DEFAULT 'allow' 
COMMENT '命令过滤动作: block-阻断, allow-放行, warning-警告';

-- 添加action列的索引，方便按动作类型查询
CREATE INDEX idx_command_logs_action ON command_logs(action);

-- 更新现有数据，将所有现有记录的action设置为'allow'
UPDATE command_logs SET action = 'allow' WHERE action IS NULL OR action = '';

-- 可选：验证数据更新
-- SELECT action, COUNT(*) as count FROM command_logs GROUP BY action;