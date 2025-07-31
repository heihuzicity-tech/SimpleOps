#!/bin/bash

echo "=== 创建测试命令日志数据 ==="

# MySQL连接信息
MYSQL_HOST="10.0.0.7"
MYSQL_USER="root"
MYSQL_PASS="password123"
MYSQL_DB="bastion"

# 创建测试命令日志
echo "插入测试命令日志..."

mysql -h${MYSQL_HOST} -u${MYSQL_USER} -p${MYSQL_PASS} ${MYSQL_DB} << EOF
-- 插入测试命令日志
INSERT INTO command_logs (session_id, user_id, username, asset_id, command, output, exit_code, risk, start_time, end_time, duration, created_at, updated_at) VALUES
('ssh-test-001', 1, 'admin', 1, 'ls -la', 'total 48\ndrwxr-xr-x  6 user user 4096 Jan 30 10:00 .\ndrwxr-xr-x  5 user user 4096 Jan 30 09:00 ..\n-rw-r--r--  1 user user  220 Jan 30 09:00 .bash_logout\n-rw-r--r--  1 user user 3771 Jan 30 09:00 .bashrc\n-rw-r--r--  1 user user  807 Jan 30 09:00 .profile', 0, 'low', NOW() - INTERVAL 5 MINUTE, NOW() - INTERVAL 5 MINUTE + INTERVAL 1 SECOND, 1000, NOW() - INTERVAL 5 MINUTE, NOW() - INTERVAL 5 MINUTE),
('ssh-test-001', 1, 'admin', 1, 'pwd', '/home/user', 0, 'low', NOW() - INTERVAL 4 MINUTE, NOW() - INTERVAL 4 MINUTE, 100, NOW() - INTERVAL 4 MINUTE, NOW() - INTERVAL 4 MINUTE),
('ssh-test-001', 1, 'admin', 1, 'whoami', 'user', 0, 'low', NOW() - INTERVAL 3 MINUTE, NOW() - INTERVAL 3 MINUTE, 50, NOW() - INTERVAL 3 MINUTE, NOW() - INTERVAL 3 MINUTE),
('ssh-test-002', 2, 'testuser', 2, 'rm -rf /tmp/test', '', 0, 'high', NOW() - INTERVAL 2 MINUTE, NOW() - INTERVAL 2 MINUTE + INTERVAL 2 SECOND, 2000, NOW() - INTERVAL 2 MINUTE, NOW() - INTERVAL 2 MINUTE),
('ssh-test-002', 2, 'testuser', 2, 'cat /etc/passwd', 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin', 0, 'medium', NOW() - INTERVAL 1 MINUTE, NOW() - INTERVAL 1 MINUTE + INTERVAL 1 SECOND, 1500, NOW() - INTERVAL 1 MINUTE, NOW() - INTERVAL 1 MINUTE);

SELECT COUNT(*) as total_command_logs FROM command_logs;
EOF

echo ""
echo "=== 测试数据创建完成 ==="