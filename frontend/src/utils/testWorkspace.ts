// 工作台功能测试脚本
import { message } from 'antd';
import ConnectionHistoryService from '../services/workspace/connectionHistory';

// 测试结果类型
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

// 测试套件
export class WorkspaceTestSuite {
  private results: TestResult[] = [];

  // 运行所有测试
  async runAllTests(): Promise<TestResult[]> {
    this.results = [];
    
    console.log('🧪 开始工作台功能测试...');
    
    // 基础功能测试
    await this.testBasicLayout();
    await this.testSidebarToggle();
    await this.testHistoryService();
    await this.testLocalStorage();
    await this.testDataPersistence();
    
    // 输出测试结果
    this.printResults();
    
    return this.results;
  }

  // 测试基础布局
  private async testBasicLayout(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 检查工作台页面是否存在
      const currentPath = window.location.pathname;
      const isWorkspacePage = currentPath.includes('/connect/workspace');
      
      // 检查关键元素是否存在
      const headerElement = document.querySelector('.ant-layout-header');
      const siderElement = document.querySelector('.ant-layout-sider');
      const contentElement = document.querySelector('.ant-layout-content');
      
      if (!headerElement || !contentElement) {
        throw new Error('基础布局元素缺失');
      }
      
      this.addResult('基础布局', true, undefined, Date.now() - startTime);
      console.log('✅ 基础布局测试通过');
    } catch (error) {
      this.addResult('基础布局', false, error instanceof Error ? error.message : String(error), Date.now() - startTime);
      console.error('❌ 基础布局测试失败:', error);
    }
  }

  // 测试侧边栏切换
  private async testSidebarToggle(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 检查侧边栏组件
      const sidePanel = document.querySelector('[data-testid="side-panel"]') || 
                        document.querySelector('.ant-card');
      
      if (!sidePanel) {
        throw new Error('侧边栏组件未找到');
      }
      
      // 检查标签页是否存在
      const tabElements = document.querySelectorAll('.ant-tabs-tab');
      if (tabElements.length < 2) {
        throw new Error('标签页数量不足');
      }
      
      this.addResult('侧边栏切换', true, undefined, Date.now() - startTime);
      console.log('✅ 侧边栏切换测试通过');
    } catch (error) {
      this.addResult('侧边栏切换', false, error instanceof Error ? error.message : String(error), Date.now() - startTime);
      console.error('❌ 侧边栏切换测试失败:', error);
    }
  }

  // 测试历史记录服务
  private async testHistoryService(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 清空历史记录
      ConnectionHistoryService.clearHistory();
      
      // 添加测试记录
      ConnectionHistoryService.addConnectionHistory({
        assetId: 999,
        assetName: 'test-server',
        assetAddress: '192.168.1.999',
        credentialId: 1,
        username: 'test',
        connectedAt: new Date(),
        duration: 120,
        status: 'success'
      });
      
      // 验证记录是否存在
      const history = ConnectionHistoryService.getConnectionHistory();
      if (history.length !== 1) {
        throw new Error('历史记录添加失败');
      }
      
      // 验证记录内容
      const record = history[0];
      if (record.assetName !== 'test-server' || record.username !== 'test') {
        throw new Error('历史记录内容不匹配');
      }
      
      // 测试获取统计信息
      const stats = ConnectionHistoryService.getConnectionStats();
      if (stats.totalConnections !== 1) {
        throw new Error('统计信息不正确');
      }
      
      // 清理测试数据
      ConnectionHistoryService.clearHistory();
      
      this.addResult('历史记录服务', true, undefined, Date.now() - startTime);
      console.log('✅ 历史记录服务测试通过');
    } catch (error) {
      this.addResult('历史记录服务', false, error instanceof Error ? error.message : String(error), Date.now() - startTime);
      console.error('❌ 历史记录服务测试失败:', error);
    }
  }

  // 测试本地存储
  private async testLocalStorage(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const testKey = 'workspace_test_key';
      const testValue = { test: 'data', timestamp: Date.now() };
      
      // 测试存储
      localStorage.setItem(testKey, JSON.stringify(testValue));
      
      // 测试读取
      const storedValue = localStorage.getItem(testKey);
      if (!storedValue) {
        throw new Error('本地存储写入失败');
      }
      
      const parsedValue = JSON.parse(storedValue);
      if (parsedValue.test !== 'data') {
        throw new Error('本地存储数据不匹配');
      }
      
      // 清理测试数据
      localStorage.removeItem(testKey);
      
      this.addResult('本地存储', true, undefined, Date.now() - startTime);
      console.log('✅ 本地存储测试通过');
    } catch (error) {
      this.addResult('本地存储', false, error instanceof Error ? error.message : String(error), Date.now() - startTime);
      console.error('❌ 本地存储测试失败:', error);
    }
  }

  // 测试数据持久化
  private async testDataPersistence(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 添加多条测试记录
      for (let i = 0; i < 5; i++) {
        ConnectionHistoryService.addConnectionHistory({
          assetId: i,
          assetName: `test-server-${i}`,
          assetAddress: `192.168.1.${i}`,
          credentialId: i,
          username: `user${i}`,
          connectedAt: new Date(Date.now() - i * 60000),
          duration: i * 60,
          status: i % 2 === 0 ? 'success' : 'failed'
        });
      }
      
      // 验证记录数量
      const history = ConnectionHistoryService.getConnectionHistory();
      if (history.length !== 5) {
        throw new Error(`期望5条记录，实际${history.length}条`);
      }
      
      // 验证记录排序（应该按时间倒序）
      for (let i = 0; i < history.length - 1; i++) {
        if (history[i].connectedAt < history[i + 1].connectedAt) {
          throw new Error('历史记录排序错误');
        }
      }
      
      // 测试获取最近记录
      const recentRecords = ConnectionHistoryService.getRecentConnections(3);
      if (recentRecords.length !== 3) {
        throw new Error('获取最近记录数量错误');
      }
      
      // 测试资产历史
      const assetHistory = ConnectionHistoryService.getAssetHistory(1);
      if (assetHistory.length !== 1) {
        throw new Error('资产历史记录数量错误');
      }
      
      // 清理测试数据
      ConnectionHistoryService.clearHistory();
      
      this.addResult('数据持久化', true, undefined, Date.now() - startTime);
      console.log('✅ 数据持久化测试通过');
    } catch (error) {
      this.addResult('数据持久化', false, error instanceof Error ? error.message : String(error), Date.now() - startTime);
      console.error('❌ 数据持久化测试失败:', error);
    }
  }

  // 添加测试结果
  private addResult(name: string, passed: boolean, error?: string, duration?: number): void {
    this.results.push({
      name,
      passed,
      error,
      duration
    });
  }

  // 打印测试结果
  private printResults(): void {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      console.log(`${status} ${result.name} ${duration}`);
      
      if (!result.passed && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });
    
    console.log('='.repeat(50));
    console.log(`总计: ${this.results.length} 个测试`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`总耗时: ${totalDuration}ms`);
    console.log('='.repeat(50));
    
    // 显示消息提示
    if (failed === 0) {
      message.success(`所有测试通过！(${passed}/${this.results.length})`);
    } else {
      message.error(`${failed}个测试失败，${passed}个测试通过`);
    }
  }

  // 获取测试结果
  getResults(): TestResult[] {
    return this.results;
  }
}

// 全局测试函数
export const runWorkspaceTests = async (): Promise<TestResult[]> => {
  const testSuite = new WorkspaceTestSuite();
  return await testSuite.runAllTests();
};

// 快速测试函数
export const quickTest = (): void => {
  console.log('🚀 快速测试开始...');
  
  // 测试基础功能
  try {
    // 1. 测试页面是否正确加载
    const isWorkspacePage = window.location.pathname.includes('/connect/workspace');
    console.log(`页面路径检查: ${isWorkspacePage ? '✅' : '❌'}`);
    
    // 2. 测试关键元素是否存在
    const hasHeader = !!document.querySelector('.ant-layout-header');
    const hasContent = !!document.querySelector('.ant-layout-content');
    const hasTabs = document.querySelectorAll('.ant-tabs-tab').length >= 2;
    
    console.log(`页面头部: ${hasHeader ? '✅' : '❌'}`);
    console.log(`主内容区: ${hasContent ? '✅' : '❌'}`);
    console.log(`标签页: ${hasTabs ? '✅' : '❌'}`);
    
    // 3. 测试历史记录服务
    const historyCount = ConnectionHistoryService.getConnectionHistory().length;
    console.log(`历史记录数量: ${historyCount}`);
    
    message.info('快速测试完成，查看控制台获取详细信息');
  } catch (error) {
    console.error('快速测试失败:', error);
    message.error('快速测试失败');
  }
};

export default WorkspaceTestSuite;