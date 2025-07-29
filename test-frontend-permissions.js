// 前端权限系统测试脚本
// 在浏览器控制台中执行此脚本

// 测试步骤：
// 1. 打开 http://localhost:3000
// 2. 登录后打开浏览器控制台
// 3. 复制粘贴以下代码执行

// 获取当前用户信息
const store = window.__REDUX_STORE__ || window.store;
if (!store) {
  console.error('无法获取Redux store，请确保已登录');
} else {
  const state = store.getState();
  const user = state.auth.user;
  
  console.log('=== 用户信息 ===');
  console.log('用户:', user);
  console.log('角色:', user?.roles);
  console.log('权限:', user?.permissions);
  
  // 测试权限函数
  console.log('\n=== 权限检查 ===');
  
  // 导入权限检查函数（模拟）
  const hasAdminPermission = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.some(role => role.name === 'admin');
  };
  
  const hasOperatorPermission = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.some(role => 
      role.name === 'admin' || role.name === 'operator'
    );
  };
  
  console.log('hasAdminPermission:', hasAdminPermission(user));
  console.log('hasOperatorPermission:', hasOperatorPermission(user));
  
  // 检查菜单可见性
  console.log('\n=== 菜单可见性 ===');
  const menuChecks = {
    '用户管理': hasAdminPermission(user),
    '资产管理': hasOperatorPermission(user),
    '凭证管理': hasOperatorPermission(user),
    'SSH会话': true, // 所有登录用户可见
    '审计日志': true, // 所有登录用户可见
  };
  
  Object.entries(menuChecks).forEach(([menu, visible]) => {
    console.log(`${menu}: ${visible ? '✓ 可见' : '✗ 隐藏'}`);
  });
  
  // 检查实际渲染的菜单
  console.log('\n=== 实际渲染的菜单 ===');
  const menuItems = document.querySelectorAll('.ant-menu-item, .ant-menu-submenu-title');
  menuItems.forEach(item => {
    const text = item.textContent;
    if (text) {
      console.log('- ' + text);
    }
  });
}

// 手动测试API
console.log('\n=== 测试API调用 ===');
console.log('执行以下命令测试profile接口:');
console.log(`
fetch('/api/v1/profile', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('access_token')
  }
}).then(r => r.json()).then(console.log)
`);