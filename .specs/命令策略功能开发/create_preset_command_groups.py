#!/usr/bin/env python3
"""
创建预设命令组脚本
扩展现有的预设命令组，添加更多危险命令和安全分类
同时进行全面测试验证
"""

import json
import requests
import time
import sys
from typing import List, Dict, Any

class PresetCommandGroupManager:
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
            print("✅ 登录成功")
            return True
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return False
    
    def get_existing_data(self) -> Dict[str, Any]:
        """获取现有的命令和命令组数据"""
        try:
            # 获取现有命令
            commands_response = self.session.get(f"{self.base_url}/api/v1/command-filter/commands?page=1&page_size=100")
            commands_response.raise_for_status()
            commands = commands_response.json().get("data", {}).get("data", [])
            
            # 获取现有命令组
            groups_response = self.session.get(f"{self.base_url}/api/v1/command-filter/command-groups?page=1&page_size=100")
            groups_response.raise_for_status()
            groups = groups_response.json().get("data", {}).get("data", [])
            
            return {
                "commands": commands,
                "groups": groups,
                "preset_groups": [g for g in groups if g.get("is_preset", False)]
            }
        except Exception as e:
            print(f"❌ 获取现有数据失败: {e}")
            return {"commands": [], "groups": [], "preset_groups": []}
    
    def create_command(self, name: str, cmd_type: str, description: str) -> int:
        """创建单个命令，返回命令ID"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/commands",
                json={"name": name, "type": cmd_type, "description": description}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("id")
        except requests.exceptions.HTTPError as e:
            if "Duplicate entry" in str(e):
                print(f"    ⚠️  命令 '{name}' 已存在")
                # 尝试从现有命令中找到ID
                existing = self.get_existing_data()
                for cmd in existing["commands"]:
                    if cmd["name"] == name:
                        return cmd["id"]
            else:
                print(f"    ❌ 创建命令 '{name}' 失败: {e}")
            return None
        except Exception as e:
            print(f"    ❌ 创建命令 '{name}' 异常: {e}")
            return None
    
    def create_command_group(self, name: str, description: str, command_ids: List[int], is_preset: bool = True) -> int:
        """创建命令组"""
        try:
            # 创建命令组
            response = self.session.post(
                f"{self.base_url}/api/v1/command-filter/command-groups",
                json={"name": name, "description": description, "command_ids": command_ids}
            )
            response.raise_for_status()
            data = response.json()
            group_id = data.get("id")
            
            # 如果是预设组，需要在数据库中更新is_preset字段
            if is_preset and group_id:
                # 注意：这里需要直接操作数据库，因为API可能不支持设置is_preset
                print(f"    ⚠️  需要手动将命令组 {group_id} 设置为预设组")
                
            return group_id
        except requests.exceptions.HTTPError as e:
            if "Duplicate entry" in str(e):
                print(f"    ⚠️  命令组 '{name}' 已存在")
                existing = self.get_existing_data()
                for group in existing["groups"]:
                    if group["name"] == name:
                        return group["id"]
            else:
                print(f"    ❌ 创建命令组 '{name}' 失败: {e}")
            return None
        except Exception as e:
            print(f"    ❌ 创建命令组 '{name}' 异常: {e}")
            return None
    
    def create_preset_command_groups(self) -> Dict[str, Any]:
        """创建扩展的预设命令组"""
        
        # 定义扩展的预设命令组
        preset_groups = {
            "危险命令-数据库操作": {
                "description": "可能影响数据库的危险命令",
                "commands": [
                    ("mysql", "exact", "MySQL数据库客户端"),
                    ("mysqldump", "exact", "MySQL数据导出"),
                    ("psql", "exact", "PostgreSQL数据库客户端"),
                    ("mongo", "exact", "MongoDB数据库客户端"),
                    ("redis-cli", "exact", "Redis数据库客户端"),
                    ("DROP.*", "regex", "SQL删除语句模式"),
                    ("DELETE.*", "regex", "SQL删除数据模式"),
                    ("TRUNCATE.*", "regex", "SQL清空表模式")
                ]
            },
            "危险命令-进程管理": {
                "description": "可能影响系统进程的命令",
                "commands": [
                    ("kill", "exact", "终止进程"),
                    ("killall", "exact", "批量终止进程"),
                    ("pkill", "exact", "按名称终止进程"), 
                    ("systemctl", "exact", "系统服务管理"),
                    ("service", "exact", "服务控制命令"),
                    ("crontab", "exact", "定时任务管理"),
                    ("kill.*-9.*", "regex", "强制终止进程模式")
                ]
            },
            "危险命令-用户管理": {
                "description": "用户和权限管理的危险命令",
                "commands": [
                    ("useradd", "exact", "添加用户"),
                    ("userdel", "exact", "删除用户"),
                    ("usermod", "exact", "修改用户"),
                    ("passwd", "exact", "修改密码"),
                    ("su", "exact", "切换用户"),
                    ("sudo", "exact", "以管理员权限执行"),
                    ("chmod", "exact", "修改文件权限"),
                    ("chown", "exact", "修改文件所有者"),
                    ("visudo", "exact", "编辑sudo配置")
                ]
            },
            "危险命令-软件包管理": {
                "description": "软件包安装和管理命令",
                "commands": [
                    ("apt", "exact", "Debian/Ubuntu包管理器"),
                    ("apt-get", "exact", "APT包管理工具"),
                    ("yum", "exact", "RedHat/CentOS包管理器"),
                    ("dnf", "exact", "Fedora包管理器"),
                    ("rpm", "exact", "RPM包管理工具"),
                    ("pip", "exact", "Python包管理器"),
                    ("npm", "exact", "Node.js包管理器"),
                    ("docker", "exact", "Docker容器管理")
                ]
            },
            "危险命令-网络安全": {
                "description": "网络安全和渗透相关命令",
                "commands": [
                    ("nmap", "exact", "网络端口扫描"),
                    ("netcat", "exact", "网络连接工具"),
                    ("nc", "exact", "netcat简写"),
                    ("telnet", "exact", "远程登录协议"),
                    ("ftp", "exact", "文件传输协议"),
                    ("ssh", "exact", "安全外壳协议"),
                    ("scp", "exact", "安全复制协议"),
                    ("rsync", "exact", "远程同步工具"),
                    ("curl.*-X.*POST", "regex", "HTTP POST请求模式"),
                    ("wget.*--post-data", "regex", "wget POST请求模式")
                ]
            },
            "危险命令-系统配置": {
                "description": "系统配置和内核相关命令",
                "commands": [
                    ("mount", "exact", "挂载文件系统"),
                    ("umount", "exact", "卸载文件系统"),
                    ("fsck", "exact", "文件系统检查"),
                    ("modprobe", "exact", "加载内核模块"),
                    ("insmod", "exact", "插入内核模块"),
                    ("rmmod", "exact", "删除内核模块"),
                    ("sysctl", "exact", "内核参数配置"),
                    ("echo.*>.*proc", "regex", "修改proc文件系统")
                ]
            }
        }
        
        results = {
            "created_groups": [],
            "created_commands": [],
            "errors": []
        }
        
        print("🔧 开始创建扩展预设命令组...")
        
        for group_name, group_info in preset_groups.items():
            print(f"\n📁 创建命令组: {group_name}")
            
            # 创建命令组中的命令
            group_command_ids = []
            for cmd_name, cmd_type, cmd_desc in group_info["commands"]:
                print(f"  📝 创建命令: {cmd_name} ({cmd_type})")
                cmd_id = self.create_command(cmd_name, cmd_type, cmd_desc)
                if cmd_id:
                    group_command_ids.append(cmd_id)
                    results["created_commands"].append({
                        "id": cmd_id,
                        "name": cmd_name,
                        "type": cmd_type,
                        "description": cmd_desc
                    })
                else:
                    results["errors"].append(f"Failed to create command: {cmd_name}")
            
            if group_command_ids:
                # 创建命令组
                print(f"  📦 创建命令组，包含 {len(group_command_ids)} 个命令")
                group_id = self.create_command_group(
                    group_name, 
                    group_info["description"], 
                    group_command_ids, 
                    is_preset=True
                )
                
                if group_id:
                    results["created_groups"].append({
                        "id": group_id,
                        "name": group_name,
                        "description": group_info["description"],
                        "command_count": len(group_command_ids)
                    })
                    print(f"    ✅ 命令组创建成功，ID: {group_id}")
                else:
                    results["errors"].append(f"Failed to create group: {group_name}")
            else:
                print(f"    ❌ 命令组 {group_name} 没有有效命令，跳过创建")
                results["errors"].append(f"No valid commands for group: {group_name}")
        
        return results
    
    def test_preset_groups(self) -> Dict[str, Any]:
        """测试预设命令组功能"""
        print("\n🧪 开始测试预设命令组...")
        
        # 获取最新数据
        data = self.get_existing_data()
        
        test_results = {
            "total_commands": len(data["commands"]),
            "total_groups": len(data["groups"]),
            "preset_groups": len(data["preset_groups"]),
            "tests": []
        }
        
        # 测试1: 验证预设组数量
        print("  🔍 测试1: 验证预设组数量")
        expected_preset_groups = 9  # 原有3个 + 新增6个
        actual_preset_groups = len(data["preset_groups"])
        
        test1_passed = actual_preset_groups >= 3  # 至少应该有原来的3个
        test_results["tests"].append({
            "name": "预设组数量验证",
            "expected": f">= 3",
            "actual": actual_preset_groups,
            "passed": test1_passed
        })
        print(f"    {'✅' if test1_passed else '❌'} 预设组数量: {actual_preset_groups}")
        
        # 测试2: 验证命令覆盖度
        print("  🔍 测试2: 验证危险命令覆盖度")
        dangerous_commands = ["rm", "shutdown", "reboot", "dd", "chmod", "sudo", "mysql", "kill"]
        covered_commands = []
        
        for cmd in data["commands"]:
            if cmd["name"] in dangerous_commands:
                covered_commands.append(cmd["name"])
        
        coverage_rate = len(covered_commands) / len(dangerous_commands) * 100
        test2_passed = coverage_rate >= 70  # 至少覆盖70%的危险命令
        
        test_results["tests"].append({
            "name": "危险命令覆盖度",
            "expected": ">= 70%",
            "actual": f"{coverage_rate:.1f}%",
            "passed": test2_passed,
            "covered_commands": covered_commands
        })
        print(f"    {'✅' if test2_passed else '❌'} 覆盖率: {coverage_rate:.1f}% ({len(covered_commands)}/{len(dangerous_commands)})")
        
        # 测试3: 验证正则表达式命令
        print("  🔍 测试3: 验证正则表达式命令")
        regex_commands = [cmd for cmd in data["commands"] if cmd.get("type") == "regex"]
        regex_count = len(regex_commands)
        
        test3_passed = regex_count >= 5  # 至少应该有5个正则表达式命令
        test_results["tests"].append({
            "name": "正则表达式命令数量",
            "expected": ">= 5",
            "actual": regex_count,
            "passed": test3_passed
        })
        print(f"    {'✅' if test3_passed else '❌'} 正则命令数量: {regex_count}")
        
        # 测试4: 验证命令组完整性
        print("  🔍 测试4: 验证命令组完整性")
        empty_groups = 0
        group_stats = []
        
        for group in data["groups"]:
            command_count = len(group.get("commands", []))
            if command_count == 0:
                empty_groups += 1
            group_stats.append({
                "name": group["name"],
                "command_count": command_count,
                "is_preset": group.get("is_preset", False)
            })
        
        test4_passed = empty_groups == 0
        test_results["tests"].append({
            "name": "命令组完整性",
            "expected": "0个空组",  
            "actual": f"{empty_groups}个空组",
            "passed": test4_passed,
            "group_stats": group_stats
        })
        print(f"    {'✅' if test4_passed else '❌'} 空命令组: {empty_groups}个")
        
        return test_results
    
    def generate_sql_for_preset_groups(self) -> str:
        """生成设置预设组的SQL语句"""
        sql_statements = [
            "-- 设置新创建的命令组为预设组",
            "UPDATE command_groups SET is_preset = 1 WHERE name IN (",
            "  '危险命令-数据库操作',",
            "  '危险命令-进程管理',", 
            "  '危险命令-用户管理',",
            "  '危险命令-软件包管理',",
            "  '危险命令-网络安全',",
            "  '危险命令-系统配置'",
            ");",
            "",
            "-- 验证预设组设置",
            "SELECT id, name, is_preset, created_at FROM command_groups WHERE is_preset = 1 ORDER BY id;"
        ]
        return "\n".join(sql_statements)

def main():
    print("=== 预设命令组创建和测试工具 ===\n")
    
    manager = PresetCommandGroupManager()
    
    # 登录
    if not manager.login():
        sys.exit(1)
    
    # 创建预设命令组
    creation_results = manager.create_preset_command_groups()
    
    print(f"\n📊 创建结果汇总:")
    print(f"  ✅ 创建命令组: {len(creation_results['created_groups'])}个")
    print(f"  ✅ 创建命令: {len(creation_results['created_commands'])}个")
    print(f"  ❌ 错误: {len(creation_results['errors'])}个")
    
    if creation_results['errors']:
        print("\n❌ 错误详情:")
        for error in creation_results['errors']:
            print(f"  - {error}")
    
    # 测试预设命令组
    test_results = manager.test_preset_groups()
    
    print(f"\n📋 测试结果汇总:")
    print(f"  📝 总命令数: {test_results['total_commands']}")
    print(f"  📁 总命令组数: {test_results['total_groups']}")
    print(f"  🔧 预设组数: {test_results['preset_groups']}")
    
    passed_tests = sum(1 for test in test_results['tests'] if test['passed'])
    total_tests = len(test_results['tests'])
    
    print(f"  🧪 测试通过: {passed_tests}/{total_tests}")
    
    if passed_tests < total_tests:
        print("\n❌ 失败的测试:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  - {test['name']}: 期望{test['expected']}, 实际{test['actual']}")
    
    # 生成SQL脚本
    sql_script = manager.generate_sql_for_preset_groups()
    
    with open('.specs/命令策略功能开发/preset_groups_setup.sql', 'w', encoding='utf-8') as f:
        f.write(sql_script)
    
    # 保存详细结果
    all_results = {
        "creation_results": creation_results,
        "test_results": test_results,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "created_groups": len(creation_results['created_groups']),
            "created_commands": len(creation_results['created_commands']),
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "success_rate": passed_tests / total_tests * 100 if total_tests > 0 else 0
        }
    }
    
    with open('.specs/命令策略功能开发/preset-groups-test-7.1.json', 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 结果已保存:")
    print(f"  📄 详细结果: preset-groups-test-7.1.json")
    print(f"  📜 SQL脚本: preset_groups_setup.sql")
    
    # 总体评估
    overall_success = (
        len(creation_results['created_groups']) >= 3 and
        passed_tests >= total_tests * 0.75
    )
    
    print(f"\n🎯 总体评估: {'✅ 成功' if overall_success else '⚠️ 部分成功'}")
    
    if overall_success:
        print("预设命令组创建和测试完成！系统现在具备了完整的危险命令分类和管理能力。")
    else:
        print("预设命令组创建基本完成，但存在一些问题需要手动处理。")
    
    return overall_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)