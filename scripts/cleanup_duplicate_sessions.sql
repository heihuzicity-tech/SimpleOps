-- 清理重复的会话记录
-- 保留每个session_id的最早记录，删除其他重复记录

-- 首先查看重复记录的情况
SELECT session_id, COUNT(*) as count 
FROM session_records 
GROUP BY session_id 
HAVING COUNT(*) > 1;

-- 创建临时表存储要保留的记录ID
CREATE TEMPORARY TABLE records_to_keep AS
SELECT MIN(id) as id
FROM session_records
GROUP BY session_id;

-- 删除重复记录（保留最早的记录）
DELETE FROM session_records 
WHERE id NOT IN (SELECT id FROM records_to_keep);

-- 删除临时表
DROP TEMPORARY TABLE records_to_keep;

-- 再次检查是否还有重复记录
SELECT session_id, COUNT(*) as count 
FROM session_records 
GROUP BY session_id 
HAVING COUNT(*) > 1;

-- 创建唯一索引防止将来重复
ALTER TABLE session_records ADD UNIQUE INDEX idx_unique_session_id (session_id);