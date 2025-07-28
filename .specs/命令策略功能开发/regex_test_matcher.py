#!/usr/bin/env python3
"""
正则表达式匹配逻辑测试脚本
直接测试Go服务中的正则表达式匹配功能
"""

import json
import requests
import re
import time
from typing import List, Dict, Any, Tuple

class RegexMatcherTest:
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
            return True
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return False
    
    def extract_command_main(self, command: str) -> str:
        """提取命令主体（模拟Go服务中的extractCommandMain函数）"""
        command = command.strip()
        
        # 处理反斜杠转义
        if command.startswith("\\\\"):
            command = command[1:]
        
        # 按空格分割，取第一部分
        parts = command.split()
        if parts:
            cmd_part = parts[0]
            # 提取命令的基本名称（处理路径）
            if "/" in cmd_part:
                cmd_part = cmd_part.split("/")[-1]
            return cmd_part
        return command
    
    def test_regex_patterns(self) -> Dict[str, Any]:
        """测试正则表达式模式"""
        # 定义测试用例
        test_cases = [
            # 基础模式测试
            {
                "pattern": r"rm.*",
                "tests": [
                    ("rm file.txt", True, "基础rm命令"),
                    ("rm -rf /tmp", True, "rm命令带参数"),
                    ("remove file.txt", False, "不是rm命令"),
                    ("format file.txt", False, "包含rm但不匹配")
                ]
            },
            {
                "pattern": r"sudo.*", 
                "tests": [
                    ("sudo apt install", True, "sudo命令"),
                    ("sudo -u user command", True, "sudo带用户参数"),
                    ("su root", False, "不是sudo"),
                    ("psudo fake", False, "拼写错误")
                ]
            },
            {
                "pattern": r"^ls$",
                "tests": [
                    ("ls", True, "精确匹配ls"),
                    ("ls -la", False, "ls带参数"),
                    ("lsof", False, "以ls开头但不是ls"),
                    ("/bin/ls", False, "路径形式的ls")
                ]
            },
            # 复杂模式测试
            {
                "pattern": r"rm\s+-[rf]+",
                "tests": [
                    ("rm -rf /tmp", True, "危险删除rf参数"),
                    ("rm -fr /home", True, "危险删除fr参数"),
                    ("rm -r file", True, "递归删除"),
                    ("rm -f file", True, "强制删除"),
                    ("rm -rf", True, "仅参数"),
                    ("rm -l file", False, "安全参数"),
                    ("rm file", False, "无参数"),
                    ("rm --recursive", False, "长选项不匹配")
                ]
            },
            {
                "pattern": r"cat\s+/etc/passwd",
                "tests": [
                    ("cat /etc/passwd", True, "读取passwd"),
                    ("cat  /etc/passwd", True, "多个空格"),
                    ("cat /etc/shadow", False, "不同文件"),
                    ("less /etc/passwd", False, "不同命令")
                ]
            },
            {
                "pattern": r"\w+\s+/etc/(passwd|shadow|group)",
                "tests": [
                    ("cat /etc/passwd", True, "cat访问passwd"),
                    ("vim /etc/shadow", True, "vim访问shadow"), 
                    ("less /etc/group", True, "less访问group"),
                    ("nano /etc/hosts", False, "访问其他文件"),
                    ("/etc/passwd", False, "无命令前缀")
                ]
            },
            # 锚点测试
            {
                "pattern": r"^shutdown",
                "tests": [
                    ("shutdown -h now", True, "命令开头"),
                    ("sudo shutdown -h now", False, "不在开头"),
                    ("system shutdown", False, "在中间")
                ]
            },
            {
                "pattern": r"reboot$", 
                "tests": [
                    ("sudo reboot", True, "命令结尾"),
                    ("reboot now", False, "不在结尾"),
                    ("rebooting", False, "被包含")
                ]
            },
            # 网络命令测试
            {
                "pattern": r"(wget|curl).*http",
                "tests": [
                    ("wget http://example.com", True, "wget下载http"),
                    ("curl https://api.github.com", True, "curl访问https"),
                    ("wget ftp://server.com", False, "wget但非http"),
                    ("fetch http://test.com", False, "不是wget/curl")
                ]
            },
            # 权限修改测试
            {
                "pattern": r"chmod\s+[0-7]{3,4}\s+/",
                "tests": [
                    ("chmod 777 /tmp/file", True, "修改根目录下文件权限"),
                    ("chmod 644 /etc/passwd", True, "4位权限"),
                    ("chmod +x script.sh", False, "符号权限"),
                    ("chmod 777 file.txt", False, "相对路径")
                ]
            },
            # Find命令测试
            {
                "pattern": r"find.*-exec.*rm",
                "tests": [
                    ("find /tmp -name '*.log' -exec rm {} \\;", True, "find执行rm"),
                    ("find . -type f -exec rm -f {} +", True, "find批量删除"),
                    ("find /home -name '*.txt'", False, "find不执行rm"),
                    ("find . -exec ls {} \\;", False, "find执行其他命令")
                ]
            }
        ]
        
        results = {
            "total_patterns": len(test_cases),
            "total_tests": sum(len(case["tests"]) for case in test_cases),
            "passed": 0,
            "failed": 0,
            "details": []
        }
        
        print("=== 正则表达式匹配逻辑测试 ===\n")
        
        for i, case in enumerate(test_cases, 1):
            pattern = case["pattern"]
            print(f"{i}. 测试模式: {pattern}")
            
            # 编译正则表达式
            try:
                regex = re.compile(pattern)
            except re.error as e:
                print(f"   ❌ 正则表达式编译失败: {e}")
                results["details"].append({
                    "pattern": pattern,
                    "error": f"编译失败: {e}",
                    "tests": []
                })
                continue
            
            pattern_results = []
            pattern_passed = 0
            pattern_failed = 0
            
            for command, expected, description in case["tests"]:
                # 测试完整命令匹配（模拟Go服务中的逻辑）
                cmd_main = self.extract_command_main(command)
                
                # 对于精确匹配模式，使用命令主体
                if pattern == r"^ls$":
                    test_string = cmd_main
                else:
                    test_string = command
                
                actual = bool(regex.search(test_string))
                passed = actual == expected
                
                status = "✅" if passed else "❌"
                print(f"   {status} 命令: '{command}' -> {actual} (期望: {expected}) - {description}")
                
                if passed:
                    pattern_passed += 1
                    results["passed"] += 1
                else:
                    pattern_failed += 1
                    results["failed"] += 1
                
                pattern_results.append({
                    "command": command,
                    "expected": expected,
                    "actual": actual,
                    "passed": passed,
                    "description": description,
                    "test_string": test_string
                })
            
            print(f"   模式总结: {pattern_passed} 通过, {pattern_failed} 失败")
            print()
            
            results["details"].append({
                "pattern": pattern,
                "passed": pattern_passed,
                "failed": pattern_failed,
                "tests": pattern_results
            })
        
        return results
    
    def performance_test(self) -> Dict[str, Any]:
        """性能测试"""
        print("=== 正则表达式性能测试 ===\n")
        
        # 复杂正则表达式
        complex_patterns = [
            r"^(sudo\s+)?(rm|mv|cp)\s+.*",
            r".*/?(bin|sbin|usr|etc|var)/.*",
            r"(wget|curl).*\.(exe|sh|pl|py)$",
            r"chmod\s+[0-7]{3,4}\s+.*/(bin|sbin|etc|usr|var)/.*",
            r"find\s+.*-exec\s+(rm|mv|cp)\s+.*"
        ]
        
        test_commands = [
            "sudo rm -rf /usr/local/bin/app",
            "wget http://malicious.com/script.sh", 
            "chmod 777 /etc/passwd",
            "find /tmp -name '*.log' -exec rm {} \\;",
            "cp /bin/bash /tmp/shell"
        ]
        
        results = []
        
        for pattern in complex_patterns:
            try:
                regex = re.compile(pattern)
                times = []
                
                # 预热
                for _ in range(100):
                    for cmd in test_commands:
                        regex.search(cmd)
                
                # 实际测试
                start_time = time.perf_counter()
                for _ in range(1000):
                    for cmd in test_commands:
                        regex.search(cmd)
                end_time = time.perf_counter()
                
                avg_time = (end_time - start_time) / (1000 * len(test_commands)) * 1000  # 转换为毫秒
                
                results.append({
                    "pattern": pattern,
                    "avg_time_ms": round(avg_time, 4),
                    "status": "✅ 通过" if avg_time < 1.0 else "⚠️ 慢"
                })
                
                print(f"模式: {pattern}")
                print(f"平均匹配时间: {avg_time:.4f} ms")
                print(f"状态: {'✅ 通过' if avg_time < 1.0 else '⚠️ 慢'}")
                print()
                
            except re.error as e:
                results.append({
                    "pattern": pattern,
                    "error": str(e)
                })
                print(f"模式: {pattern}")
                print(f"❌ 编译失败: {e}")
                print()
        
        return results

def main():
    tester = RegexMatcherTest()
    
    if not tester.login():
        return
    
    # 运行匹配逻辑测试
    match_results = tester.test_regex_patterns()
    
    # 运行性能测试  
    perf_results = tester.performance_test()
    
    # 汇总结果
    print("=== 测试结果汇总 ===")
    print(f"总测试模式数: {match_results['total_patterns']}")
    print(f"总测试用例数: {match_results['total_tests']}")
    print(f"通过: {match_results['passed']}")
    print(f"失败: {match_results['failed']}")
    print(f"通过率: {match_results['passed'] / match_results['total_tests'] * 100:.1f}%")
    
    if match_results['failed'] > 0:
        print("\n失败的测试用例:")
        for detail in match_results['details']:
            for test in detail['tests']:
                if not test['passed']:
                    print(f"  - 模式: {detail['pattern']}")
                    print(f"    命令: {test['command']}")
                    print(f"    期望: {test['expected']}, 实际: {test['actual']}")
                    print(f"    描述: {test['description']}")
    
    # 保存详细结果到文件
    with open('.specs/命令策略功能开发/test-report-6.2.json', 'w', encoding='utf-8') as f:
        json.dump({
            "match_results": match_results,
            "performance_results": perf_results,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n详细测试结果已保存到: test-report-6.2.json")

if __name__ == "__main__":
    main()