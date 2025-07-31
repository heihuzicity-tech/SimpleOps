#!/bin/bash
# 测试环境数据清理脚本
# 警告：仅用于测试环境！

# 数据库配置
DB_HOST="10.0.0.7"
DB_USER="root"
DB_PASS="password123"
DB_NAME="bastion"

echo "=== 测试数据清理脚本 ==="
echo "警告：此脚本仅用于测试环境！"
echo ""

# 显示当前数据量
echo "当前数据量统计："
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    'command_logs' as '表名', 
    COUNT(*) as '记录数'
FROM command_logs
UNION ALL
SELECT 'operation_logs', COUNT(*) FROM operation_logs
UNION ALL
SELECT 'session_records', COUNT(*) FROM session_records
UNION ALL
SELECT 'login_logs', COUNT(*) FROM login_logs;
"

# 确认操作
echo ""
echo "可选操作："
echo "1. 清理所有命令日志"
echo "2. 清理所有会话记录"
echo "3. 清理所有操作日志"
echo "4. 清理所有登录日志"
echo "5. 清理所有审计日志（危险！）"
echo "6. 只清理测试用户的数据"
echo "0. 退出"
echo ""
read -p "请选择操作 (0-6): " choice

case $choice in
    1)
        echo "清理所有命令日志..."
        mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "DELETE FROM command_logs;"
        echo "完成！"
        ;;
    2)
        echo "清理所有会话记录..."
        mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "DELETE FROM session_records;"
        echo "完成！"
        ;;
    3)
        echo "清理所有操作日志..."
        mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "DELETE FROM operation_logs;"
        echo "完成！"
        ;;
    4)
        echo "清理所有登录日志..."
        mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "DELETE FROM login_logs;"
        echo "完成！"
        ;;
    5)
        read -p "确定要清理所有审计日志吗？输入 'DELETE ALL' 确认: " confirm
        if [ "$confirm" = "DELETE ALL" ]; then
            echo "清理所有审计日志..."
            mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
                DELETE FROM command_logs;
                DELETE FROM operation_logs;
                DELETE FROM session_records;
                DELETE FROM login_logs;
            "
            echo "完成！"
        else
            echo "操作已取消"
        fi
        ;;
    6)
        echo "清理测试用户(testuser)的数据..."
        mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
            DELETE FROM command_logs WHERE username = 'testuser';
            DELETE FROM operation_logs WHERE username = 'testuser';
            DELETE FROM session_records WHERE username = 'testuser';
            DELETE FROM login_logs WHERE username = 'testuser';
        "
        echo "完成！"
        ;;
    0)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效的选择"
        exit 1
        ;;
esac

# 显示清理后的数据量
echo ""
echo "清理后数据量统计："
mysql -h$DB_HOST -u$DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    'command_logs' as '表名', 
    COUNT(*) as '记录数'
FROM command_logs
UNION ALL
SELECT 'operation_logs', COUNT(*) FROM operation_logs
UNION ALL
SELECT 'session_records', COUNT(*) FROM session_records
UNION ALL
SELECT 'login_logs', COUNT(*) FROM login_logs;
"