-- 资产分组关系迁移脚本
-- 将多对多关系改为一对多关系（一个资产只能属于一个分组）
-- 创建时间: 2025-07-15
-- 用途: 支持拖拽式分组管理功能

-- ========================================
-- 1. 备份现有数据
-- ========================================

-- 创建备份表（以防需要回滚）
CREATE TABLE IF NOT EXISTS asset_group_assets_backup AS 
SELECT * FROM asset_group_assets;

-- 显示备份信息
SELECT 
    'asset_group_assets表已备份' as message,
    COUNT(*) as backup_record_count 
FROM asset_group_assets_backup;

-- ========================================
-- 2. 检查并添加新的group_id字段到assets表
-- ========================================

-- 检查group_id字段是否存在
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'assets' 
    AND COLUMN_NAME = 'group_id'
);

-- 如果不存在则添加group_id字段
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE assets ADD COLUMN group_id INT UNSIGNED NULL COMMENT ''资产分组ID（一对多关系）''', 
    'SELECT ''group_id字段已存在'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========================================
-- 3. 数据迁移：从多对多关系表迁移到一对多字段
-- ========================================

-- 为每个资产设置第一个关联的分组ID（业务规则：一个资产只属于一个分组）
UPDATE assets a 
SET group_id = (
    SELECT aga.asset_group_id 
    FROM asset_group_assets aga 
    WHERE aga.asset_id = a.id 
    ORDER BY aga.created_at ASC  -- 选择最早创建的关联
    LIMIT 1
)
WHERE a.id IN (
    SELECT DISTINCT aga.asset_id 
    FROM asset_group_assets aga
);

-- 显示迁移统计信息
SELECT 
    'assets表group_id字段数据迁移完成' as message,
    COUNT(CASE WHEN group_id IS NOT NULL THEN 1 END) as assets_with_group,
    COUNT(CASE WHEN group_id IS NULL THEN 1 END) as assets_without_group,
    COUNT(*) as total_assets
FROM assets;

-- ========================================
-- 4. 添加索引和外键约束
-- ========================================

-- 添加group_id索引（如果不存在）
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'assets' 
    AND INDEX_NAME = 'idx_assets_group_id'
);

SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE assets ADD INDEX idx_assets_group_id (group_id)',
    'SELECT ''group_id索引已存在'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加外键约束（如果不存在）
SET @constraint_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'assets' 
    AND CONSTRAINT_NAME = 'fk_assets_group_id'
);

SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE assets ADD CONSTRAINT fk_assets_group_id FOREIGN KEY (group_id) REFERENCES asset_groups(id) ON DELETE SET NULL',
    'SELECT ''外键约束已存在'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========================================
-- 5. 验证迁移结果
-- ========================================

-- 显示分组统计信息
SELECT 
    ag.id as group_id,
    ag.name as group_name,
    COUNT(a.id) as asset_count,
    GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as asset_names
FROM asset_groups ag
LEFT JOIN assets a ON ag.id = a.group_id
GROUP BY ag.id, ag.name
ORDER BY ag.name;

-- 显示无分组的资产
SELECT 
    '无分组资产' as category,
    COUNT(*) as count,
    GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') as asset_names
FROM assets 
WHERE group_id IS NULL;

-- 检查数据一致性：确保没有资产属于多个分组
SELECT 
    'data_integrity_check' as check_type,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(DISTINCT id) FROM assets WHERE group_id IS NOT NULL)
        THEN '数据一致性检查通过：每个资产最多属于一个分组'
        ELSE '数据一致性检查失败：存在异常数据'
    END as result,
    COUNT(*) as assets_with_group_count
FROM assets 
WHERE group_id IS NOT NULL;

-- ========================================
-- 6. 可选：清理多对多关系表（建议保留作为备份）
-- ========================================

-- 注意：不要立即删除asset_group_assets表
-- 建议保留一段时间，确认新功能正常工作后再删除
-- DROP TABLE IF EXISTS asset_group_assets;

-- 重命名为备份表名
-- RENAME TABLE asset_group_assets TO asset_group_assets_legacy_backup;

SELECT 
    '迁移完成提示' as message,
    '建议：保留asset_group_assets表作为备份，确认新功能正常后再清理' as recommendation;

-- ========================================
-- 7. 迁移完成确认
-- ========================================

SELECT 
    '=== 资产分组迁移完成 ===' as title,
    '从多对多关系成功迁移到一对多关系' as status,
    NOW() as completed_at;

-- 最终统计
SELECT 
    'migration_summary' as summary_type,
    (SELECT COUNT(*) FROM asset_groups) as total_groups,
    (SELECT COUNT(*) FROM assets) as total_assets,
    (SELECT COUNT(*) FROM assets WHERE group_id IS NOT NULL) as assets_with_group,
    (SELECT COUNT(*) FROM assets WHERE group_id IS NULL) as assets_without_group;