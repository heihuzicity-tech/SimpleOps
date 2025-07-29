#!/bin/bash

# 直接测试前端API调用

echo "=== 测试前端API调用 ==="

# 1. 先获取token
echo "1. 登录获取token..."
TOKEN=$(curl -s -X POST "http://localhost:8080/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.data.access_token')

echo "Token: ${TOKEN:0:50}..."

# 2. 测试profile接口
echo -e "\n2. 测试 /api/v1/profile 接口..."
curl -s -X GET "http://localhost:8080/api/v1/profile" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. 查看前端日志
echo -e "\n3. 请在浏览器控制台查看以下日志："
echo "- [DashboardLayout] 相关日志"
echo "- [AuthApiService] 相关日志"
echo "- [BaseApiService] 相关日志"
echo "- [permissions] 相关日志"

echo -e "\n4. 在浏览器控制台执行以下命令："
cat << 'EOF'
// 手动测试
(async () => {
  // 获取store
  const getStore = () => {
    // React DevTools方式
    const root = document.querySelector('#root');
    if (root && root._reactRootContainer) {
      const fiber = root._reactRootContainer._internalRoot.current;
      let node = fiber;
      while (node) {
        if (node.memoizedProps && node.memoizedProps.store) {
          return node.memoizedProps.store;
        }
        node = node.child;
      }
    }
    return null;
  };
  
  const store = getStore();
  if (store) {
    console.log('Redux State:', store.getState());
    console.log('Auth User:', store.getState().auth.user);
    console.log('User Roles:', store.getState().auth.user?.roles);
  } else {
    console.error('无法获取Redux store');
  }
})();
EOF