#!/usr/bin/env python3
"""
验证预设命令组功能
"""

import json
import requests
import time

class PresetGroupVerifier:
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
    
    def verify_preset_groups(self) -> dict:
        """验证预设命令组"""
        try:
            # 获取命令组数据
            response = self.session.get(f"{self.base_url}/api/v1/command-filter/command-groups?page=1&page_size=50")
            response.raise_for_status()
            groups = response.json().get("data", {}).get("data", [])
            
            preset_groups = [g for g in groups if g.get("is_preset", False)]
            
            print("=== 预设命令组验证结果 ===\n")
            print(f"📊 总命令组数: {len(groups)}")
            print(f"🔧 预设组数: {len(preset_groups)}")
            
            print("\n📋 预设命令组列表:")
            for i, group in enumerate(preset_groups, 1):
                command_count = len(group.get("commands", []))
                print(f"  {i}. {group['name']} (ID: {group['id']}, 命令数: {command_count})")
            
            # 统计命令覆盖情况
            response = self.session.get(f"{self.base_url}/api/v1/command-filter/commands?page=1&page_size=200")
            response.raise_for_status()
            commands = response.json().get("data", {}).get("data", [])
            
            dangerous_commands = ["rm", "shutdown", "reboot", "dd", "chmod", "sudo", "mysql", "kill"]
            covered = [cmd["name"] for cmd in commands if cmd["name"] in dangerous_commands]
            coverage = len(covered) / len(dangerous_commands) * 100
            
            print(f"\n🎯 危险命令覆盖率: {coverage:.1f}% ({len(covered)}/{len(dangerous_commands)})")
            print(f"已覆盖: {', '.join(covered)}")
            
            # 分类统计
            exact_commands = [cmd for cmd in commands if cmd.get("type") == "exact"]
            regex_commands = [cmd for cmd in commands if cmd.get("type") == "regex"]
            
            print(f"\n📝 命令类型分布:")
            print(f"  精确匹配: {len(exact_commands)}个")
            print(f"  正则表达式: {len(regex_commands)}个")
            print(f"  总计: {len(commands)}个")
            
            return {
                "total_groups": len(groups),
                "preset_groups": len(preset_groups),
                "preset_group_details": [
                    {
                        "id": g["id"],
                        "name": g["name"],
                        "command_count": len(g.get("commands", []))
                    } for g in preset_groups
                ],
                "command_coverage": {
                    "rate": coverage,
                    "covered": covered,
                    "total_dangerous": len(dangerous_commands)
                },
                "command_types": {
                    "exact": len(exact_commands),
                    "regex": len(regex_commands),
                    "total": len(commands)
                },
                "success": len(preset_groups) >= 6  # 至少应该有6个预设组
            }
            
        except Exception as e:
            print(f"❌ 验证失败: {e}")
            return {"success": False, "error": str(e)}

def main():
    verifier = PresetGroupVerifier()
    
    if not verifier.login():
        return False
    
    result = verifier.verify_preset_groups()
    
    print("\n" + "="*50)
    
    if result.get("success"):
        print("✅ 预设命令组验证通过！")
        print("系统现在具备完整的危险命令分类和管理能力。")
    else:
        print("❌ 预设命令组验证失败！")
        if "error" in result:
            print(f"错误信息: {result['error']}")
    
    # 保存验证结果
    result["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open('.specs/命令策略功能开发/preset-groups-verification-7.1.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 验证结果已保存到: preset-groups-verification-7.1.json")
    
    return result.get("success", False)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)