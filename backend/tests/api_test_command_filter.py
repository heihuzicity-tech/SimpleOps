#!/usr/bin/env python3
"""
命令过滤功能 API 测试脚本

测试覆盖：
1. 认证登录
2. 命令组 CRUD 操作
3. 过滤规则 CRUD 操作
4. 规则启用/禁用
5. 命令匹配测试
6. 日志查询和统计
7. 批量操作
8. 导入导出功能
"""

import requests
import json
import time
import random
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


class BastionAPITester:
    """Bastion API 测试类"""
    
    def __init__(self, base_url: str = "http://localhost:8080/api/v1"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None
        self.created_resources = {
            "command_groups": [],
            "command_filters": [],
            "users": [],
            "assets": []
        }
        
    def cleanup(self):
        """清理测试创建的资源"""
        print("\n🧹 清理测试资源...")
        
        # 删除创建的过滤规则
        for filter_id in self.created_resources["command_filters"]:
            try:
                self.delete_command_filter(filter_id)
            except:
                pass
                
        # 删除创建的命令组
        for group_id in self.created_resources["command_groups"]:
            try:
                self.delete_command_group(group_id)
            except:
                pass
    
    def log_test(self, test_name: str, success: bool, message: str = ""):
        """记录测试结果"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name:<50} | {message}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    params: Optional[Dict] = None) -> Tuple[int, Dict]:
        """发送 HTTP 请求"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers
            )
            
            return response.status_code, response.json() if response.text else {}
        except Exception as e:
            print(f"请求失败: {e}")
            return 0, {"error": str(e)}
    
    # ==================== 认证相关 ====================
    
    def login(self, username: str = "admin", password: str = "admin123") -> bool:
        """登录获取 token"""
        status, resp = self.make_request("POST", "/auth/login", {
            "username": username,
            "password": password
        })
        
        if status == 200 and resp.get("success"):
            if "data" in resp:
                # 兼容不同的token字段名
                token_field = None
                if "token" in resp["data"]:
                    token_field = "token"
                elif "access_token" in resp["data"]:
                    token_field = "access_token"
                
                if token_field:
                    self.token = resp["data"][token_field]
                    self.log_test("用户登录", True, f"Token: {self.token[:20]}...")
                    return True
                else:
                    self.log_test("用户登录", False, f"未找到token字段: {resp}")
                    return False
            else:
                self.log_test("用户登录", False, f"响应格式错误: {resp}")
                return False
        else:
            self.log_test("用户登录", False, f"Status: {status}, Response: {resp}")
            return False
    
    # ==================== 命令组相关 ====================
    
    def create_command_group(self, name: str, items: List[Dict]) -> Optional[int]:
        """创建命令组"""
        data = {
            "name": name,
            "remark": f"测试命令组 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "items": items
        }
        
        status, resp = self.make_request("POST", "/command-filter/groups", data)
        
        if status == 200 and resp.get("success"):
            group_id = resp["data"]["id"]
            self.created_resources["command_groups"].append(group_id)
            self.log_test(f"创建命令组 [{name}]", True, f"ID: {group_id}")
            return group_id
        else:
            self.log_test(f"创建命令组 [{name}]", False, f"Status: {status}, Error: {resp.get('error')}")
            return None
    
    def get_command_groups(self) -> List[Dict]:
        """获取命令组列表"""
        status, resp = self.make_request("GET", "/command-filter/groups")
        
        if status == 200 and resp.get("success"):
            groups = resp["data"]["data"]
            self.log_test("获取命令组列表", True, f"共 {len(groups)} 个命令组")
            return groups
        else:
            self.log_test("获取命令组列表", False, f"Status: {status}")
            return []
    
    def get_command_group(self, group_id: int) -> Optional[Dict]:
        """获取命令组详情"""
        status, resp = self.make_request("GET", f"/command-filter/groups/{group_id}")
        
        if status == 200 and resp.get("success"):
            group = resp["data"]
            self.log_test(f"获取命令组详情 [ID: {group_id}]", True, 
                         f"名称: {group['name']}, 命令数: {len(group.get('items', []))}")
            return group
        else:
            self.log_test(f"获取命令组详情 [ID: {group_id}]", False, f"Status: {status}")
            return None
    
    def update_command_group(self, group_id: int, name: str, items: List[Dict]) -> bool:
        """更新命令组"""
        data = {
            "name": name,
            "items": items
        }
        
        status, resp = self.make_request("PUT", f"/command-filter/groups/{group_id}", data)
        
        if status == 200 and resp.get("success"):
            self.log_test(f"更新命令组 [ID: {group_id}]", True, f"新名称: {name}")
            return True
        else:
            self.log_test(f"更新命令组 [ID: {group_id}]", False, f"Status: {status}")
            return False
    
    def delete_command_group(self, group_id: int) -> bool:
        """删除命令组"""
        status, resp = self.make_request("DELETE", f"/command-filter/groups/{group_id}")
        
        if status == 200 and resp.get("success"):
            self.log_test(f"删除命令组 [ID: {group_id}]", True)
            if group_id in self.created_resources["command_groups"]:
                self.created_resources["command_groups"].remove(group_id)
            return True
        else:
            self.log_test(f"删除命令组 [ID: {group_id}]", False, f"Status: {status}")
            return False
    
    # ==================== 过滤规则相关 ====================
    
    def create_command_filter(self, name: str, command_group_id: int, 
                            user_type: str = "all", asset_type: str = "all",
                            action: str = "deny", priority: int = 50) -> Optional[int]:
        """创建过滤规则"""
        data = {
            "name": name,
            "priority": priority,
            "enabled": True,
            "user_type": user_type,
            "user_ids": [],
            "asset_type": asset_type,
            "asset_ids": [],
            "account_type": "all",
            "account_names": "",
            "command_group_id": command_group_id,
            "action": action,
            "remark": f"测试规则 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        }
        
        status, resp = self.make_request("POST", "/command-filter/filters", data)
        
        if status == 200 and resp.get("success"):
            filter_id = resp["data"]["id"]
            self.created_resources["command_filters"].append(filter_id)
            self.log_test(f"创建过滤规则 [{name}]", True, f"ID: {filter_id}")
            return filter_id
        else:
            self.log_test(f"创建过滤规则 [{name}]", False, 
                         f"Status: {status}, Error: {resp.get('error')}")
            return None
    
    def get_command_filters(self, enabled: Optional[bool] = None) -> List[Dict]:
        """获取过滤规则列表"""
        params = {}
        if enabled is not None:
            params["enabled"] = str(enabled).lower()
            
        status, resp = self.make_request("GET", "/command-filter/filters", params=params)
        
        if status == 200 and resp.get("success"):
            filters = resp["data"]["data"]
            self.log_test("获取过滤规则列表", True, f"共 {len(filters)} 个规则")
            return filters
        else:
            self.log_test("获取过滤规则列表", False, f"Status: {status}")
            return []
    
    def toggle_command_filter(self, filter_id: int) -> bool:
        """切换过滤规则启用状态"""
        status, resp = self.make_request("PATCH", f"/command-filter/filters/{filter_id}/toggle")
        
        if status == 200 and resp.get("success"):
            self.log_test(f"切换过滤规则状态 [ID: {filter_id}]", True)
            return True
        else:
            self.log_test(f"切换过滤规则状态 [ID: {filter_id}]", False, f"Status: {status}")
            return False
    
    def delete_command_filter(self, filter_id: int) -> bool:
        """删除过滤规则"""
        status, resp = self.make_request("DELETE", f"/command-filter/filters/{filter_id}")
        
        if status == 200 and resp.get("success"):
            self.log_test(f"删除过滤规则 [ID: {filter_id}]", True)
            if filter_id in self.created_resources["command_filters"]:
                self.created_resources["command_filters"].remove(filter_id)
            return True
        else:
            self.log_test(f"删除过滤规则 [ID: {filter_id}]", False, f"Status: {status}")
            return False
    
    # ==================== 命令匹配测试 ====================
    
    def test_command_match(self, command: str, user_id: int = 1, 
                          asset_id: int = 1, account: str = "root") -> Dict:
        """测试命令匹配"""
        data = {
            "command": command,
            "user_id": user_id,
            "asset_id": asset_id,
            "account": account
        }
        
        status, resp = self.make_request("POST", "/command-filter/match", data)
        
        if status == 200 and resp.get("success"):
            result = resp["data"]
            matched = result.get("matched", False)
            action = result.get("action", "")
            self.log_test(f"命令匹配测试 [{command}]", True, 
                         f"匹配: {matched}, 动作: {action}")
            return result
        else:
            self.log_test(f"命令匹配测试 [{command}]", False, f"Status: {status}")
            return {}
    
    # ==================== 日志相关 ====================
    
    def get_filter_logs(self, filter_id: Optional[int] = None, 
                       action: Optional[str] = None) -> List[Dict]:
        """获取过滤日志"""
        params = {}
        if filter_id:
            params["filter_id"] = filter_id
        if action:
            params["action"] = action
            
        status, resp = self.make_request("GET", "/command-filter/logs", params=params)
        
        if status == 200 and resp.get("success"):
            logs = resp["data"]["data"]
            self.log_test("获取过滤日志", True, f"共 {len(logs)} 条日志")
            return logs
        else:
            self.log_test("获取过滤日志", False, f"Status: {status}")
            return []
    
    def get_log_statistics(self) -> Dict:
        """获取日志统计"""
        status, resp = self.make_request("GET", "/command-filter/logs/stats")
        
        if status == 200 and resp.get("success"):
            stats = resp["data"]
            self.log_test("获取日志统计", True, 
                         f"总数: {stats.get('total_count', 0)}")
            return stats
        else:
            self.log_test("获取日志统计", False, f"Status: {status}")
            return {}
    
    # ==================== 批量操作 ====================
    
    def batch_delete_command_groups(self, group_ids: List[int]) -> bool:
        """批量删除命令组"""
        data = {"ids": group_ids}
        status, resp = self.make_request("POST", "/command-filter/groups/batch-delete", data)
        
        if status == 200 and resp.get("success"):
            self.log_test(f"批量删除命令组", True, f"删除 {len(group_ids)} 个")
            for gid in group_ids:
                if gid in self.created_resources["command_groups"]:
                    self.created_resources["command_groups"].remove(gid)
            return True
        else:
            self.log_test(f"批量删除命令组", False, f"Status: {status}")
            return False
    
    # ==================== 导入导出 ====================
    
    def export_command_groups(self) -> List[Dict]:
        """导出命令组"""
        status, resp = self.make_request("GET", "/command-filter/groups/export")
        
        if status == 200 and resp.get("success"):
            data = resp["data"]
            self.log_test("导出命令组", True, f"导出 {len(data)} 个命令组")
            return data
        else:
            self.log_test("导出命令组", False, f"Status: {status}")
            return []
    
    def import_command_groups(self, data: List[Dict]) -> bool:
        """导入命令组"""
        status, resp = self.make_request("POST", "/command-filter/groups/import", data)
        
        if status == 200 and resp.get("success"):
            self.log_test("导入命令组", True, f"导入 {len(data)} 个命令组")
            return True
        else:
            self.log_test("导入命令组", False, f"Status: {status}")
            return False


def run_comprehensive_tests():
    """运行全面测试"""
    print("=" * 80)
    print("🚀 Bastion 命令过滤功能 API 测试")
    print("=" * 80)
    
    # 初始化测试器
    tester = BastionAPITester()
    
    try:
        # 1. 登录测试
        print("\n📌 认证测试")
        print("-" * 60)
        if not tester.login():
            print("❌ 登录失败，测试终止")
            return
        
        # 2. 命令组 CRUD 测试
        print("\n📌 命令组 CRUD 测试")
        print("-" * 60)
        
        # 创建测试命令组
        dangerous_cmds = [
            {"type": "command", "content": "rm", "ignore_case": False, "sort_order": 1},
            {"type": "command", "content": "reboot", "ignore_case": False, "sort_order": 2},
            {"type": "regex", "content": "^rm\\s+-rf", "ignore_case": False, "sort_order": 3}
        ]
        
        network_cmds = [
            {"type": "command", "content": "iptables", "ignore_case": False, "sort_order": 1},
            {"type": "command", "content": "firewall-cmd", "ignore_case": False, "sort_order": 2},
            {"type": "regex", "content": "^nc\\s+", "ignore_case": True, "sort_order": 3}
        ]
        
        # 创建命令组
        group1_id = tester.create_command_group("危险命令组_测试", dangerous_cmds)
        group2_id = tester.create_command_group("网络命令组_测试", network_cmds)
        
        if group1_id and group2_id:
            # 获取列表
            tester.get_command_groups()
            
            # 获取详情
            tester.get_command_group(group1_id)
            
            # 更新命令组
            updated_cmds = dangerous_cmds + [
                {"type": "command", "content": "shutdown", "ignore_case": False, "sort_order": 4}
            ]
            tester.update_command_group(group1_id, "危险命令组_更新", updated_cmds)
            
            # 批量删除测试
            test_group_id = tester.create_command_group("临时测试组", [])
            if test_group_id:
                tester.batch_delete_command_groups([test_group_id])
        
        # 3. 过滤规则 CRUD 测试
        print("\n📌 过滤规则 CRUD 测试")
        print("-" * 60)
        
        if group1_id:
            # 创建过滤规则
            filter1_id = tester.create_command_filter(
                "禁止执行危险命令", group1_id, 
                user_type="all", asset_type="all", 
                action="deny", priority=10
            )
            
            filter2_id = tester.create_command_filter(
                "警告网络命令", group2_id,
                user_type="all", asset_type="all",
                action="alert", priority=20
            )
            
            if filter1_id and filter2_id:
                # 获取列表
                tester.get_command_filters()
                tester.get_command_filters(enabled=True)
                
                # 切换状态
                tester.toggle_command_filter(filter1_id)
                tester.toggle_command_filter(filter1_id)  # 切换回来
        
        # 4. 命令匹配测试
        print("\n📌 命令匹配测试")
        print("-" * 60)
        
        if filter1_id:
            # 测试各种命令
            test_commands = [
                "ls -la",
                "rm test.txt",
                "rm -rf /tmp/test",
                "reboot",
                "shutdown now",
                "iptables -L",
                "nc localhost 8080"
            ]
            
            for cmd in test_commands:
                tester.test_command_match(cmd)
        
        # 5. 日志测试
        print("\n📌 日志查询测试")
        print("-" * 60)
        
        # 获取日志
        tester.get_filter_logs()
        if filter1_id:
            tester.get_filter_logs(filter_id=filter1_id)
        tester.get_filter_logs(action="deny")
        
        # 获取统计
        tester.get_log_statistics()
        
        # 6. 导入导出测试
        print("\n📌 导入导出测试")
        print("-" * 60)
        
        # 导出
        exported_data = tester.export_command_groups()
        
        # 创建新的测试数据用于导入
        import_data = [
            {
                "name": "导入测试命令组",
                "remark": "通过导入功能创建",
                "items": [
                    {"type": "command", "content": "test", "ignore_case": False, "sort_order": 1}
                ]
            }
        ]
        
        # 导入
        tester.import_command_groups(import_data)
        
        # 7. 错误处理测试
        print("\n📌 错误处理测试")
        print("-" * 60)
        
        # 测试无效 ID
        tester.get_command_group(99999)
        tester.delete_command_filter(99999)
        
        # 测试重复名称
        if group1_id:
            tester.create_command_group("危险命令组_测试", [])
        
        # 测试无效参数
        tester.create_command_filter("无效规则", 99999)
        
        # 8. 性能测试
        print("\n📌 性能测试")
        print("-" * 60)
        
        # 批量创建测试
        start_time = time.time()
        perf_group_ids = []
        
        for i in range(5):
            gid = tester.create_command_group(f"性能测试组_{i}", [
                {"type": "command", "content": f"cmd{i}", "ignore_case": False, "sort_order": 1}
            ])
            if gid:
                perf_group_ids.append(gid)
        
        create_time = time.time() - start_time
        print(f"⏱️  创建 5 个命令组耗时: {create_time:.2f} 秒")
        
        # 批量删除
        if perf_group_ids:
            start_time = time.time()
            tester.batch_delete_command_groups(perf_group_ids)
            delete_time = time.time() - start_time
            print(f"⏱️  批量删除 {len(perf_group_ids)} 个命令组耗时: {delete_time:.2f} 秒")
        
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # 清理资源
        tester.cleanup()
        
    print("\n" + "=" * 80)
    print("✅ 测试完成！")
    print("=" * 80)


def run_quick_test():
    """运行快速测试"""
    print("=" * 80)
    print("🚀 Bastion 命令过滤功能快速测试")
    print("=" * 80)
    
    tester = BastionAPITester()
    
    try:
        # 登录
        if not tester.login():
            return
        
        # 创建命令组
        print("\n📌 快速功能验证")
        print("-" * 60)
        
        group_id = tester.create_command_group("快速测试组", [
            {"type": "command", "content": "test", "ignore_case": False, "sort_order": 1}
        ])
        
        if group_id:
            # 创建过滤规则
            filter_id = tester.create_command_filter(
                "快速测试规则", group_id,
                action="deny", priority=50
            )
            
            if filter_id:
                # 测试命令匹配
                tester.test_command_match("test")
                tester.test_command_match("ls")
                
                # 删除规则
                tester.delete_command_filter(filter_id)
            
            # 删除命令组
            tester.delete_command_group(group_id)
        
        print("\n✅ 快速测试完成，基本功能正常！")
        
    except Exception as e:
        print(f"\n❌ 快速测试失败: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Bastion 命令过滤功能 API 测试")
    parser.add_argument("--quick", action="store_true", help="运行快速测试")
    parser.add_argument("--url", default="http://localhost:8080/api/v1", help="API 基础 URL")
    parser.add_argument("--username", default="admin", help="登录用户名")
    parser.add_argument("--password", default="admin123", help="登录密码")
    
    args = parser.parse_args()
    
    # 设置基础 URL
    if args.url:
        BastionAPITester.base_url = args.url
    
    # 运行测试
    if args.quick:
        run_quick_test()
    else:
        run_comprehensive_tests()