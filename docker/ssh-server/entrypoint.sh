#!/bin/bash

# 确保SSH服务的主机密钥存在
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    ssh-keygen -A
fi

# 创建必要的目录
mkdir -p /var/run/sshd

# 确保权限正确
chmod 700 /root/.ssh 2>/dev/null || true
chmod 700 /home/testuser/.ssh 2>/dev/null || true

# 输出服务器信息（用于调试）
echo "SSH Server is starting..."
echo "Available users:"
echo "  - root (password: root123)"
echo "  - testuser (password: testpass)"
echo "Server IP will be assigned by Docker network"

# 启动SSH服务（前台运行）
exec /usr/sbin/sshd -D