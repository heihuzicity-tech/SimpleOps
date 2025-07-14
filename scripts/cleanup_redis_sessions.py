#!/usr/bin/env python3
"""
Redis会话清理脚本
用于清理Redis中残留的会话数据
"""

import redis
import json

def cleanup_redis_sessions():
    """清理Redis中的会话数据"""
    try:
        # 连接Redis
        r = redis.Redis(host='10.0.0.7', port=6379, db=0, decode_responses=True)
        
        # 测试连接
        r.ping()
        print("✅ 成功连接到Redis")
        
        # 获取所有活跃会话
        active_sessions_key = "bastion:active_sessions"
        session_ids = r.smembers(active_sessions_key)
        print(f"📊 发现 {len(session_ids)} 个活跃会话ID")
        
        cleaned_count = 0
        
        # 清理每个会话
        for session_id in session_ids:
            session_key = f"bastion:session:{session_id}"
            
            # 删除会话数据
            deleted = r.delete(session_key)
            if deleted:
                print(f"🗑️  已删除会话: {session_id}")
                cleaned_count += 1
        
        # 清空活跃会话集合
        if session_ids:
            r.delete(active_sessions_key)
            print(f"🗑️  已清空活跃会话集合")
        
        print(f"✨ 清理完成: 共清理了 {cleaned_count} 个会话")
        
        # 验证清理结果
        remaining_sessions = r.smembers(active_sessions_key)
        print(f"📊 剩余活跃会话: {len(remaining_sessions)}")
        
    except redis.ConnectionError:
        print("❌ 无法连接到Redis服务器")
    except Exception as e:
        print(f"❌ 清理过程中出错: {e}")

if __name__ == "__main__":
    print("🚀 开始清理Redis会话数据...")
    cleanup_redis_sessions()
    print("✅ 清理任务完成")