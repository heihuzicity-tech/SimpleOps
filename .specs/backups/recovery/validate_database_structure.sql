-- ========================================
-- Bastion 数据库表结构验证脚本
-- 验证数据库恢复后的完整性和一致性
-- ========================================

USE bastion;

-- ========================================
-- 1. 表结构完整性检查
-- ========================================

-- 检查必要的表是否存在
SELECT 
    'Table Existence Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = 'bastion' 
              AND TABLE_NAME IN (
                  'users', 'roles', 'permissions', 'user_roles', 'role_permissions',
                  'asset_groups', 'assets', 'credentials', 'asset_credentials',
                  'login_logs', 'operation_logs', 'session_records', 'command_logs',
                  'session_monitor_logs', 'session_warnings', 'websocket_connections'
              )) = 17 
        THEN '✅ PASS: 所有必要表都存在'
        ELSE '❌ FAIL: 缺少必要的表'
    END as result,
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'bastion') as total_tables,
    17 as expected_tables;

-- ========================================
-- 2. 外键约束完整性检查
-- ========================================

-- 检查外键约束是否正确设置
SELECT 
    'Foreign Key Constraints Check' as check_type,
    TABLE_NAME as table_name,
    COLUMN_NAME as column_name,
    REFERENCED_TABLE_NAME as referenced_table,
    REFERENCED_COLUMN_NAME as referenced_column,
    CONSTRAINT_NAME as constraint_name,
    CASE 
        WHEN REFERENCED_TABLE_NAME IS NOT NULL THEN '✅ 外键存在'
        ELSE '❌ 外键缺失'
    END as status
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'bastion' 
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;

-- 验证关键外键数量
SELECT 
    'Foreign Key Count Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = 'bastion' AND REFERENCED_TABLE_NAME IS NOT NULL) >= 15
        THEN '✅ PASS: 外键约束数量正常'
        ELSE '❌ FAIL: 外键约束数量不足'
    END as result,
    (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'bastion' AND REFERENCED_TABLE_NAME IS NOT NULL) as actual_fk_count,
    '>=15' as expected_fk_count;

-- ========================================
-- 3. 索引完整性检查
-- ========================================

-- 检查重要索引是否存在
SELECT 
    'Index Check' as check_type,
    TABLE_NAME as table_name,
    INDEX_NAME as index_name,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns,
    CASE 
        WHEN NON_UNIQUE = 0 THEN '唯一索引'
        ELSE '普通索引'
    END as index_type
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'bastion' 
  AND INDEX_NAME != 'PRIMARY'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- ========================================
-- 4. 数据类型一致性检查
-- ========================================

-- 检查主键字段的数据类型
SELECT 
    'Primary Key Data Type Check' as check_type,
    TABLE_NAME as table_name,
    COLUMN_NAME as column_name,
    DATA_TYPE as data_type,
    COLUMN_TYPE as column_type,
    CASE 
        WHEN DATA_TYPE = 'bigint' AND COLUMN_TYPE LIKE '%unsigned%' 
        THEN '✅ 正确'
        ELSE '❌ 数据类型不一致'
    END as status
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'bastion' 
  AND COLUMN_KEY = 'PRI'
ORDER BY TABLE_NAME;

-- 检查关键字段的字符集
SELECT 
    'Character Set Check' as check_type,
    TABLE_NAME as table_name,
    COLUMN_NAME as column_name,
    CHARACTER_SET_NAME,
    COLLATION_NAME,
    CASE 
        WHEN CHARACTER_SET_NAME = 'utf8mb4' THEN '✅ 正确'
        WHEN CHARACTER_SET_NAME IS NULL THEN '⚪ 数值字段'
        ELSE '❌ 字符集不正确'
    END as status
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'bastion' 
  AND DATA_TYPE IN ('varchar', 'text', 'char')
  AND TABLE_NAME IN ('users', 'roles', 'permissions', 'assets', 'credentials')
ORDER BY TABLE_NAME, COLUMN_NAME;

-- ========================================
-- 5. 默认数据验证
-- ========================================

-- 验证默认用户是否存在
SELECT 
    'Default User Check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE username = 'admin')
        THEN '✅ PASS: 默认管理员用户存在'
        ELSE '❌ FAIL: 默认管理员用户不存在'
    END as result,
    (SELECT COUNT(*) FROM users) as total_users;

-- 验证默认角色是否存在
SELECT 
    'Default Roles Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM roles WHERE name IN ('admin', 'operator', 'auditor')) = 3
        THEN '✅ PASS: 默认角色完整'
        ELSE '❌ FAIL: 默认角色不完整'
    END as result,
    (SELECT COUNT(*) FROM roles) as total_roles,
    GROUP_CONCAT(name) as existing_roles
FROM roles;

-- 验证默认权限是否存在
SELECT 
    'Default Permissions Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM permissions) >= 20
        THEN '✅ PASS: 权限数量正常'
        ELSE '❌ FAIL: 权限数量不足'
    END as result,
    (SELECT COUNT(*) FROM permissions) as total_permissions,
    20 as expected_min_permissions;

-- 验证权限分类
SELECT 
    'Permission Categories Check' as check_type,
    category,
    COUNT(*) as permission_count,
    GROUP_CONCAT(name) as permissions
FROM permissions 
GROUP BY category
ORDER BY category;

-- 验证默认资产分组
SELECT 
    'Default Asset Groups Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM asset_groups) >= 4
        THEN '✅ PASS: 默认资产分组存在'
        ELSE '❌ FAIL: 默认资产分组不完整'
    END as result,
    (SELECT COUNT(*) FROM asset_groups) as total_groups,
    GROUP_CONCAT(name) as existing_groups
FROM asset_groups;

-- ========================================
-- 6. 关联关系验证
-- ========================================

-- 验证用户角色关联
SELECT 
    'User Role Association Check' as check_type,
    u.username,
    r.name as role_name,
    r.description as role_description,
    '✅ 关联正常' as status
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id;

-- 验证角色权限关联
SELECT 
    'Role Permission Association Check' as check_type,
    r.name as role_name,
    COUNT(rp.permission_id) as permission_count,
    CASE 
        WHEN r.name = 'admin' AND COUNT(rp.permission_id) >= 1 THEN '✅ Admin权限正常'
        WHEN r.name = 'operator' AND COUNT(rp.permission_id) >= 1 THEN '✅ Operator权限正常' 
        WHEN r.name = 'auditor' AND COUNT(rp.permission_id) >= 1 THEN '✅ Auditor权限正常'
        ELSE '❌ 权限关联异常'
    END as status
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name;

-- ========================================
-- 7. 表空间和存储引擎检查
-- ========================================

-- 检查表的存储引擎
SELECT 
    'Storage Engine Check' as check_type,
    TABLE_NAME as table_name,
    ENGINE as storage_engine,
    TABLE_COLLATION as collation,
    CASE 
        WHEN ENGINE = 'InnoDB' THEN '✅ 正确'
        ELSE '❌ 存储引擎不正确'
    END as engine_status,
    CASE 
        WHEN TABLE_COLLATION = 'utf8mb4_unicode_ci' THEN '✅ 正确'
        ELSE '❌ 排序规则不正确'
    END as collation_status
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion'
ORDER BY TABLE_NAME;

-- ========================================
-- 8. 视图和存储过程检查
-- ========================================

-- 检查审计统计视图
SELECT 
    'View Check' as check_type,
    TABLE_NAME as view_name,
    TABLE_TYPE as object_type,
    '✅ 视图存在' as status
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion' 
  AND TABLE_TYPE = 'VIEW';

-- 检查存储过程
SELECT 
    'Stored Procedure Check' as check_type,
    ROUTINE_NAME as procedure_name,
    ROUTINE_TYPE as routine_type,
    '✅ 存储过程存在' as status
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'bastion';

-- ========================================
-- 9. 性能和统计信息检查
-- ========================================

-- 表大小统计
SELECT 
    'Table Size Statistics' as check_type,
    TABLE_NAME as table_name,
    TABLE_ROWS as estimated_rows,
    ROUND(DATA_LENGTH/1024/1024, 2) as data_size_mb,
    ROUND(INDEX_LENGTH/1024/1024, 2) as index_size_mb,
    ROUND((DATA_LENGTH + INDEX_LENGTH)/1024/1024, 2) as total_size_mb
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'bastion' 
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- ========================================
-- 10. 最终验证摘要
-- ========================================

-- 生成验证摘要报告
SELECT 
    '========== 数据库结构验证摘要 ==========' as summary_report
UNION ALL
SELECT CONCAT('数据库名称: ', DATABASE()) 
UNION ALL
SELECT CONCAT('验证时间: ', NOW())
UNION ALL
SELECT CONCAT('总表数量: ', COUNT(*)) 
FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'bastion'
UNION ALL
SELECT CONCAT('总外键数: ', COUNT(*))
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'bastion' AND REFERENCED_TABLE_NAME IS NOT NULL
UNION ALL
SELECT CONCAT('总索引数: ', COUNT(DISTINCT INDEX_NAME))
FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'bastion' AND INDEX_NAME != 'PRIMARY'
UNION ALL
SELECT CONCAT('总用户数: ', COUNT(*)) FROM users
UNION ALL
SELECT CONCAT('总角色数: ', COUNT(*)) FROM roles  
UNION ALL
SELECT CONCAT('总权限数: ', COUNT(*)) FROM permissions
UNION ALL
SELECT CONCAT('总资产分组: ', COUNT(*)) FROM asset_groups
UNION ALL
SELECT '========================================';

-- 关键完整性检查汇总
SELECT 
    'FINAL VALIDATION SUMMARY' as validation_summary,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'bastion') >= 17 AND
            (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'bastion' AND REFERENCED_TABLE_NAME IS NOT NULL) >= 15 AND
            (SELECT COUNT(*) FROM users WHERE username = 'admin') = 1 AND
            (SELECT COUNT(*) FROM roles WHERE name IN ('admin', 'operator', 'auditor')) = 3 AND
            (SELECT COUNT(*) FROM permissions) >= 20 AND
            (SELECT COUNT(*) FROM asset_groups) >= 4
        )
        THEN '🎉 数据库结构恢复成功！所有检查通过！'
        ELSE '⚠️  数据库结构恢复存在问题，请检查上述错误项'
    END as final_result,
    NOW() as validation_completed_at;

-- ========================================
-- 验证脚本执行完成
-- ========================================