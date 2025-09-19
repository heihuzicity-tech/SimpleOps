-- 资产分组功能增强迁移脚本
-- 将现有的多对多关系改为一对多关系，并添加层级支持

-- 1. 备份现有数据（如果需要）
-- CREATE TABLE asset_groups_backup AS SELECT * FROM asset_groups;

-- 2. 删除现有的多对多关联表（如果存在）
DROP TABLE IF EXISTS asset_asset_groups;

-- 3. 修改 asset_groups 表结构
-- 检查并添加 type 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_groups' AND COLUMN_NAME = 'type');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE asset_groups ADD COLUMN type VARCHAR(20) DEFAULT ''general'' COMMENT ''分组类型''', 'SELECT ''type column already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加 parent_id 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_groups' AND COLUMN_NAME = 'parent_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE asset_groups ADD COLUMN parent_id INT UNSIGNED NULL COMMENT ''父分组ID''', 'SELECT ''parent_id column already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加 sort_order 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_groups' AND COLUMN_NAME = 'sort_order');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE asset_groups ADD COLUMN sort_order INT DEFAULT 0 COMMENT ''排序字段''', 'SELECT ''sort_order column already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加索引
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_groups' AND INDEX_NAME = 'idx_asset_groups_parent_id');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE asset_groups ADD INDEX idx_asset_groups_parent_id (parent_id)', 'SELECT ''parent_id index already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_groups' AND INDEX_NAME = 'idx_asset_groups_type');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE asset_groups ADD INDEX idx_asset_groups_type (type)', 'SELECT ''type index already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. 修改 assets 表，添加分组关联字段
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'group_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE assets ADD COLUMN group_id INT UNSIGNED NULL COMMENT ''资产分组ID''', 'SELECT ''group_id column already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加索引
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets' AND INDEX_NAME = 'idx_assets_group_id');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE assets ADD INDEX idx_assets_group_id (group_id)', 'SELECT ''group_id index already exists'' as message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
    'SELECT "Foreign key constraint already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. 插入默认分组数据
INSERT IGNORE INTO asset_groups (name, description, type, parent_id, sort_order, created_at, updated_at) VALUES
('生产环境', '生产环境资产分组', 'production', NULL, 1, NOW(), NOW()),
('测试环境', '测试环境资产分组', 'test', NULL, 2, NOW(), NOW()),
('开发环境', '开发环境资产分组', 'dev', NULL, 3, NOW(), NOW()),
('通用分组', '通用资产分组', 'general', NULL, 4, NOW(), NOW());

-- 6. 获取默认分组ID并创建子分组
SET @prod_group_id = (SELECT id FROM asset_groups WHERE name = '生产环境' AND type = 'production');
SET @test_group_id = (SELECT id FROM asset_groups WHERE name = '测试环境' AND type = 'test');
SET @dev_group_id = (SELECT id FROM asset_groups WHERE name = '开发环境' AND type = 'dev');

-- 创建子分组
INSERT IGNORE INTO asset_groups (name, description, type, parent_id, sort_order, created_at, updated_at) VALUES
('Web服务器', 'Web服务器分组', 'production', @prod_group_id, 1, NOW(), NOW()),
('应用服务器', '应用服务器分组', 'production', @prod_group_id, 2, NOW(), NOW()),
('数据库服务器', '数据库服务器分组', 'production', @prod_group_id, 3, NOW(), NOW()),
('测试服务器', '测试服务器分组', 'test', @test_group_id, 1, NOW(), NOW()),
('开发服务器', '开发服务器分组', 'dev', @dev_group_id, 1, NOW(), NOW());

-- 7. 验证数据完整性
SELECT 
    ag.id,
    ag.name,
    ag.type,
    ag.parent_id,
    ag.sort_order,
    parent.name as parent_name,
    COUNT(a.id) as asset_count
FROM asset_groups ag
LEFT JOIN asset_groups parent ON ag.parent_id = parent.id
LEFT JOIN assets a ON ag.id = a.group_id
GROUP BY ag.id, ag.name, ag.type, ag.parent_id, ag.sort_order, parent.name
ORDER BY ag.parent_id, ag.sort_order;

-- 8. 显示迁移完成信息
SELECT 'Asset groups migration completed successfully!' as message;