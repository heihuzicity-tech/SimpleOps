#!/usr/bin/env python3
"""
快速性能验证测试
验证索引优化后的性能改进
"""

import json
import requests
import time
import statistics
from typing import List, Dict

class QuickPerformanceTest:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None
        
    def login(self) -> bool:
        try:
            response = self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": "admin", "password": "admin123"}
            )
            response.raise_for_status()
            data = response.json()
            self.token = data["data"]["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            return False
    
    def measure_response_time(self, endpoint: str, params: Dict = None) -> float:
        """测量单次API响应时间"""
        start_time = time.perf_counter()
        try:
            response = self.session.get(f"{self.base_url}{endpoint}", params=params)
            response.raise_for_status()
            end_time = time.perf_counter()
            return (end_time - start_time) * 1000  # 转换为毫秒
        except Exception as e:
            print(f"请求失败 {endpoint}: {e}")
            return -1
    
    def test_api_performance(self, endpoint: str, name: str, iterations: int = 10) -> Dict:
        """测试API性能"""
        print(f"  测试 {name}...")
        times = []
        
        for i in range(iterations):
            response_time = self.measure_response_time(endpoint)
            if response_time > 0:
                times.append(response_time)
        
        if not times:
            return {"error": "所有请求都失败了"}
        
        result = {
            "avg_ms": statistics.mean(times),
            "min_ms": min(times),
            "max_ms": max(times),
            "median_ms": statistics.median(times),
            "count": len(times),
            "success_rate": len(times) / iterations * 100
        }
        
        status = "✅" if result["avg_ms"] < 10 else "❌"
        print(f"    {status} 平均: {result['avg_ms']:.2f}ms, 最小: {result['min_ms']:.2f}ms, 最大: {result['max_ms']:.2f}ms")
        
        return result

def main():
    print("=== 快速性能验证测试 ===")
    print("验证索引优化后的性能改进\n")
    
    tester = QuickPerformanceTest()
    
    if not tester.login():
        return
    
    # 测试主要API接口的性能
    test_cases = [
        ("/api/v1/command-filter/commands?page=1&page_size=10", "命令列表查询"),
        ("/api/v1/command-filter/policies?page=1&page_size=10", "策略列表查询"),
        ("/api/v1/command-filter/command-groups?page=1&page_size=10", "命令组列表查询"),
        ("/api/v1/command-filter/intercept-logs?page=1&page_size=10", "拦截日志查询"),
        ("/api/v1/command-filter/commands?page=1&page_size=50", "大页面命令查询"),
        ("/api/v1/command-filter/policies?page=1&page_size=20", "大页面策略查询"),
    ]
    
    results = {}
    passed_count = 0
    total_count = len(test_cases)
    
    print("1. 🔍 索引优化后性能测试")
    
    for endpoint, name in test_cases:
        result = tester.test_api_performance(endpoint, name, iterations=15)
        results[name] = result
        
        if "error" not in result and result["avg_ms"] < 10:
            passed_count += 1
    
    # 简单的并发测试
    print("\n2. 🚀 简单并发测试")
    concurrent_results = {}
    
    # 5个并发请求测试
    import threading
    
    def concurrent_request():
        return tester.measure_response_time("/api/v1/command-filter/commands?page=1&page_size=10")
    
    print("  执行5个并发请求...")
    threads = []
    concurrent_times = []
    
    start_time = time.perf_counter()
    
    for _ in range(5):
        thread = threading.Thread(target=lambda: concurrent_times.append(concurrent_request()))
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    end_time = time.perf_counter()
    total_time = (end_time - start_time) * 1000
    
    valid_times = [t for t in concurrent_times if t > 0]
    
    if valid_times:
        concurrent_results["parallel_commands"] = {
            "avg_ms": statistics.mean(valid_times),
            "max_ms": max(valid_times),
            "total_time_ms": total_time,
            "success_rate": len(valid_times) / 5 * 100
        }
        
        status = "✅" if statistics.mean(valid_times) < 50 else "❌"  # 并发时放宽要求到50ms
        print(f"    {status} 并发平均响应时间: {statistics.mean(valid_times):.2f}ms")
        print(f"    总执行时间: {total_time:.2f}ms")
        print(f"    成功率: {len(valid_times)/5*100:.1f}%")
    
    # 汇总结果
    print("\n=== 性能测试汇总 ===")
    print(f"通过测试: {passed_count}/{total_count} ({passed_count/total_count*100:.1f}%)")
    
    # 与之前的基线比较（如果有的话）
    baseline_comparison = {
        "命令列表查询": 19.03,
        "策略列表查询": 24.95,
        "命令组列表查询": 17.00,
        "拦截日志查询": 12.82
    }
    
    print("\n性能改进对比:")
    improvements = []
    
    for name, baseline_time in baseline_comparison.items():
        if name in results and "error" not in results[name]:
            current_time = results[name]["avg_ms"]
            improvement = ((baseline_time - current_time) / baseline_time) * 100
            improvements.append(improvement)
            
            if improvement > 0:
                print(f"  ✅ {name}: {baseline_time:.2f}ms → {current_time:.2f}ms (改进 {improvement:.1f}%)")
            else:
                print(f"  ❌ {name}: {baseline_time:.2f}ms → {current_time:.2f}ms (退化 {abs(improvement):.1f}%)")
    
    if improvements:
        avg_improvement = statistics.mean(improvements)
        print(f"\n平均性能改进: {avg_improvement:.1f}%")
        
        if avg_improvement > 20:
            print("🎉 索引优化效果显著！")
        elif avg_improvement > 0:
            print("✅ 索引优化有一定效果")
        else:
            print("⚠️ 索引优化效果不明显，需要进一步优化")
    
    # 保存结果
    all_results = {
        "performance_tests": results,
        "concurrent_tests": concurrent_results,
        "summary": {
            "passed_tests": passed_count,
            "total_tests": total_count,
            "pass_rate": passed_count / total_count * 100,
            "average_improvement": statistics.mean(improvements) if improvements else 0
        },
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open('.specs/命令策略功能开发/quick-performance-test-6.3.json', 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n详细测试结果已保存到: quick-performance-test-6.3.json")

if __name__ == "__main__":
    main()