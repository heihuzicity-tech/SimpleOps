#!/usr/bin/env node

/**
 * 命令审计API响应格式测试脚本
 * 验证后端API是否符合统一响应格式标准
 */

const http = require('http');
const https = require('https');

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

console.log('🧪 命令审计API响应格式测试');
console.log('📍 API基础URL:', API_BASE);
console.log('🔑 使用Token:', TEST_TOKEN ? '已配置' : '未配置');
console.log('─'.repeat(60));

// 创建HTTP客户端请求函数
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CommandLogsAPI-Test/1.0',
        ...(TEST_TOKEN && { 'Authorization': `Bearer ${TEST_TOKEN}` }),
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// 验证响应格式
function validatePaginatedResponse(response, testName) {
  console.log(`\n📋 测试: ${testName}`);
  console.log(`📊 状态码: ${response.status}`);
  
  if (response.parseError) {
    console.log('❌ JSON解析失败:', response.parseError);
    console.log('📄 原始响应:', response.data);
    return false;
  }

  const data = response.data;
  
  // 检查基本响应结构
  if (typeof data !== 'object' || data === null) {
    console.log('❌ 响应不是有效的JSON对象');
    return false;
  }

  console.log('📦 响应结构:');
  console.log(`   success: ${data.success} (${typeof data.success})`);
  console.log(`   data: ${data.data ? '存在' : '不存在'} (${typeof data.data})`);
  console.log(`   error: ${data.error || '无'}`);

  // 验证统一响应格式
  if (response.status === 200) {
    if (data.success !== true) {
      console.log('❌ 成功响应中success字段应为true');
      return false;
    }

    if (!data.data) {
      console.log('❌ 成功响应中缺少data字段');
      return false;
    }

    // 验证分页数据结构
    const paginatedData = data.data;
    console.log('📄 分页数据结构:');
    console.log(`   items: ${Array.isArray(paginatedData.items)} (数组: ${paginatedData.items?.length || 0}条)`);
    console.log(`   page: ${paginatedData.page} (${typeof paginatedData.page})`);
    console.log(`   page_size: ${paginatedData.page_size} (${typeof paginatedData.page_size})`);
    console.log(`   total: ${paginatedData.total} (${typeof paginatedData.total})`);
    console.log(`   total_pages: ${paginatedData.total_pages} (${typeof paginatedData.total_pages})`);

    const requiredFields = ['items', 'page', 'page_size', 'total', 'total_pages'];
    const missingFields = requiredFields.filter(field => !(field in paginatedData));
    
    if (missingFields.length > 0) {
      console.log(`❌ 分页数据缺少字段: ${missingFields.join(', ')}`);
      return false;
    }

    if (!Array.isArray(paginatedData.items)) {
      console.log('❌ items字段应该是数组');
      return false;
    }

    // 显示示例数据项
    if (paginatedData.items.length > 0) {
      console.log('📝 示例数据项字段:');
      const firstItem = paginatedData.items[0];
      Object.keys(firstItem).forEach(key => {
        const value = firstItem[key];
        const type = typeof value;
        const displayValue = type === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`   ${key}: ${displayValue} (${type})`);
      });
    }

    console.log('✅ 响应格式验证通过');
    return true;
  } else {
    // 错误响应验证
    if (data.success !== false) {
      console.log('❌ 错误响应中success字段应为false');
      return false;
    }

    if (!data.error) {
      console.log('❌ 错误响应中缺少error字段');
      return false;
    }

    console.log('✅ 错误响应格式正确');
    return true;
  }
}

// 验证单项响应格式
function validateSingleResponse(response, testName) {
  console.log(`\n📋 测试: ${testName}`);
  console.log(`📊 状态码: ${response.status}`);
  
  if (response.parseError) {
    console.log('❌ JSON解析失败:', response.parseError);
    return false;
  }

  const data = response.data;
  
  if (response.status === 200) {
    if (data.success !== true) {
      console.log('❌ 成功响应中success字段应为true');
      return false;
    }

    if (!data.data) {
      console.log('❌ 成功响应中缺少data字段');
      return false;
    }

    console.log('📝 单项数据字段:');
    Object.keys(data.data).forEach(key => {
      const value = data.data[key];
      const type = typeof value;
      const displayValue = type === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : value;
      console.log(`   ${key}: ${displayValue} (${type})`);
    });

    console.log('✅ 单项响应格式验证通过');
    return true;
  } else {
    console.log(`✅ 错误响应 (${response.status}): ${data.error || '未知错误'}`);
    return true;
  }
}

// 主测试函数
async function runTests() {
  const tests = [
    {
      name: '获取命令日志列表 (默认参数)',
      path: '/api/v1/audit/command-logs',
      validator: validatePaginatedResponse
    },
    {
      name: '获取命令日志列表 (带分页参数)',
      path: '/api/v1/audit/command-logs?page=1&page_size=5',
      validator: validatePaginatedResponse
    },
    {
      name: '获取命令日志列表 (带搜索参数)',
      path: '/api/v1/audit/command-logs?username=admin&page=1&page_size=10',
      validator: validatePaginatedResponse
    },
    {
      name: '获取单个命令日志详情',
      path: '/api/v1/audit/command-logs/1',
      validator: validateSingleResponse
    },
    {
      name: '获取不存在的命令日志',
      path: '/api/v1/audit/command-logs/999999',
      validator: validateSingleResponse
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      const response = await makeRequest(test.path);
      const isValid = test.validator(response, test.name);
      if (isValid) {
        passedTests++;
      }
    } catch (error) {
      console.log(`\n📋 测试: ${test.name}`);
      console.log('❌ 请求失败:', error.message);
    }
  }

  // 测试总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log(`✅ 通过: ${passedTests}/${totalTests}`);
  console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！API响应格式符合统一标准。');
  } else {
    console.log('⚠️  部分测试失败，需要检查API响应格式。');
  }
  
  console.log('\n💡 提示:');
  console.log('   - 如果认证失败，请设置 TEST_TOKEN 环境变量');
  console.log('   - 如果连接失败，请检查后端服务是否运行');
  console.log('   - 可以通过 API_BASE 环境变量自定义API地址');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { makeRequest, validatePaginatedResponse, validateSingleResponse };