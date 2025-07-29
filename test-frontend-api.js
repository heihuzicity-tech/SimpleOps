// 测试前端API调用的简单脚本
const { execSync } = require('child_process');

async function testFrontendAPI() {
  console.log('测试前端API调用...');
  
  try {
    // 模拟前端API调用
    const curlCmd = `curl -X GET "http://localhost:8080/api/v1/asset-groups/?page=1&page_size=100" \\
      -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwiaXNzIjoiYmFzdGlvbiIsInN1YiI6ImFkbWluIiwiZXhwIjoxNzUzODQyNzYyLCJuYmYiOjE3NTM3NTYzNjIsImlhdCI6MTc1Mzc1NjM2MiwianRpIjoiNjFjN2Y2NzYtMDQ4YS00NTJmLThjNzItYzU4MjY2NDdjZWZlIn0.rZj8WvzMkpQW1c53tZOkAWSA_mSj9E-2KkKEd2qdC7E" \\
      -H "Content-Type: application/json"`;
    
    const result = execSync(curlCmd, { encoding: 'utf-8' });
    const response = JSON.parse(result);
    
    console.log('✅ API响应成功');
    console.log('✅ 响应状态:', response.success);
    console.log('✅ 数据项数量:', response.data?.items?.length || 0);
    console.log('✅ 总数:', response.data?.total || 0);
    
    if (response.data?.items?.length > 0) {
      console.log('✅ 第一个分组:', response.data.items[0]);
    }
    
    return response;
  } catch (error) {
    console.error('❌ API调用失败:', error.message);
    return null;
  }
}

// 运行测试
testFrontendAPI().then(response => {
  if (response && response.data?.items?.length > 0) {
    console.log('\n🎉 后端API正常工作，返回了', response.data.items.length, '个资产分组');
    console.log('🔍 现在需要检查前端为什么没有正确显示这些数据');
  } else {
    console.log('\n❌ 后端API有问题');
  }
}).catch(console.error);