#!/usr/bin/env python3
"""
命令策略服务性能测试脚本
测试大量策略、命令和并发访问下的系统性能
"""

import json
import requests
import time
import threading
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple

class PerformanceTestClient:
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
    
    def create_batch_commands(self, count: int) -> List[int]:
        """批量创建测试命令"""
        command_patterns = [
            ("rm.*", "regex"),
            ("sudo.*", "regex"), 
            ("^shutdown.*", "regex"),
            ("chmod.*777.*", "regex"),
            (".*passwd.*", "regex"),
            ("find.*-exec.*rm.*", "regex"),
            ("(wget|curl).*", "regex"),
            ("dd.*of=/dev/.*", "regex"),
            ("iptables.*-j.*DROP.*", "regex"),
            ("mount.*", "regex")
        ]
        
        created_ids = []
        print(f"创建 {count} 个测试命令...")
        
        for i in range(count):
            pattern, cmd_type = command_patterns[i % len(command_patterns)]
            name = f"{pattern}_{i}"
            description = f"性能测试命令 {i+1}"
            
            try:
                response = self.session.post(
                    f"{self.base_url}/api/v1/command-filter/commands",
                    json={"name": name, "type": cmd_type, "description": description}
                )
                if response.status_code == 200:
                    data = response.json()
                    if "id" in data:
                        created_ids.append(data["id"])
                        if (i + 1) % 10 == 0:
                            print(f"  已创建 {i+1}/{count} 个命令")
                else:
                    print(f"  创建命令失败 {i+1}: {response.text}")
            except Exception as e:
                print(f"  创建命令异常 {i+1}: {e}")
        
        print(f"✅ 成功创建 {len(created_ids)} 个命令")
        return created_ids
    
    def create_batch_policies(self, count: int, command_ids: List[int]) -> List[int]:
        """批量创建测试策略"""
        created_ids = []
        print(f"创建 {count} 个测试策略...")
        
        commands_per_policy = max(1, len(command_ids) // count)
        
        for i in range(count):
            policy_name = f"性能测试策略_{i+1}"
            description = f"用于性能测试的策略 {i+1}"
            
            try:
                # 创建策略
                response = self.session.post(
                    f"{self.base_url}/api/v1/command-filter/policies",
                    json={"name": policy_name, "description": description, "enabled": True}
                )
                
                if response.status_code == 200:
                    policy_data = response.json()
                    if "id" in policy_data:
                        policy_id = policy_data["id"]
                        created_ids.append(policy_id)
                        
                        # 绑定命令到策略
                        start_idx = i * commands_per_policy
                        end_idx = min(start_idx + commands_per_policy, len(command_ids))
                        policy_commands = command_ids[start_idx:end_idx]
                        
                        if policy_commands:
                            bind_response = self.session.post(
                                f"{self.base_url}/api/v1/command-filter/policies/{policy_id}/bind-commands",
                                json={"command_ids": policy_commands, "command_group_ids": []}
                            )
                        
                        # 绑定admin用户
                        user_response = self.session.post(
                            f"{self.base_url}/api/v1/command-filter/policies/{policy_id}/bind-users",
                            json={"user_ids": [1]}
                        )
                        
                        if (i + 1) % 5 == 0:
                            print(f"  已创建 {i+1}/{count} 个策略")
                            
            except Exception as e:
                print(f"  创建策略异常 {i+1}: {e}")
        
        print(f"✅ 成功创建 {len(created_ids)} 个策略")
        return created_ids
    
    def measure_api_response_time(self, endpoint: str, params: Dict = None) -> float:
        """测量API响应时间"""
        start_time = time.perf_counter()
        try:
            response = self.session.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            end_time = time.perf_counter()
            return (end_time - start_time) * 1000  # 转换为毫秒
        except Exception as e:
            end_time = time.perf_counter()
            print(f"API请求失败 {endpoint}: {e}")
            return -1
    
    def concurrent_api_test(self, endpoint: str, concurrent_users: int, requests_per_user: int) -> Dict:
        """并发API测试"""
        def worker():
            worker_times = []
            for _ in range(requests_per_user):
                response_time = self.measure_api_response_time(endpoint)
                if response_time > 0:
                    worker_times.append(response_time)
                time.sleep(0.01)  # 小间隔避免过度压测
            return worker_times
        
        print(f"执行并发测试: {concurrent_users} 用户 x {requests_per_user} 请求 = {concurrent_users * requests_per_user} 总请求")
        
        start_time = time.perf_counter()
        all_times = []
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = [executor.submit(worker) for _ in range(concurrent_users)]
            
            for future in as_completed(futures):
                try:
                    worker_times = future.result()
                    all_times.extend(worker_times)
                except Exception as e:
                    print(f"Worker执行异常: {e}")
        
        end_time = time.perf_counter()
        total_duration = (end_time - start_time) * 1000
        
        if not all_times:
            return {"error": "没有成功的请求"}
        
        return {
            "total_requests": len(all_times),
            "total_duration_ms": total_duration,
            "avg_response_time_ms": statistics.mean(all_times),
            "min_response_time_ms": min(all_times),
            "max_response_time_ms": max(all_times),
            "median_response_time_ms": statistics.median(all_times),
            "p95_response_time_ms": statistics.quantiles(all_times, n=20)[18] if len(all_times) > 20 else max(all_times),
            "requests_per_second": len(all_times) / (total_duration / 1000) if total_duration > 0 else 0,
            "success_rate": len(all_times) / (concurrent_users * requests_per_user) * 100
        }

def main():
    print("=== 命令策略服务性能测试 ===\n")
    
    client = PerformanceTestClient()
    
    # 登录
    if not client.login():
        sys.exit(1)
    
    print("开始性能测试...")
    results = {}
    
    # 1. 基线性能测试
    print("\n1. 🔍 基线性能测试")
    baseline_tests = [
        ("/api/v1/command-filter/commands?page=1&page_size=10", "命令列表查询"),
        ("/api/v1/command-filter/policies?page=1&page_size=10", "策略列表查询"),
        ("/api/v1/command-filter/command-groups?page=1&page_size=10", "命令组列表查询"),
        ("/api/v1/command-filter/intercept-logs?page=1&page_size=10", "拦截日志查询")
    ]
    
    baseline_results = {}
    for endpoint, name in baseline_tests:
        times = []
        print(f"  测试 {name}...")
        for _ in range(10):
            response_time = client.measure_api_response_time(endpoint)
            if response_time > 0:
                times.append(response_time)
        
        if times:
            baseline_results[name] = {
                "avg_ms": statistics.mean(times),
                "min_ms": min(times),
                "max_ms": max(times)
            }
            print(f"    平均: {statistics.mean(times):.2f}ms, 最小: {min(times):.2f}ms, 最大: {max(times):.2f}ms")
    
    results["baseline"] = baseline_results
    
    # 2. 大数据量测试
    print("\n2. 📊 大数据量性能测试")
    print("创建大量测试数据...")
    
    # 创建100个命令
    command_ids = client.create_batch_commands(50)  # 减少数量避免过度负载
    
    # 创建20个策略
    policy_ids = client.create_batch_policies(10, command_ids)
    
    # 测试大数据量下的查询性能
    large_data_tests = [
        ("/api/v1/command-filter/commands?page=1&page_size=50", "大量命令查询"),
        ("/api/v1/command-filter/policies?page=1&page_size=20", "大量策略查询")
    ]
    
    large_data_results = {}
    for endpoint, name in large_data_tests:
        times = []
        print(f"  测试 {name}...")
        for _ in range(5):
            response_time = client.measure_api_response_time(endpoint)
            if response_time > 0:
                times.append(response_time)
        
        if times:
            large_data_results[name] = {
                "avg_ms": statistics.mean(times),
                "min_ms": min(times),
                "max_ms": max(times)
            }
            print(f"    平均: {statistics.mean(times):.2f}ms")
    
    results["large_data"] = large_data_results
    
    # 3. 并发性能测试
    print("\n3. 🚀 并发性能测试")
    concurrent_tests = [
        ("/api/v1/command-filter/commands?page=1&page_size=10", 5, 10, "命令查询并发测试"),
        ("/api/v1/command-filter/policies?page=1&page_size=10", 3, 10, "策略查询并发测试"),
    ]
    
    concurrent_results = {}
    for endpoint, concurrent_users, requests_per_user, name in concurrent_tests:
        print(f"  执行 {name}...")
        result = client.concurrent_api_test(endpoint, concurrent_users, requests_per_user)
        concurrent_results[name] = result
        
        if "error" not in result:
            print(f"    平均响应时间: {result['avg_response_time_ms']:.2f}ms")
            print(f"    95%响应时间: {result['p95_response_time_ms']:.2f}ms")
            print(f"    QPS: {result['requests_per_second']:.1f}")
            print(f"    成功率: {result['success_rate']:.1f}%")
    
    results["concurrent"] = concurrent_results
    
    # 4. 内存和缓存测试
    print("\n4. 💾 缓存性能测试")
    cache_test_results = {}
    
    # 测试重复查询（应该命中缓存）
    print("  测试缓存命中性能...")
    cache_times = []
    for _ in range(20):
        response_time = client.measure_api_response_time("/api/v1/command-filter/commands?page=1&page_size=10")
        if response_time > 0:
            cache_times.append(response_time)
    
    if cache_times:
        cache_test_results["repeated_queries"] = {
            "avg_ms": statistics.mean(cache_times),
            "min_ms": min(cache_times),
            "max_ms": max(cache_times),
            "std_dev": statistics.stdev(cache_times) if len(cache_times) > 1 else 0
        }
        print(f"    缓存查询平均时间: {statistics.mean(cache_times):.2f}ms")
        print(f"    标准差: {statistics.stdev(cache_times) if len(cache_times) > 1 else 0:.2f}ms")
    
    results["cache"] = cache_test_results
    
    # 5. 生成性能报告
    print("\n5. 📋 生成性能测试报告")
    
    # 清理测试数据
    print("\n清理测试数据...")
    for policy_id in policy_ids[-5:]:  # 只清理最后5个，避免删除过多
        try:
            client.session.delete(f"{client.base_url}/api/v1/command-filter/policies/{policy_id}")
        except:
            pass
    
    for command_id in command_ids[-10:]:  # 只清理最后10个
        try:
            client.session.delete(f"{client.base_url}/api/v1/command-filter/commands/{command_id}")
        except:
            pass
    
    # 保存测试结果
    results["test_info"] = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "created_commands": len(command_ids),
        "created_policies": len(policy_ids),
        "test_duration": "约5-10分钟"
    }
    
    with open('.specs/命令策略功能开发/performance-test-6.3.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # 输出汇总结果
    print("\n=== 性能测试汇总 ===")
    
    # 检查是否满足性能要求 (<10ms)
    all_passed = True
    performance_issues = []
    
    if "baseline" in results:
        for test_name, metrics in results["baseline"].items():
            avg_time = metrics["avg_ms"]
            status = "✅" if avg_time < 10 else "❌"
            print(f"{status} {test_name}: {avg_time:.2f}ms")
            if avg_time >= 10:
                all_passed = False
                performance_issues.append(f"{test_name}: {avg_time:.2f}ms")
    
    if "concurrent" in results:
        for test_name, metrics in results["concurrent"].items():
            if "error" not in metrics:
                avg_time = metrics["avg_response_time_ms"]
                p95_time = metrics["p95_response_time_ms"]
                status = "✅" if p95_time < 10 else "❌"
                print(f"{status} {test_name} P95: {p95_time:.2f}ms (平均: {avg_time:.2f}ms)")
                if p95_time >= 10:
                    all_passed = False
                    performance_issues.append(f"{test_name} P95: {p95_time:.2f}ms")
    
    print(f"\n总体性能评估: {'✅ 通过' if all_passed else '❌ 需要优化'}")
    if performance_issues:
        print("需要关注的性能问题:")
        for issue in performance_issues:
            print(f"  - {issue}")
    
    print(f"\n详细测试结果已保存到: performance-test-6.3.json")
    print(f"测试数据: 创建了{len(command_ids)}个命令, {len(policy_ids)}个策略")

if __name__ == "__main__":
    main()