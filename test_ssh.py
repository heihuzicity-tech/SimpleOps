#!/usr/bin/env python3
"""
SSH连接测试脚本
用于验证SSH连接是否能正常工作
"""

import paramiko
import sys
import time
import select

def test_ssh_connection():
    """测试SSH连接"""
    try:
        # SSH连接参数 - 这些应该根据实际情况调整
        hostname = "localhost"  # 或者你的测试服务器地址
        username = "your_username"  # 替换为实际用户名
        password = "your_password"  # 替换为实际密码
        port = 22
        
        print(f"Testing SSH connection to {hostname}:{port}")
        
        # 创建SSH客户端
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 连接
        client.connect(hostname, port, username, password, timeout=10)
        print("✓ SSH连接成功")
        
        # 创建交互式shell
        channel = client.invoke_shell()
        print("✓ Shell创建成功")
        
        # 等待初始输出
        time.sleep(1)
        
        # 检查是否有输出
        if channel.recv_ready():
            output = channel.recv(1024).decode('utf-8')
            print(f"✓ 接收到初始输出: {repr(output)}")
        else:
            print("⚠ 没有接收到初始输出")
            
        # 发送一个简单命令
        channel.send("whoami\n")
        time.sleep(1)
        
        if channel.recv_ready():
            output = channel.recv(1024).decode('utf-8')
            print(f"✓ 命令输出: {repr(output)}")
        else:
            print("⚠ 命令没有输出")
            
        # 关闭连接
        channel.close()
        client.close()
        print("✓ 连接已关闭")
        
    except Exception as e:
        print(f"✗ SSH连接失败: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("SSH连接测试")
    print("=" * 50)
    print("注意：请根据实际情况修改SSH连接参数")
    print("=" * 50)
    
    success = test_ssh_connection()
    sys.exit(0 if success else 1)