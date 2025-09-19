#!/bin/bash

# 执行清理脚本
# 创建时间：2025-01-30

# 数据库连接信息
DB_HOST="10.0.0.7"
DB_PORT="3306"
DB_NAME="bastion"
DB_USER="root"
DB_PASS="password123"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_warning "即将执行数据清理操作！"
print_warning "这将删除所有命令过滤相关的表和数据！"
print_info "备份已完成，备份文件位于: .specs/backups/db/"

# 首先创建备份表（作为额外保险）
print_info "创建备份表..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /Users/skip/workspace/bastion/backend/migrations/20250130_create_backup_tables.sql

if [ $? -eq 0 ]; then
    print_info "备份表创建成功"
else
    print_error "备份表创建失败"
    exit 1
fi

# 执行清理脚本
print_info "执行清理脚本..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /Users/skip/workspace/bastion/backend/migrations/20250130_drop_old_command_tables.sql

if [ $? -eq 0 ]; then
    print_info "清理脚本执行成功"
else
    print_error "清理脚本执行失败"
    exit 1
fi

# 验证清理结果
print_info "验证清理结果..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    'Checking if old tables are dropped...' AS status;
SELECT 
    COUNT(*) as remaining_tables 
FROM information_schema.tables 
WHERE table_schema = 'bastion' 
AND table_name IN (
    'commands',
    'command_groups',
    'command_group_commands',
    'command_policies',
    'policy_users',
    'policy_commands',
    'command_intercept_logs'
);
"

print_info "清理完成！"
print_info "旧的命令过滤相关表已被删除。"
print_info "备份表仍然保留，可用于恢复数据。"