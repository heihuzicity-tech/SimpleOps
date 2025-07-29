// 测试认证和权限系统
// 在浏览器控制台执行此文件的内容

console.log('=== 开始测试认证系统 ===');

// 1. 导入必要的模块
import { authApiService } from './services/api/AuthApiService';
import store from './store';

// 测试函数
async function testAuth() {
  try {
    console.log('1. 测试获取当前用户信息...');
    const userResponse = await authApiService.getCurrentUser();
    console.log('用户信息响应:', userResponse);
    
    if (userResponse.success && userResponse.data) {
      console.log('✓ 成功获取用户信息');
      console.log('用户名:', userResponse.data.username);
      console.log('角色:', userResponse.data.roles);
      console.log('权限:', userResponse.data.permissions);
      
      // 2. 检查Redux store
      console.log('\n2. 检查Redux store状态...');
      const state = store.getState();
      console.log('Auth state:', state.auth);
      console.log('Store中的用户:', state.auth.user);
      
      // 3. 检查权限函数
      console.log('\n3. 测试权限检查函数...');
      const user = state.auth.user;
      
      // 模拟权限检查
      const hasAdminRole = user?.roles?.some(role => role.name === 'admin');
      const hasOperatorRole = user?.roles?.some(role => 
        role.name === 'admin' || role.name === 'operator'
      );
      
      console.log('hasAdminRole:', hasAdminRole);
      console.log('hasOperatorRole:', hasOperatorRole);
      
      // 4. 分析菜单显示逻辑
      console.log('\n4. 分析菜单显示问题...');
      console.log('预期菜单显示:');
      console.log('- 仪表板: 总是显示');
      if (hasAdminRole) {
        console.log('- 用户管理: 应该显示（admin角色）');
      }
      if (hasOperatorRole) {
        console.log('- 资产管理: 应该显示（admin/operator角色）');
        console.log('- 凭证管理: 应该显示（admin/operator角色）');
      }
      console.log('- 审计日志: 总是显示');
      
    } else {
      console.error('✗ 获取用户信息失败');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 执行测试
testAuth();

// 导出到window以便在控制台使用
window.testAuth = testAuth;
window.authApiService = authApiService;
window.store = store;