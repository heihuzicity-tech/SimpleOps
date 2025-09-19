-- 清理会话的临时脚本
-- 这个脚本用于清理所有活跃会话状态

USE bastion;

-- 显示当前活跃会话数量
SELECT COUNT(*) as current_active_sessions FROM session_records WHERE status = 'active';

-- 将所有活跃会话设为已关闭
UPDATE session_records 
SET status = 'closed', 
    end_time = NOW(), 
    updated_at = NOW(),
    is_terminated = FALSE
WHERE status = 'active';

-- 显示更新的行数
SELECT ROW_COUNT() as updated_rows;

-- 显示清理后的统计
SELECT 
    status,
    COUNT(*) as count
FROM session_records 
GROUP BY status
ORDER BY status;

-- 显示完成信息
SELECT 'Session cleanup completed successfully' AS message;