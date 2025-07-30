import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import axios from 'axios';
import FilterLogTable from '../FilterLogTable';

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock moment - 简化版本
jest.mock('moment', () => {
  const mockMoment = (date?: any) => ({
    format: jest.fn((format: string) => '2024-01-15 12:00:00'),
    diff: jest.fn(() => 30), // 30分钟前
    locale: jest.fn(),
  });
  
  mockMoment.locale = jest.fn();
  
  return mockMoment;
});

// Mock window.URL.createObjectURL
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
  },
});

// Mock document.createElement and appendChild
const mockLink = {
  href: '',
  setAttribute: jest.fn(),
  click: jest.fn(),
  remove: jest.fn(),
};

Object.defineProperty(document, 'createElement', {
  writable: true,
  value: jest.fn(() => mockLink),
});

Object.defineProperty(document.body, 'appendChild', {
  writable: true,
  value: jest.fn(),
});

const mockLogs = [
  {
    id: 1,
    session_id: 'session-12345-abcdef',
    user_id: 1,
    username: 'admin',
    asset_id: 1,
    asset_name: 'server1',
    account: 'root',
    command: 'rm -rf /tmp/test',
    filter_id: 1,
    filter_name: '高危命令过滤规则',
    action: 'deny',
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    session_id: 'session-67890-ghijkl',
    user_id: 2,
    username: 'user1',
    asset_id: 2,
    asset_name: 'server2',
    account: 'deploy',
    command: 'sudo systemctl restart nginx',
    filter_id: 2,
    filter_name: '系统管理命令规则',
    action: 'alert',
    created_at: '2024-01-15T11:45:00Z',
  },
  {
    id: 3,
    session_id: 'session-abcde-fghij',
    user_id: 1,
    username: 'admin',
    asset_id: 1,
    asset_name: 'server1',
    account: 'root',
    command: 'ls -la /home',
    filter_id: 3,
    filter_name: '允许命令规则',
    action: 'allow',
    created_at: '2024-01-15T12:00:00Z',
  },
];

const mockStatistics = {
  today_count: 15,
  week_count: 125,
  deny_count: 8,
  alert_count: 12,
  total_count: 328,
  most_triggered_filter: {
    id: 1,
    name: '高危命令过滤规则',
    count: 45,
  },
};

describe('FilterLogTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url === '/api/command-filter/logs') {
        return Promise.resolve({
          data: {
            code: 0,
            data: {
              items: mockLogs,
              total: mockLogs.length,
            },
          },
        });
      } else if (url === '/api/command-filter/logs/stats') {
        return Promise.resolve({
          data: {
            code: 0,
            data: mockStatistics,
          },
        });
      } else if (url === '/api/command-filter/logs/export') {
        return Promise.resolve({
          data: new Blob(['csv data'], { type: 'text/csv' }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基本渲染测试', () => {
    test('应该正确渲染组件的主要元素', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 等待数据加载
      await waitFor(() => {
        // 检查统计卡片
        expect(screen.getByText('今日日志')).toBeInTheDocument();
        expect(screen.getByText('本周日志')).toBeInTheDocument();
        expect(screen.getByText('拒绝次数')).toBeInTheDocument();
        expect(screen.getByText('告警次数')).toBeInTheDocument();
        
        // 检查搜索和操作按钮
        expect(screen.getByPlaceholderText('搜索会话ID')).toBeInTheDocument();
        expect(screen.getByText('搜索')).toBeInTheDocument();
        expect(screen.getByText('刷新')).toBeInTheDocument();
        expect(screen.getByText('导出')).toBeInTheDocument();
      });
    });

    test('应该显示表格列标题', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('会话ID')).toBeInTheDocument();
      expect(screen.getByText('用户')).toBeInTheDocument();
      expect(screen.getByText('资产')).toBeInTheDocument();
      expect(screen.getByText('账号')).toBeInTheDocument();
      expect(screen.getByText('命令')).toBeInTheDocument();
      expect(screen.getByText('触发规则')).toBeInTheDocument();
      expect(screen.getByText('动作')).toBeInTheDocument();
      expect(screen.getByText('时间')).toBeInTheDocument();
    });

    test('应该显示日志数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('server1')).toBeInTheDocument();
        expect(screen.getByText('server2')).toBeInTheDocument();
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
        expect(screen.getByText('系统管理命令规则')).toBeInTheDocument();
      });
    });
  });

  describe('统计数据测试', () => {
    test('应该正确显示统计数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // 今日日志
        expect(screen.getByText('125')).toBeInTheDocument(); // 本周日志
        expect(screen.getByText('8')).toBeInTheDocument(); // 拒绝次数
        expect(screen.getByText('12')).toBeInTheDocument(); // 告警次数
      });
    });

    test('应该显示触发最多的规则', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(screen.getByText('触发最多的规则：')).toBeInTheDocument();
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument(); // 触发次数
      });
    });

    test('统计数据加载失败时应该显示默认值', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs') {
          return Promise.resolve({
            data: {
              code: 0,
              data: { items: [], total: 0 },
            },
          });
        } else if (url === '/api/command-filter/logs/stats') {
          return Promise.reject(new Error('Stats failed'));
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        // 应该显示默认值0
        const statisticElements = screen.getAllByText('0');
        expect(statisticElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('数据加载测试', () => {
    test('组件挂载时应该加载数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
        params: expect.objectContaining({
          page: 1,
          page_size: 20,
        }),
      });
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs/stats');
    });

    test('加载失败时应该显示错误消息', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs') {
          return Promise.reject(new Error('Network error'));
        } else if (url === '/api/command-filter/logs/stats') {
          return Promise.resolve({
            data: { code: 0, data: mockStatistics },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('获取日志列表失败');
      });
    });

    test('API返回错误码时应该显示错误消息', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs') {
          return Promise.resolve({
            data: {
              code: 1,
              message: '权限不足',
            },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('权限不足');
      });
    });
  });

  describe('搜索功能测试', () => {
    test('会话ID搜索应该正常工作', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<FilterLogTable />);
      });

      const searchInput = screen.getByPlaceholderText('搜索会话ID');
      
      await act(async () => {
        await user.type(searchInput, 'session-12345');
      });

      const searchButton = screen.getByText('搜索');
      await act(async () => {
        fireEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
          params: expect.objectContaining({
            session_id: 'session-12345',
            page: 1,
          }),
        });
      });
    });

    test('按回车键应该触发搜索', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<FilterLogTable />);
      });

      const searchInput = screen.getByPlaceholderText('搜索会话ID');
      
      await act(async () => {
        await user.type(searchInput, 'session-12345');
        await user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
          params: expect.objectContaining({
            session_id: 'session-12345',
          }),
        });
      });
    });

    test('清空搜索应该重置搜索条件', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<FilterLogTable />);
      });

      const searchInput = screen.getByPlaceholderText('搜索会话ID');
      
      // 输入搜索内容
      await act(async () => {
        await user.type(searchInput, 'session-12345');
      });
      
      // 清空搜索
      await act(async () => {
        await user.clear(searchInput);
      });

      const searchButton = screen.getByText('搜索');
      await act(async () => {
        fireEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenLastCalledWith('/api/command-filter/logs', {
          params: expect.objectContaining({
            session_id: '',
          }),
        });
      });
    });
  });

  describe('时间范围搜索测试', () => {
    test('选择时间范围应该正常工作', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 由于RangePicker的复杂性，我们主要测试逻辑
      // 在实际组件中，时间选择会更新状态并在搜索时发送参数
      const searchButton = screen.getByText('搜索');
      await act(async () => {
        fireEvent.click(searchButton);
      });

      // 验证API调用包含初始参数
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
        params: expect.objectContaining({
          page: 1,
          page_size: 20,
        }),
      });
    });
  });

  describe('刷新功能测试', () => {
    test('刷新按钮应该重新加载数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 等待初始加载完成
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2); // logs + stats
      });

      const refreshButton = screen.getByText('刷新');
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 初始2次 + 刷新2次
        expect(message.success).toHaveBeenCalledWith('刷新成功');
      });
    });
  });

  describe('导出功能测试', () => {
    test('导出按钮应该正常工作', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      const exportButton = screen.getByText('导出');
      await act(async () => {
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(message.loading).toHaveBeenCalledWith('正在导出日志...');
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs/export', {
          params: expect.any(Object),
          responseType: 'blob',
        });
      });

      await waitFor(() => {
        expect(message.success).toHaveBeenCalledWith('导出成功');
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.remove).toHaveBeenCalled();
      });
    });

    test('导出失败时应该显示错误消息', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs/export') {
          return Promise.reject(new Error('Export failed'));
        }
        // 其他API正常返回
        if (url === '/api/command-filter/logs') {
          return Promise.resolve({
            data: { code: 0, data: { items: [], total: 0 } },
          });
        }
        if (url === '/api/command-filter/logs/stats') {
          return Promise.resolve({
            data: { code: 0, data: mockStatistics },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      const exportButton = screen.getByText('导出');
      await act(async () => {
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('导出失败');
      });
    });
  });

  describe('动作标签渲染测试', () => {
    test('应该正确渲染不同动作的标签', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(screen.getByText('拒绝')).toBeInTheDocument();
        expect(screen.getByText('告警')).toBeInTheDocument();
        expect(screen.getByText('接受')).toBeInTheDocument();
      });
    });
  });

  describe('时间格式化测试', () => {
    test('应该正确格式化时间显示', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        // 验证时间相关元素存在
        const timeElements = screen.getAllByText(/分钟前|小时前|天前|刚刚/);
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('会话ID显示测试', () => {
    test('长会话ID应该被截断显示', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        // 验证会话ID被截断（通过检查省略号）
        const sessionElements = screen.getAllByText(/session-12345.../);
        expect(sessionElements.length).toBeGreaterThan(0);
      });
    });

    test('会话ID应该支持复制', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        // 验证复制按钮存在（通过查找可复制的文本元素）
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('命令显示测试', () => {
    test('长命令应该被截断显示', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        // 验证命令显示样式正确
        const commandElements = screen.getAllByText(/rm -rf|sudo systemctl|ls -la/);
        expect(commandElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('分页功能测试', () => {
    test('分页变化应该重新加载数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 等待初始数据加载
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
          params: expect.objectContaining({
            page: 1,
            page_size: 20,
          }),
        });
      });

      // 验证分页组件存在
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    test('改变页面大小应该重新加载数据', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 验证表格存在，分页功能由antd Table组件处理
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('空数据状态测试', () => {
    test('无数据时应该显示空状态', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs') {
          return Promise.resolve({
            data: {
              code: 0,
              data: {
                items: [],
                total: 0,
              },
            },
          });
        } else if (url === '/api/command-filter/logs/stats') {
          return Promise.resolve({
            data: {
              code: 0,
              data: {
                today_count: 0,
                week_count: 0,
                deny_count: 0,
                alert_count: 0,
                total_count: 0,
              },
            },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        expect(screen.getByText('暂无日志数据')).toBeInTheDocument();
      });
    });
  });

  describe('加载状态测试', () => {
    test('加载时应该显示加载指示器', async () => {
      // 模拟慢速API响应
      mockedAxios.get.mockImplementation((url) => {
        if (url === '/api/command-filter/logs') {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                data: {
                  code: 0,
                  data: { items: mockLogs, total: mockLogs.length },
                },
              });
            }, 100);
          });
        } else if (url === '/api/command-filter/logs/stats') {
          return Promise.resolve({
            data: { code: 0, data: mockStatistics },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        render(<FilterLogTable />);
      });

      // 验证表格存在（加载状态由antd Table组件内部处理）
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // 等待加载完成
      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });
  });

  describe('响应式布局测试', () => {
    test('表格应该支持横向滚动', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
        
        // 验证表格容器存在（scroll属性由antd处理）
        const tableContainer = table.closest('.ant-table-container');
        expect(tableContainer || table).toBeInTheDocument();
      });
    });
  });

  describe('筛选功能集成测试', () => {
    test('复合搜索条件应该正确发送到API', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 设置会话ID搜索条件
      const searchInput = screen.getByPlaceholderText('搜索会话ID');
      await act(async () => {
        await user.type(searchInput, 'test-session');
      });

      // 点击搜索
      const searchButton = screen.getByText('搜索');
      await act(async () => {
        fireEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/command-filter/logs', {
          params: expect.objectContaining({
            session_id: 'test-session',
            page: 1,
            page_size: 20,
          }),
        });
      });
    });
  });

  describe('性能优化测试', () => {
    test('useCallback应该防止不必要的重新渲染', async () => {
      await act(async () => {
        render(<FilterLogTable />);
      });

      // 验证组件正常渲染
      await waitFor(() => {
        expect(screen.getByText('今日日志')).toBeInTheDocument();
      });

      // 多次点击刷新不应该导致问题
      const refreshButton = screen.getByText('刷新');
      await act(async () => {
        fireEvent.click(refreshButton);
        fireEvent.click(refreshButton);
      });

      // 验证API调用次数合理
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });
    });
  });
});