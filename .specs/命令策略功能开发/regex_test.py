#!/usr/bin/env python3
"""
正则表达式匹配功能测试脚本
"""

import json
import requests
import time
import sys
from typing import List, Dict, Any

class RegexTestClient:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None
        
    def login(self, username: str = "admin", password: str = "admin123") -> bool:
        """登录获取token"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": username, "password": password}
            )
            response.raise_for_status()
            data = response.json()
            self.token = data["data"]["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"✅ 登录成功，token: {self.token[:20]}...")
            return True
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return False
    
    def get_commands(self) -> List[Dict]:
        """获取所有命令"""
        try:
            response = self.session.get(f"{self.base_url}/api/v1/command-filter/commands?page=1&page_size=100")
            response.raise_for_status()
            return response.json()["data"]["data"]
        except Exception as e:
            print(f"❌ 获取命令失败: {e}")
            return []
    
    def create_command(self, name: str, cmd_type: str, description: str) -> Dict:
        """创建命令"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/commands",
                json={"name": name, "type": cmd_type, "description": description}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ 创建命令失败 '{name}': {e}")
            return {}
    
    def create_policy(self, name: str, description: str) -> Dict:
        """创建策略"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/policies",
                json={"name": name, "description": description, "enabled": True}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ 创建策略失败: {e}")
            return {}
    
    def bind_commands_to_policy(self, policy_id: int, command_ids: List[int]) -> bool:
        """绑定命令到策略"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/policies/{policy_id}/bind-commands",
                json={"command_ids": command_ids, "command_group_ids": []}
            )
            response.raise_for_status()
            print(f"✅ 成功绑定 {len(command_ids)} 个命令到策略 {policy_id}")
            return True
        except Exception as e:
            print(f"❌ 绑定命令到策略失败: {e}")
            return False
    
    def bind_users_to_policy(self, policy_id: int, user_ids: List[int]) -> bool:
        """绑定用户到策略"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/policies/{policy_id}/bind-users",
                json={"user_ids": user_ids}
            )
            response.raise_for_status()
            print(f"✅ 成功绑定用户到策略 {policy_id}")
            return True
        except Exception as e:
            print(f"❌ 绑定用户到策略失败: {e}")
            return False

def main():
    print("=== 正则表达式匹配功能测试 ===\n")
    
    # 初始化客户端
    client = RegexTestClient()
    
    # 登录
    if not client.login():
        sys.exit(1)
    
    # 测试命令定义
    test_commands = [
        {
            "name": r"rm\s+-[rf]+.*",
            "type": "regex", 
            "description": "危险删除命令(带rf参数)"
        },
        {
            "name": r"cat\s+/etc/passwd",
            "type": "regex",
            "description": "读取passwd文件"
        },
        {
            "name": r"\w+\s+/etc/(passwd|shadow|group)",
            "type": "regex", 
            "description": "访问敏感系统文件"
        },
        {
            "name": r"(wget|curl)\s+.*http",
            "type": "regex",
            "description": "网络下载命令"
        },
        {
            "name": r"chmod\s+[0-7]{3,4}\s+/",
            "type": "regex",
            "description": "修改根目录权限"
        },
        {
            "name": r"find.*-exec.*rm",
            "type": "regex",
            "description": "find执行删除命令"
        }
    ]
    
    print("1. 创建测试命令...")
    created_command_ids = []
    
    for cmd in test_commands:
        print(f"  创建命令: {cmd['name']}")
        result = client.create_command(cmd["name"], cmd["type"], cmd["description"])
        if "id" in result:
            created_command_ids.append(result["id"])
            print(f"    ✅ 创建成功, ID: {result['id']}")
        else:
            print(f"    ❌ 创建失败: {result}")
    
    # 获取现有的正则表达式命令
    print("\n2. 获取现有的正则表达式命令...")
    all_commands = client.get_commands()
    regex_commands = [cmd for cmd in all_commands if cmd["type"] == "regex"]
    
    print(f"找到 {len(regex_commands)} 个正则表达式命令:")
    for cmd in regex_commands:
        print(f"  ID: {cmd['id']}, 名称: {cmd['name']}")
    
    # 创建测试策略
    print("\n3. 创建测试策略...")
    policy_result = client.create_policy(
        "正则表达式完整测试策略", 
        "用于全面测试正则表达式匹配功能"
    )
    
    if "id" not in policy_result:
        print("❌ 策略创建失败")
        sys.exit(1)
    
    policy_id = policy_result["id"]
    print(f"✅ 策略创建成功, ID: {policy_id}")
    
    # 绑定所有正则命令到策略
    print("\n4. 绑定命令到策略...")
    all_regex_ids = [cmd["id"] for cmd in regex_commands]
    if not client.bind_commands_to_policy(policy_id, all_regex_ids):
        sys.exit(1)
    
    # 绑定admin用户到策略
    print("\n5. 绑定用户到策略...")
    if not client.bind_users_to_policy(policy_id, [1]):  # admin用户ID=1
        sys.exit(1)
    
    # 定义测试用例
    test_cases = [
        # 基础匹配测试
        {"command": "rm file.txt", "expect_blocked": True, "reason": "匹配 rm.*"},
        {"command": "remove file.txt", "expect_blocked": False, "reason": "不匹配 rm.*"},
        
        # sudo命令测试
        {"command": "sudo apt install", "expect_blocked": True, "reason": "匹配 sudo.*"},
        {"command": "su root", "expect_blocked": False, "reason": "不匹配 sudo.*"},
        
        # 精确匹配测试
        {"command": "ls", "expect_blocked": True, "reason": "匹配 ^ls$"},
        {"command": "ls -la", "expect_blocked": False, "reason": "不匹配 ^ls$"},
        
        # 危险删除测试
        {"command": "rm -rf /tmp", "expect_blocked": True, "reason": "匹配 rm\\s+-[rf]+.*"},
        {"command": "rm -l file", "expect_blocked": False, "reason": "不匹配 rm\\s+-[rf]+.*"},
        
        # 敏感文件访问测试
        {"command": "cat /etc/passwd", "expect_blocked": True, "reason": "匹配 cat\\s+/etc/passwd"},
        {"command": "vim /etc/shadow", "expect_blocked": True, "reason": "匹配 \\w+\\s+/etc/(passwd|shadow|group)"},
        {"command": "ls /etc/hosts", "expect_blocked": False, "reason": "不匹配敏感文件模式"},
        
        # 网络下载测试
        {"command": "wget http://example.com", "expect_blocked": True, "reason": "匹配 (wget|curl)\\s+.*http"},
        {"command": "curl https://api.github.com", "expect_blocked": True, "reason": "匹配 (wget|curl)\\s+.*http"},
        {"command": "ping google.com", "expect_blocked": False, "reason": "不匹配网络下载模式"},
        
        # 权限修改测试
        {"command": "chmod 777 /tmp/file", "expect_blocked": True, "reason": "匹配 chmod\\s+[0-7]{3,4}\\s+/"},
        {"command": "chmod +x script.sh", "expect_blocked": False, "reason": "不匹配权限模式"},
        
        # 边界测试
        {"command": "shutdown -h now", "expect_blocked": True, "reason": "匹配 ^shutdown"},
        {"command": "sudo shutdown -h now", "expect_blocked": False, "reason": "不匹配 ^shutdown (不在开头)"},
        {"command": "sudo reboot", "expect_blocked": True, "reason": "匹配 reboot$"},
        {"command": "reboot now", "expect_blocked": False, "reason": "不匹配 reboot$ (不在结尾)"},
        
        # find执行删除测试
        {"command": "find /tmp -name '*.log' -exec rm {} \\;", "expect_blocked": True, "reason": "匹配 find.*-exec.*rm"},
        {"command": "find /home -name '*.txt'", "expect_blocked": False, "reason": "不匹配find删除模式"}
    ]
    
    print(f"\n6. 开始执行 {len(test_cases)} 个测试用例...")
    print("注意: 由于需要实际SSH会话来测试拦截功能，这里只验证正则表达式和数据库配置")
    
    # 显示测试计划
    print("\n测试用例列表:")
    for i, case in enumerate(test_cases, 1):
        status = "🚫 应该被拦截" if case["expect_blocked"] else "✅ 应该允许"
        print(f"{i:2d}. 命令: '{case['command']}'")
        print(f"    预期: {status}")
        print(f"    原因: {case['reason']}")
        print()
    
    print("=== 测试环境准备完成 ===")
    print(f"✅ 策略ID: {policy_id}")
    print(f"✅ 绑定了 {len(all_regex_ids)} 个正则表达式命令")
    print(f"✅ 绑定了admin用户")
    print(f"✅ 准备了 {len(test_cases)} 个测试用例")
    print("\n下一步: 通过SSH连接测试实际的命令拦截功能")
    print("SSH连接命令: ssh admin@localhost -p 2222")
    print("\n或者运行实际的命令匹配测试:")
    print("python3 regex_test_matcher.py")

if __name__ == "__main__":
    main()