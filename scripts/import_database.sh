#!/bin/bash

# 运维堡垒机系统数据库导入脚本
# 使用方法: ./scripts/import_database.sh [mysql_host] [mysql_port] [mysql_user] [mysql_password] [database_name]

set -e

# 默认配置
DEFAULT_HOST="10.0.0.7"
DEFAULT_PORT="3306"
DEFAULT_USER="root"
DEFAULT_PASSWORD=""
DEFAULT_DATABASE="bastion"

# 获取参数
MYSQL_HOST=${1:-$DEFAULT_HOST}
MYSQL_PORT=${2:-$DEFAULT_PORT}
MYSQL_USER=${3:-$DEFAULT_USER}
MYSQL_PASSWORD=${4:-$DEFAULT_PASSWORD}
DATABASE_NAME=${5:-$DEFAULT_DATABASE}

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/init.sql"

echo "=== 运维堡垒机系统数据库导入脚本 ==="
echo "MySQL Host: $MYSQL_HOST"
echo "MySQL Port: $MYSQL_PORT"
echo "MySQL User: $MYSQL_USER"
echo "Database: $DATABASE_NAME"
echo "SQL File: $SQL_FILE"
echo ""

# 检查MySQL客户端是否安装
if ! command -v mysql &> /dev/null; then
    echo "错误: 未找到mysql客户端，请先安装MySQL客户端"
    echo "macOS: brew install mysql-client"
    echo "Ubuntu/Debian: sudo apt-get install mysql-client"
    echo "CentOS/RHEL: sudo yum install mysql"
    exit 1
fi

# 检查SQL文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo "错误: SQL文件不存在: $SQL_FILE"
    exit 1
fi

# 提示用户输入密码（如果未提供）
if [ -z "$MYSQL_PASSWORD" ]; then
    echo -n "请输入MySQL密码: "
    read -s MYSQL_PASSWORD
    echo ""
fi

# 测试数据库连接
echo "测试数据库连接..."
if ! mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo "错误: 无法连接到MySQL数据库"
    echo "请检查连接参数和数据库服务是否正常"
    exit 1
fi

echo "✓ 数据库连接成功"

# 检查数据库是否存在，如果不存在则创建
echo "检查数据库是否存在..."
DB_EXISTS=$(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SHOW DATABASES LIKE '$DATABASE_NAME';" | grep -c "$DATABASE_NAME" || true)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "创建数据库: $DATABASE_NAME"
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "✓ 数据库创建成功"
else
    echo "✓ 数据库已存在"
fi

# 导入SQL文件
echo "导入数据库结构和初始数据..."
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$DATABASE_NAME" < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✓ 数据库导入成功"
else
    echo "✗ 数据库导入失败"
    exit 1
fi

# 验证导入结果
echo "验证数据库表..."
TABLE_COUNT=$(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$DATABASE_NAME" -e "SHOW TABLES;" | wc -l)
if [ "$TABLE_COUNT" -gt 1 ]; then
    echo "✓ 数据库表创建成功，共 $((TABLE_COUNT-1)) 个表"
    echo ""
    echo "数据库表列表:"
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$DATABASE_NAME" -e "SHOW TABLES;"
    echo ""
    echo "默认管理员账户:"
    echo "用户名: admin"
    echo "密码: admin123"
    echo ""
    echo "=== 数据库导入完成 ==="
else
    echo "✗ 数据库表创建失败"
    exit 1
fi 