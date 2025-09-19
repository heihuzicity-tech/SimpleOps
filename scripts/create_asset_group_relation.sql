-- 创建资产分组关联表
CREATE TABLE IF NOT EXISTS asset_group_assets (
    asset_id bigint NOT NULL,
    asset_group_id bigint unsigned NOT NULL,
    created_at datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (asset_id, asset_group_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_group_id) REFERENCES asset_groups(id) ON DELETE CASCADE
);

-- 更新asset_groups表结构，删除不需要的字段
ALTER TABLE asset_groups 
DROP FOREIGN KEY fk_asset_groups_parent,
DROP COLUMN type,
DROP COLUMN parent_id,
DROP COLUMN sort_order;