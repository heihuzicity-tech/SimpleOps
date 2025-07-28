-- 命令策略服务性能优化索引
-- 2025-07-28 性能测试后的索引优化方案

-- 1. 命令表索引优化
-- 为命令名称和类型添加复合索引，支持搜索和过滤
ALTER TABLE commands ADD INDEX idx_commands_name_type (name, type);
ALTER TABLE commands ADD INDEX idx_commands_type (type);
ALTER TABLE commands ADD INDEX idx_commands_created_at (created_at DESC);

-- 2. 策略表索引优化  
-- 为策略启用状态和创建时间添加索引
ALTER TABLE command_policies ADD INDEX idx_policies_enabled_created (enabled, created_at DESC);
ALTER TABLE command_policies ADD INDEX idx_policies_name (name);

-- 3. 命令组表索引优化
-- 为命令组预设状态和创建时间添加索引
ALTER TABLE command_groups ADD INDEX idx_command_groups_preset_created (is_preset, created_at DESC);
ALTER TABLE command_groups ADD INDEX idx_command_groups_name (name);

-- 4. 策略命令关联表索引优化
-- 优化策略和命令的关联查询
ALTER TABLE policy_commands ADD INDEX idx_policy_commands_policy (policy_id);
ALTER TABLE policy_commands ADD INDEX idx_policy_commands_command (command_id);
ALTER TABLE policy_commands ADD INDEX idx_policy_commands_group (command_group_id);

-- 5. 用户策略关联表索引优化
-- 优化用户策略绑定查询
ALTER TABLE policy_users ADD INDEX idx_policy_users_user (user_id);
ALTER TABLE policy_users ADD INDEX idx_policy_users_policy (policy_id);

-- 6. 命令拦截日志表索引优化
-- 为拦截日志的常用查询字段添加索引
ALTER TABLE command_intercept_logs ADD INDEX idx_intercept_logs_user_time (user_id, intercept_time DESC);
ALTER TABLE command_intercept_logs ADD INDEX idx_intercept_logs_session (session_id);
ALTER TABLE command_intercept_logs ADD INDEX idx_intercept_logs_asset (asset_id);
ALTER TABLE command_intercept_logs ADD INDEX idx_intercept_logs_policy (policy_id);
ALTER TABLE command_intercept_logs ADD INDEX idx_intercept_logs_time (intercept_time DESC);

-- 7. 命令组关联表索引优化
-- 优化命令和命令组的多对多关联
ALTER TABLE command_group_commands ADD INDEX idx_group_commands_group (command_group_id);
ALTER TABLE command_group_commands ADD INDEX idx_group_commands_command (command_id);

-- 查看索引创建结果
SHOW INDEX FROM commands;
SHOW INDEX FROM command_policies;
SHOW INDEX FROM command_groups;
SHOW INDEX FROM policy_commands;
SHOW INDEX FROM policy_users;
SHOW INDEX FROM command_intercept_logs;