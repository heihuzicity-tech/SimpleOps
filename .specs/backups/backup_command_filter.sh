#!/bin/bash

# ========================================
# 命令过滤功能数据备份脚本
# 创建时间：2025-01-30
# 功能：备份现有命令过滤相关的所有数据
# ========================================

# 设置变量
BACKUP_DIR="/Users/skip/workspace/bastion/.specs/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/command_filter_backup_$TIMESTAMP.sql"
DATA_ONLY_FILE="$BACKUP_DIR/command_filter_data_only_$TIMESTAMP.sql"

# 数据库连接信息（请根据实际情况修改）
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="bastion"
DB_USER="root"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印信息函数
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查目录
if [ ! -d "$BACKUP_DIR" ]; then
    print_info "创建备份目录: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

print_info "开始备份命令过滤相关数据..."
print_info "备份时间戳: $TIMESTAMP"

# 提示输入数据库密码
echo -n "请输入数据库密码: "
read -s DB_PASS
echo

# 备份表列表
TABLES=(
    "commands"
    "command_groups"
    "command_group_commands"
    "command_policies"
    "policy_users"
    "policy_commands"
    "command_intercept_logs"
)

# 执行完整备份（包含表结构）
print_info "执行完整备份（包含表结构）..."
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    "${TABLES[@]}" \
    > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    print_info "完整备份成功: $BACKUP_FILE"
else
    print_error "完整备份失败"
    exit 1
fi

# 执行数据备份（仅数据）
print_info "执行数据备份（仅数据）..."
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    --no-create-info \
    "${TABLES[@]}" \
    > "$DATA_ONLY_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    print_info "数据备份成功: $DATA_ONLY_FILE"
else
    print_error "数据备份失败"
    exit 1
fi

# 获取备份统计信息
print_info "获取备份统计信息..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    'commands' as table_name, COUNT(*) as count FROM commands
UNION ALL
    SELECT 'command_groups', COUNT(*) FROM command_groups
UNION ALL
    SELECT 'command_group_commands', COUNT(*) FROM command_group_commands
UNION ALL
    SELECT 'command_policies', COUNT(*) FROM command_policies
UNION ALL
    SELECT 'policy_users', COUNT(*) FROM policy_users
UNION ALL
    SELECT 'policy_commands', COUNT(*) FROM policy_commands
UNION ALL
    SELECT 'command_intercept_logs', COUNT(*) FROM command_intercept_logs;
" 2>/dev/null

# 创建备份说明文件
README_FILE="$BACKUP_DIR/README_$TIMESTAMP.md"
cat > "$README_FILE" << EOF
# 命令过滤功能备份说明

## 备份信息
- 备份时间: $(date)
- 备份时间戳: $TIMESTAMP
- 数据库: $DB_NAME

## 备份文件
1. **完整备份（含表结构）**: command_filter_backup_$TIMESTAMP.sql
2. **数据备份（仅数据）**: command_filter_data_only_$TIMESTAMP.sql

## 备份的表
- commands: 命令定义表
- command_groups: 命令组表
- command_group_commands: 命令组与命令关联表
- command_policies: 命令策略表
- policy_users: 策略与用户关联表
- policy_commands: 策略与命令/命令组关联表
- command_intercept_logs: 命令拦截日志表

## 恢复方法

### 恢复完整数据（包含表结构）
\`\`\`bash
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME < command_filter_backup_$TIMESTAMP.sql
\`\`\`

### 仅恢复数据（保留现有表结构）
\`\`\`bash
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME < command_filter_data_only_$TIMESTAMP.sql
\`\`\`

## 注意事项
- 恢复前请确保已经备份当前数据
- 恢复可能会覆盖现有数据
- 建议在测试环境先验证恢复过程
EOF

print_info "创建备份说明文件: $README_FILE"

# 显示备份文件大小
print_info "备份文件信息:"
ls -lh "$BACKUP_FILE" "$DATA_ONLY_FILE" | awk '{print "  " $9 ": " $5}'

print_info "备份完成！"
print_info "备份文件保存在: $BACKUP_DIR"

# 创建最新备份的符号链接
ln -sf "command_filter_backup_$TIMESTAMP.sql" "$BACKUP_DIR/command_filter_backup_latest.sql"
ln -sf "command_filter_data_only_$TIMESTAMP.sql" "$BACKUP_DIR/command_filter_data_latest.sql"
print_info "创建最新备份链接完成"