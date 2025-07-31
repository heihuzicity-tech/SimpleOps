-- 移除审计日志表的软删除功能
-- 注意：执行此迁移前请先备份数据

-- 1. 移除 command_logs 表的 deleted_at 列
ALTER TABLE command_logs DROP COLUMN IF EXISTS deleted_at;

-- 2. 移除 operation_logs 表的 deleted_at 列
ALTER TABLE operation_logs DROP COLUMN IF EXISTS deleted_at;

-- 3. 移除 session_records 表的 deleted_at 列
ALTER TABLE session_records DROP COLUMN IF EXISTS deleted_at;

-- 4. 移除 login_logs 表的 deleted_at 列
ALTER TABLE login_logs DROP COLUMN IF EXISTS deleted_at;

-- 5. 添加注释说明这些表使用物理删除
ALTER TABLE command_logs COMMENT '命令日志表 - 使用物理删除，定期清理过期数据';
ALTER TABLE operation_logs COMMENT '操作日志表 - 使用物理删除，定期清理过期数据';
ALTER TABLE session_records COMMENT '会话记录表 - 使用物理删除，定期清理过期数据';
ALTER TABLE login_logs COMMENT '登录日志表 - 使用物理删除，定期清理过期数据';