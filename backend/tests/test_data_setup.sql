-- 命令过滤功能集成测试数据初始化脚本
-- 作者: AI Test Automation Expert
-- 日期: 2025-07-30

-- 设置环境
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ========================================
-- 清理测试数据
-- ========================================

-- 清理命令过滤相关表
DELETE FROM command_filter_logs WHERE id > 0;
DELETE FROM filter_attributes WHERE id > 0;
DELETE FROM filter_users WHERE 1=1;
DELETE FROM filter_assets WHERE 1=1;
DELETE FROM command_filters WHERE id > 0;
DELETE FROM command_group_items WHERE id > 0;
DELETE FROM command_groups WHERE id > 0;

-- 清理用户和资产测试数据
DELETE FROM user_attributes WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test%');
DELETE FROM asset_attributes WHERE asset_id IN (SELECT id FROM assets WHERE name LIKE 'test-%');
DELETE FROM users WHERE username LIKE 'test%';
DELETE FROM assets WHERE name LIKE 'test-%';

-- ========================================
-- 重置自增ID
-- ========================================

ALTER TABLE users AUTO_INCREMENT = 1000;
ALTER TABLE assets AUTO_INCREMENT = 1000;
ALTER TABLE command_groups AUTO_INCREMENT = 1000;
ALTER TABLE command_group_items AUTO_INCREMENT = 1000;
ALTER TABLE command_filters AUTO_INCREMENT = 1000;
ALTER TABLE filter_attributes AUTO_INCREMENT = 1000;
ALTER TABLE command_filter_logs AUTO_INCREMENT = 1000;

-- ========================================
-- 插入测试用户数据
-- ========================================

-- 测试用户1: IT部门高级工程师
INSERT INTO users (id, username, email, password, realname, is_active, created_at, updated_at) VALUES
(1001, 'testuser1', 'testuser1@example.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXgwHTMLtuwqz6zyQkUOt8qLnFm', 'Test User 1', 1, NOW(), NOW());

-- 测试用户2: 财务部门初级员工
INSERT INTO users (id, username, email, password, realname, is_active, created_at, updated_at) VALUES
(1002, 'testuser2', 'testuser2@example.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXgwHTMLtuwqz6zyQkUOt8qLnFm', 'Test User 2', 1, NOW(), NOW());

-- 测试用户3: 开发部门中级工程师
INSERT INTO users (id, username, email, password, realname, is_active, created_at, updated_at) VALUES
(1003, 'testuser3', 'testuser3@example.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKXgwHTMLtuwqz6zyQkUOt8qLnFm', 'Test User 3', 1, NOW(), NOW());

-- 插入用户属性
INSERT INTO user_attributes (user_id, `key`, value, created_at, updated_at) VALUES
(1001, 'department', 'IT', NOW(), NOW()),
(1001, 'level', 'senior', NOW(), NOW()),
(1001, 'role', 'admin', NOW(), NOW()),
(1002, 'department', 'Finance', NOW(), NOW()),
(1002, 'level', 'junior', NOW(), NOW()),
(1002, 'role', 'user', NOW(), NOW()),
(1003, 'department', 'Development', NOW(), NOW()),
(1003, 'level', 'middle', NOW(), NOW()),
(1003, 'role', 'developer', NOW(), NOW());

-- ========================================
-- 插入测试资产数据
-- ========================================

-- 测试资产1: 生产环境Web服务器
INSERT INTO assets (id, name, ip, port, type, is_active, created_at, updated_at) VALUES
(1001, 'test-web-server-01', '192.168.1.10', 22, 'server', 1, NOW(), NOW());

-- 测试资产2: 开发环境数据库服务器
INSERT INTO assets (id, name, ip, port, type, is_active, created_at, updated_at) VALUES
(1002, 'test-db-server-01', '192.168.1.20', 22, 'database', 1, NOW(), NOW());

-- 测试资产3: 测试环境应用服务器
INSERT INTO assets (id, name, ip, port, type, is_active, created_at, updated_at) VALUES
(1003, 'test-app-server-01', '192.168.1.30', 22, 'application', 1, NOW(), NOW());

-- 测试资产4: 生产环境数据库服务器
INSERT INTO assets (id, name, ip, port, type, is_active, created_at, updated_at) VALUES
(1004, 'test-prod-db-01', '192.168.1.40', 22, 'database', 1, NOW(), NOW());

-- 插入资产属性
INSERT INTO asset_attributes (asset_id, `key`, value, created_at, updated_at) VALUES
(1001, 'env', 'production', NOW(), NOW()),
(1001, 'os', 'linux', NOW(), NOW()),
(1001, 'role', 'web', NOW(), NOW()),
(1002, 'env', 'development', NOW(), NOW()),
(1002, 'os', 'linux', NOW(), NOW()),
(1002, 'role', 'database', NOW(), NOW()),
(1003, 'env', 'test', NOW(), NOW()),
(1003, 'os', 'linux', NOW(), NOW()),
(1003, 'role', 'application', NOW(), NOW()),
(1004, 'env', 'production', NOW(), NOW()),
(1004, 'os', 'linux', NOW(), NOW()),
(1004, 'role', 'database', NOW(), NOW());

-- ========================================
-- 插入测试命令组数据
-- ========================================

-- 命令组1: 系统危险命令
INSERT INTO command_groups (id, name, remark, created_at, updated_at) VALUES
(1001, '系统危险命令', '包含可能对系统造成严重损害的命令', NOW(), NOW());

INSERT INTO command_group_items (command_group_id, type, content, ignore_case, sort_order, created_at) VALUES
(1001, 'command', 'rm -rf /', 0, 1, NOW()),
(1001, 'command', 'format c:', 1, 2, NOW()),
(1001, 'regex', '^shutdown\\s+(.*)', 1, 3, NOW()),
(1001, 'regex', '^halt\\s*', 1, 4, NOW()),
(1001, 'command', 'dd if=/dev/zero of=/dev/sda', 0, 5, NOW());

-- 命令组2: 数据库危险操作
INSERT INTO command_groups (id, name, remark, created_at, updated_at) VALUES
(1002, '数据库危险操作', '包含可能造成数据丢失的数据库命令', NOW(), NOW());

INSERT INTO command_group_items (command_group_id, type, content, ignore_case, sort_order, created_at) VALUES
(1002, 'regex', '^drop\\s+(database|table)\\s+', 1, 1, NOW()),
(1002, 'regex', 'delete\\s+from\\s+\\w+\\s+where\\s+1\\s*=\\s*1', 1, 2, NOW()),
(1002, 'regex', '^truncate\\s+table\\s+', 1, 3, NOW()),
(1002, 'command', 'mysqldump --all-databases > /dev/null', 0, 4, NOW());

-- 命令组3: 用户管理命令
INSERT INTO command_groups (id, name, remark, created_at, updated_at) VALUES
(1003, '用户管理命令', '用户账号管理相关命令', NOW(), NOW());

INSERT INTO command_group_items (command_group_id, type, content, ignore_case, sort_order, created_at) VALUES
(1003, 'regex', '^(useradd|userdel|usermod)\\s+', 0, 1, NOW()),
(1003, 'regex', '^passwd\\s+', 0, 2, NOW()),
(1003, 'command', 'sudo su -', 0, 3, NOW()),
(1003, 'regex', '^su\\s+-\\s+', 0, 4, NOW());

-- 命令组4: 网络诊断命令
INSERT INTO command_groups (id, name, remark, created_at, updated_at) VALUES
(1004, '网络诊断命令', '网络诊断和监控相关命令', NOW(), NOW());

INSERT INTO command_group_items (command_group_id, type, content, ignore_case, sort_order, created_at) VALUES
(1004, 'regex', '^(tcpdump|wireshark)\\s+', 0, 1, NOW()),
(1004, 'regex', '^nmap\\s+', 0, 2, NOW()),
(1004, 'command', 'netstat -an', 0, 3, NOW()),
(1004, 'regex', '^ss\\s+-', 0, 4, NOW());

-- 命令组5: 开发调试命令
INSERT INTO command_groups (id, name, remark, created_at, updated_at) VALUES
(1005, '开发调试命令', '开发和调试相关工具命令', NOW(), NOW());

INSERT INTO command_group_items (command_group_id, type, content, ignore_case, sort_order, created_at) VALUES
(1005, 'regex', '^(gdb|strace|ltrace)\\s+', 0, 1, NOW()),
(1005, 'regex', '^valgrind\\s+', 0, 2, NOW()),
(1005, 'command', 'perf record', 0, 3, NOW()),
(1005, 'regex', '^objdump\\s+', 0, 4, NOW());

-- ========================================
-- 插入测试过滤规则数据
-- ========================================

-- 过滤规则1: 全面禁止系统危险命令
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1001, '全面禁止系统危险命令', 1, 1, 'all', 'all', 'all', '', 1001, 'deny', '对所有用户禁止执行系统危险命令', NOW(), NOW());

-- 过滤规则2: IT部门数据库权限
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1002, 'IT部门数据库操作权限', 5, 1, 'attribute', 'attribute', 'all', '', 1002, 'allow', 'IT部门可以执行数据库操作', NOW(), NOW());

-- 过滤规则3: 非IT部门禁止数据库操作
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1003, '非IT部门禁止数据库操作', 10, 1, 'all', 'attribute', 'all', '', 1002, 'deny', '非IT部门禁止执行数据库危险操作', NOW(), NOW());

-- 过滤规则4: 生产环境调试限制
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1004, '生产环境禁止调试工具', 3, 1, 'all', 'attribute', 'all', '', 1005, 'deny', '生产环境禁止使用调试工具', NOW(), NOW());

-- 过滤规则5: 普通用户管理限制
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1005, '限制普通用户账号管理', 15, 1, 'all', 'all', 'specific', 'deploy,webapp,app', 1003, 'prompt_alert', '普通账号执行用户管理命令时提示告警', NOW(), NOW());

-- 过滤规则6: 网络诊断监控
INSERT INTO command_filters (id, name, priority, enabled, user_type, asset_type, account_type, account_names, command_group_id, action, remark, created_at, updated_at) VALUES
(1006, '网络诊断命令监控', 20, 1, 'all', 'all', 'all', '', 1004, 'alert', '监控网络诊断命令的使用', NOW(), NOW());

-- ========================================
-- 插入过滤规则属性数据
-- ========================================

-- IT部门数据库权限的属性
INSERT INTO filter_attributes (filter_id, target_type, attribute_name, attribute_value) VALUES
(1002, 'user', 'department', 'IT'),
(1002, 'asset', 'role', 'database');

-- 非IT部门禁止数据库操作的属性
INSERT INTO filter_attributes (filter_id, target_type, attribute_name, attribute_value) VALUES
(1003, 'asset', 'role', 'database');

-- 生产环境调试限制的属性
INSERT INTO filter_attributes (filter_id, target_type, attribute_name, attribute_value) VALUES
(1004, 'asset', 'env', 'production');

-- ========================================
-- 插入用户-过滤规则关联数据
-- ========================================

-- 特定用户的规则关联（如果需要）
-- INSERT INTO filter_users (filter_id, user_id) VALUES
-- (1002, 1001);

-- ========================================
-- 插入资产-过滤规则关联数据
-- ========================================

-- 特定资产的规则关联（如果需要）
-- INSERT INTO filter_assets (filter_id, asset_id) VALUES
-- (1002, 1002);

-- ========================================
-- 插入测试日志数据
-- ========================================

-- 模拟一些历史命令过滤日志
INSERT INTO command_filter_logs (session_id, user_id, username, asset_id, asset_name, account, command, filter_id, filter_name, action, created_at) VALUES
('session_001', 1001, 'testuser1', 1001, 'test-web-server-01', 'root', 'shutdown -h now', 1001, '全面禁止系统危险命令', 'deny', NOW() - INTERVAL 1 DAY),
('session_002', 1002, 'testuser2', 1002, 'test-db-server-01', 'mysql', 'drop database test', 1003, '非IT部门禁止数据库操作', 'deny', NOW() - INTERVAL 2 HOUR),
('session_003', 1001, 'testuser1', 1004, 'test-prod-db-01', 'dba', 'drop table old_data', 1002, 'IT部门数据库操作权限', 'allow', NOW() - INTERVAL 30 MINUTE),
('session_004', 1003, 'testuser3', 1001, 'test-web-server-01', 'deploy', 'useradd newuser', 1005, '限制普通用户账号管理', 'prompt_alert', NOW() - INTERVAL 15 MINUTE),
('session_005', 1001, 'testuser1', 1003, 'test-app-server-01', 'root', 'tcpdump -i eth0', 1006, '网络诊断命令监控', 'alert', NOW() - INTERVAL 5 MINUTE);

-- ========================================
-- 验证数据插入
-- ========================================

-- 显示插入的数据统计
SELECT 'Users' as table_name, COUNT(*) as count FROM users WHERE username LIKE 'test%'
UNION ALL
SELECT 'Assets', COUNT(*) FROM assets WHERE name LIKE 'test-%'
UNION ALL
SELECT 'Command Groups', COUNT(*) FROM command_groups WHERE id >= 1001
UNION ALL
SELECT 'Command Group Items', COUNT(*) FROM command_group_items WHERE command_group_id >= 1001
UNION ALL
SELECT 'Command Filters', COUNT(*) FROM command_filters WHERE id >= 1001
UNION ALL
SELECT 'Filter Attributes', COUNT(*) FROM filter_attributes WHERE filter_id >= 1001
UNION ALL
SELECT 'Filter Logs', COUNT(*) FROM command_filter_logs WHERE filter_id >= 1001;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- 提交事务
COMMIT;

-- 输出成功信息
SELECT '测试数据初始化完成！' as message, NOW() as timestamp;