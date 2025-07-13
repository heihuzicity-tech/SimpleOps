-- 凭证多对多关系迁移脚本
-- 将现有的一对多关系改为多对多关系

BEGIN;

-- 1. 创建中间表
CREATE TABLE IF NOT EXISTS asset_credentials (
    asset_id BIGINT NOT NULL,
    credential_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (asset_id, credential_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
);

-- 2. 迁移现有数据到中间表
INSERT INTO asset_credentials (asset_id, credential_id, created_at)
SELECT asset_id, id, created_at 
FROM credentials 
WHERE asset_id IS NOT NULL AND asset_id > 0;

-- 3. 删除外键约束和 asset_id 字段
ALTER TABLE credentials DROP FOREIGN KEY fk_credentials_asset;
ALTER TABLE credentials DROP COLUMN asset_id;

COMMIT;

-- 检查迁移结果
SELECT 'Migration completed successfully' AS status;
SELECT COUNT(*) AS migrated_records FROM asset_credentials; 