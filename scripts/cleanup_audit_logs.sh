#!/bin/bash
# 审计日志清理脚本
# 使用方法: ./cleanup_audit_logs.sh [days]

# 默认保留90天
RETENTION_DAYS=${1:-90}

# 数据库配置
DB_HOST="10.0.0.7"
DB_USER="root"
DB_PASS="password123"
DB_NAME="bastion"

echo "=== 审计日志清理脚本 ==="
echo "保留最近 $RETENTION_DAYS 天的数据"
echo ""

# 显示当前数据量
echo "当前数据量统计："
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    'command_logs' as '表名', 
    COUNT(*) as '记录数',
    MIN(created_at) as '最早记录',
    MAX(created_at) as '最新记录'
FROM command_logs
UNION ALL
SELECT 'operation_logs', COUNT(*), MIN(created_at), MAX(created_at) FROM operation_logs
UNION ALL
SELECT 'session_records', COUNT(*), MIN(created_at), MAX(created_at) FROM session_records
UNION ALL
SELECT 'login_logs', COUNT(*), MIN(created_at), MAX(created_at) FROM login_logs;
"

# 确认操作
echo ""
read -p "确定要清理 $RETENTION_DAYS 天前的日志吗? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# 备份数据
echo ""
echo "正在备份数据..."
BACKUP_FILE="audit_backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME \
    command_logs operation_logs session_records login_logs > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "备份成功: $BACKUP_FILE"
else
    echo "备份失败，清理操作已中止"
    exit 1
fi

# 清理日志
echo ""
echo "开始清理..."

# 清理登录日志
echo -n "清理登录日志..."
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
DELETE FROM login_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL $RETENTION_DAYS DAY);
"
echo " 完成"

# 清理操作日志
echo -n "清理操作日志..."
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
DELETE FROM operation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL $RETENTION_DAYS DAY);
"
echo " 完成"

# 清理会话记录
echo -n "清理会话记录..."
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
DELETE FROM session_records WHERE created_at < DATE_SUB(NOW(), INTERVAL $RETENTION_DAYS DAY);
"
echo " 完成"

# 清理命令日志（保留高风险命令）
echo -n "清理命令日志（保留高风险）..."
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
DELETE FROM command_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL $RETENTION_DAYS DAY)
AND risk != 'high'
AND action != 'deny';
"
echo " 完成"

# 优化表
echo ""
echo "优化表空间..."
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
OPTIMIZE TABLE login_logs, operation_logs, session_records, command_logs;
"

# 显示清理后的数据量
echo ""
echo "清理后数据量统计："
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    'command_logs' as '表名', 
    COUNT(*) as '记录数',
    MIN(created_at) as '最早记录',
    MAX(created_at) as '最新记录'
FROM command_logs
UNION ALL
SELECT 'operation_logs', COUNT(*), MIN(created_at), MAX(created_at) FROM operation_logs
UNION ALL
SELECT 'session_records', COUNT(*), MIN(created_at), MAX(created_at) FROM session_records
UNION ALL
SELECT 'login_logs', COUNT(*), MIN(created_at), MAX(created_at) FROM login_logs;
"

echo ""
echo "清理完成！"