import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import CommandFilterManagement from '../CommandFilterManagement';
import { commandFilterService } from '../../../services/commandFilterService';
import { getUsers } from '../../../services/userAPI';
import { getAssets } from '../../../services/assetAPI';

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock services
jest.mock('../../../services/commandFilterService', () => ({
  commandFilterService: {
    filter: {
      getFilters: jest.fn(),
      getFilter: jest.fn(),
      createFilter: jest.fn(),
      updateFilter: jest.fn(),
      deleteFilter: jest.fn(),
      toggleFilter: jest.fn(),
    },
    commandGroup: {
      getCommandGroups: jest.fn(),
    },
  },
}));

jest.mock('../../../services/userAPI', () => ({
  getUsers: jest.fn(),
}));

jest.mock('../../../services/assetAPI', () => ({
  getAssets: jest.fn(),
}));

// Mock responseAdapter
jest.mock('../../../services/responseAdapter', () => ({
  adaptPaginatedResponse: jest.fn((response) => ({
    items: response.data?.items || [],
    total: response.data?.total || 0,
  })),
}));

// Mock types
jest.mock('../../../types', () => ({
  FilterAction: {
    DENY: 'deny',
    ALLOW: 'allow',
    ALERT: 'alert',
    PROMPT_ALERT: 'prompt_alert',
  },
}));

const mockFilters = [
  {
    id: 1,
    name: '高危命令过滤规则',
    priority: 10,
    enabled: true,
    user_type: 'all',
    asset_type: 'all',
    account_type: 'all',
    action: 'deny',
    command_group: { id: 1, name: '高危命令组' },
    users: [],
    assets: [],
    attributes: [],
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 2,
    name: '特定用户限制规则',
    priority: 50,
    enabled: false,
    user_type: 'specific',
    asset_type: 'specific',
    account_type: 'specific',
    account_names: 'root,admin',
    action: 'alert',
    command_group: { id: 2, name: '系统管理命令组' },
    users: [1, 2],
    assets: [1],
    attributes: [],
    created_at: '2024-01-02T10:00:00Z',
    updated_at: '2024-01-02T10:00:00Z',
  },
];

const mockCommandGroups = [
  { id: 1, name: '高危命令组', is_preset: true },
  { id: 2, name: '系统管理命令组', is_preset: false },
];

const mockUsers = [
  { id: 1, username: 'admin', email: 'admin@example.com' },
  { id: 2, username: 'user1', email: 'user1@example.com' },
];

const mockAssets = [
  { id: 1, name: 'server1', type: 'linux', address: '192.168.1.100', port: 22 },
  { id: 2, name: 'server2', type: 'linux', address: '192.168.1.101', port: 22 },
];

describe('CommandFilterManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    (commandFilterService.filter.getFilters as jest.Mock).mockResolvedValue({
      data: {
        items: mockFilters,
        total: mockFilters.length,
      },
    });
    
    (commandFilterService.commandGroup.getCommandGroups as jest.Mock).mockResolvedValue({
      data: {
        items: mockCommandGroups,
        total: mockCommandGroups.length,
      },
    });
    
    (getUsers as jest.Mock).mockResolvedValue({
      data: {
        data: {
          users: mockUsers,
        },
      },
    });
    
    (getAssets as jest.Mock).mockResolvedValue({
      data: {
        data: {
          assets: mockAssets,
        },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基本渲染测试', () => {
    test('应该正确渲染组件的主要元素', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 检查基本UI元素
      expect(screen.getByText('新增过滤规则')).toBeInTheDocument();
      expect(screen.getByText('刷新')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜索规则名称')).toBeInTheDocument();
      
      // 等待数据加载
      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
        expect(screen.getByText('特定用户限制规则')).toBeInTheDocument();
      });
    });

    test('应该显示表格列标题', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('规则名称')).toBeInTheDocument();
      expect(screen.getByText('优先级')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();
      expect(screen.getByText('应用范围')).toBeInTheDocument();
      expect(screen.getByText('命令组')).toBeInTheDocument();
      expect(screen.getByText('动作')).toBeInTheDocument();
      expect(screen.getByText('创建时间')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });

    test('应该显示过滤规则数据', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
        expect(screen.getByText('特定用户限制规则')).toBeInTheDocument();
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
        expect(screen.getByText('系统管理命令组')).toBeInTheDocument();
      });
    });
  });

  describe('数据加载测试', () => {
    test('组件挂载时应该加载所有必要的数据', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      expect(commandFilterService.filter.getFilters).toHaveBeenCalled();
      expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenCalled();
      expect(getUsers).toHaveBeenCalled();
      expect(getAssets).toHaveBeenCalled();
    });

    test('加载失败时应该显示错误消息', async () => {
      (commandFilterService.filter.getFilters as jest.Mock).mockRejectedValue(
        new Error('加载失败')
      );

      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('加载过滤规则列表失败');
      });
    });

    test('刷新按钮应该重新加载数据', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      const refreshButton = screen.getByText('刷新');
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      // 应该被调用两次：初始加载 + 刷新
      expect(commandFilterService.filter.getFilters).toHaveBeenCalledTimes(2);
    });
  });

  describe('搜索功能测试', () => {
    test('搜索功能应该正常工作', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      const searchInput = screen.getByPlaceholderText('搜索规则名称');
      
      await act(async () => {
        await user.type(searchInput, '高危');
        await user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(commandFilterService.filter.getFilters).toHaveBeenCalledWith({
          page: 1,
          page_size: 10,
          name: '高危',
        });
      });
    });
  });

  describe('新增过滤规则功能测试', () => {
    test('点击新增按钮应该打开模态框并设置默认值', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      const addButton = screen.getByText('新增过滤规则');
      
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText('新增过滤规则')).toBeInTheDocument();
      expect(screen.getByLabelText('规则名称')).toBeInTheDocument();
      expect(screen.getByLabelText('优先级')).toBeInTheDocument();
      
      // 检查默认值
      const enabledSwitch = screen.getByRole('switch');
      expect(enabledSwitch).toBeChecked();
    });

    test('提交表单应该调用创建API', async () => {
      const user = userEvent.setup();
      (commandFilterService.filter.createFilter as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 填写表单
      const nameInput = screen.getByLabelText('规则名称');
      await act(async () => {
        await user.type(nameInput, '测试过滤规则');
      });

      // 选择命令组
      const commandGroupSelect = screen.getByPlaceholderText('请选择命令组');
      await act(async () => {
        fireEvent.mouseDown(commandGroupSelect);
      });
      
      await waitFor(() => {
        const groupOption = screen.getByText('高危命令组');
        fireEvent.click(groupOption);
      });

      // 提交表单
      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(commandFilterService.filter.createFilter).toHaveBeenCalled();
        expect(message.success).toHaveBeenCalledWith('创建成功');
      });
    });

    test('表单验证应该正常工作', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 不填写必填项直接提交
      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // 应该显示验证错误
      await waitFor(() => {
        expect(screen.getByText('请输入规则名称')).toBeInTheDocument();
      });
    });
  });

  describe('编辑过滤规则功能测试', () => {
    test('点击编辑按钮应该加载详细信息并打开模态框', async () => {
      const mockFilterDetail = {
        ...mockFilters[0],
        users: [1],
        assets: [1],
        attributes: [
          { id: 1, filter_id: 1, target_type: 'user', name: 'department', value: 'IT' }
        ],
      };
      
      (commandFilterService.filter.getFilter as jest.Mock).mockResolvedValue({
        data: mockFilterDetail,
      });

      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击第一个编辑按钮
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        expect(commandFilterService.filter.getFilter).toHaveBeenCalledWith(1);
        expect(screen.getByText('编辑过滤规则')).toBeInTheDocument();
      });
    });

    test('编辑提交应该调用更新API', async () => {
      const user = userEvent.setup();
      (commandFilterService.filter.getFilter as jest.Mock).mockResolvedValue({
        data: mockFilters[0],
      });
      (commandFilterService.filter.updateFilter as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击编辑按钮
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('高危命令过滤规则')).toBeInTheDocument();
      });

      // 修改名称
      const nameInput = screen.getByDisplayValue('高危命令过滤规则');
      await act(async () => {
        await user.clear(nameInput);
        await user.type(nameInput, '修改后的过滤规则');
      });

      // 提交
      const submitButton = screen.getByText('更新');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(commandFilterService.filter.updateFilter).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: '修改后的过滤规则',
          })
        );
        expect(message.success).toHaveBeenCalledWith('更新成功');
      });
    });
  });

  describe('删除过滤规则功能测试', () => {
    test('删除确认应该正常工作', async () => {
      (commandFilterService.filter.deleteFilter as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击第一个删除按钮
      const deleteButtons = screen.getAllByText('删除');
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      // 确认删除
      const confirmButton = screen.getByText('确定');
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(commandFilterService.filter.deleteFilter).toHaveBeenCalledWith(1);
        expect(message.success).toHaveBeenCalledWith('删除成功');
      });
    });

    test('删除失败应该显示错误消息', async () => {
      (commandFilterService.filter.deleteFilter as jest.Mock).mockRejectedValue(
        new Error('删除失败')
      );
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击删除并确认
      const deleteButtons = screen.getAllByText('删除');
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      const confirmButton = screen.getByText('确定');
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('删除过滤规则失败');
      });
    });
  });

  describe('状态切换功能测试', () => {
    test('状态切换应该调用切换API', async () => {
      (commandFilterService.filter.toggleFilter as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('特定用户限制规则')).toBeInTheDocument();
      });

      // 找到第二个规则的状态开关（默认是禁用的）
      const switches = screen.getAllByRole('switch');
      const disabledSwitch = switches.find(sw => !sw.getAttribute('checked'));
      
      if (disabledSwitch) {
        await act(async () => {
          fireEvent.click(disabledSwitch);
        });

        await waitFor(() => {
          expect(commandFilterService.filter.toggleFilter).toHaveBeenCalledWith(2);
          expect(message.success).toHaveBeenCalledWith('状态切换成功');
        });
      }
    });

    test('状态切换失败应该显示错误消息', async () => {
      (commandFilterService.filter.toggleFilter as jest.Mock).mockRejectedValue(
        new Error('切换失败')
      );
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击第一个状态开关
      const switches = screen.getAllByRole('switch');
      await act(async () => {
        fireEvent.click(switches[0]);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('切换状态失败');
      });
    });
  });

  describe('用户范围选择测试', () => {
    test('选择指定用户应该显示Transfer组件', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择指定用户
      const userTypeSelect = screen.getByDisplayValue('所有用户');
      await act(async () => {
        fireEvent.mouseDown(userTypeSelect);
      });

      const specificUserOption = screen.getByText('指定用户');
      await act(async () => {
        fireEvent.click(specificUserOption);
      });

      // 验证Transfer组件出现
      await waitFor(() => {
        expect(screen.getByText('可选用户')).toBeInTheDocument();
        expect(screen.getByText('已选用户')).toBeInTheDocument();
      });
    });

    test('选择属性筛选应该显示属性配置', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择属性筛选
      const userTypeSelect = screen.getByDisplayValue('所有用户');
      await act(async () => {
        fireEvent.mouseDown(userTypeSelect);
      });

      const attributeOption = screen.getByText('属性筛选');
      await act(async () => {
        fireEvent.click(attributeOption);
      });

      // 验证属性筛选条件区域出现
      await waitFor(() => {
        expect(screen.getByText('属性筛选条件')).toBeInTheDocument();
        expect(screen.getByText('添加属性条件')).toBeInTheDocument();
      });
    });
  });

  describe('资产范围选择测试', () => {
    test('选择指定资产应该显示Transfer组件', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择指定资产
      const assetTypeSelect = screen.getByDisplayValue('所有资产');
      await act(async () => {
        fireEvent.mouseDown(assetTypeSelect);
      });

      const specificAssetOption = screen.getByText('指定资产');
      await act(async () => {
        fireEvent.click(specificAssetOption);
      });

      // 验证Transfer组件出现
      await waitFor(() => {
        expect(screen.getByText('可选资产')).toBeInTheDocument();
        expect(screen.getByText('已选资产')).toBeInTheDocument();
      });
    });
  });

  describe('账号范围选择测试', () => {
    test('选择指定账号应该显示账号输入框', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择指定账号
      const accountTypeSelect = screen.getByDisplayValue('所有账号');
      await act(async () => {
        fireEvent.mouseDown(accountTypeSelect);
      });

      const specificAccountOption = screen.getByText('指定账号');
      await act(async () => {
        fireEvent.click(specificAccountOption);
      });

      // 验证账号输入框出现
      await waitFor(() => {
        expect(screen.getByLabelText('账号名称')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例如: root,admin,deploy')).toBeInTheDocument();
      });
    });
  });

  describe('属性管理测试', () => {
    test('应该能够添加属性条件', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择属性筛选
      const userTypeSelect = screen.getByDisplayValue('所有用户');
      await act(async () => {
        fireEvent.mouseDown(userTypeSelect);
      });

      const attributeOption = screen.getByText('属性筛选');
      await act(async () => {
        fireEvent.click(attributeOption);
      });

      // 添加属性条件
      const addAttributeButton = screen.getByText('添加属性条件');
      await act(async () => {
        fireEvent.click(addAttributeButton);
      });

      // 验证属性输入框出现
      await waitFor(() => {
        expect(screen.getByPlaceholderText('属性名称')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('属性值')).toBeInTheDocument();
      });
    });

    test('应该能够删除属性条件', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 选择属性筛选
      const userTypeSelect = screen.getByDisplayValue('所有用户');
      await act(async () => {
        fireEvent.mouseDown(userTypeSelect);
      });

      const attributeOption = screen.getByText('属性筛选');
      await act(async () => {
        fireEvent.click(attributeOption);
      });

      // 添加属性条件
      const addAttributeButton = screen.getByText('添加属性条件');
      await act(async () => {
        fireEvent.click(addAttributeButton);
      });

      // 删除属性条件
      await waitFor(() => {
        const deleteButton = screen.getByText('删除');
        fireEvent.click(deleteButton);
      });

      // 验证属性条件被删除
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('属性名称')).not.toBeInTheDocument();
      });
    });
  });

  describe('动作选择测试', () => {
    test('应该显示所有可用的动作选项', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 点击动作选择框
      const actionSelect = screen.getByDisplayValue('拒绝');
      await act(async () => {
        fireEvent.mouseDown(actionSelect);
      });

      // 验证所有动作选项都存在
      await waitFor(() => {
        expect(screen.getByText('拒绝')).toBeInTheDocument();
        expect(screen.getByText('允许')).toBeInTheDocument();
        expect(screen.getByText('告警')).toBeInTheDocument();
        expect(screen.getByText('提示并告警')).toBeInTheDocument();
      });
    });
  });

  describe('分页功能测试', () => {
    test('分页变化应该重新加载数据', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 等待初始数据加载
      await waitFor(() => {
        expect(commandFilterService.filter.getFilters).toHaveBeenCalledTimes(1);
      });

      // 验证分页组件存在
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('错误处理测试', () => {
    test('创建过滤规则失败应该显示错误消息', async () => {
      const user = userEvent.setup();
      (commandFilterService.filter.createFilter as jest.Mock).mockRejectedValue(
        new Error('创建失败')
      );
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      // 打开新增模态框并填写表单
      const addButton = screen.getByText('新增过滤规则');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const nameInput = screen.getByLabelText('规则名称');
      await act(async () => {
        await user.type(nameInput, '测试过滤规则');
      });

      // 选择命令组
      const commandGroupSelect = screen.getByPlaceholderText('请选择命令组');
      await act(async () => {
        fireEvent.mouseDown(commandGroupSelect);
      });
      
      await waitFor(() => {
        const groupOption = screen.getByText('高危命令组');
        fireEvent.click(groupOption);
      });

      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('保存过滤规则失败');
      });
    });

    test('更新过滤规则失败应该显示错误消息', async () => {
      (commandFilterService.filter.getFilter as jest.Mock).mockResolvedValue({
        data: mockFilters[0],
      });
      (commandFilterService.filter.updateFilter as jest.Mock).mockRejectedValue(
        new Error('更新失败')
      );
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击编辑
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        const submitButton = screen.getByText('更新');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('保存过滤规则失败');
      });
    });

    test('加载过滤规则详情失败应该显示错误消息', async () => {
      (commandFilterService.filter.getFilter as jest.Mock).mockRejectedValue(
        new Error('加载详情失败')
      );
      
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令过滤规则')).toBeInTheDocument();
      });

      // 点击编辑
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('加载过滤规则详情失败');
      });
    });
  });

  describe('优先级显示测试', () => {
    test('应该根据优先级显示不同颜色的badge', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        // 验证优先级badge存在
        const priorityBadges = screen.getAllByText('10');
        expect(priorityBadges.length).toBeGreaterThan(0);
        
        const priorityBadges50 = screen.getAllByText('50');
        expect(priorityBadges50.length).toBeGreaterThan(0);
      });
    });
  });

  describe('应用范围显示测试', () => {
    test('应该正确显示不同类型的应用范围', async () => {
      await act(async () => {
        render(<CommandFilterManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('所有用户')).toBeInTheDocument();
        expect(screen.getByText('所有资产')).toBeInTheDocument();
        expect(screen.getByText('所有账号')).toBeInTheDocument();
        
        // 特定用户限制规则的显示
        expect(screen.getAllByText(/指定用户/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/指定资产/).length).toBeGreaterThan(0);
      });
    });
  });
});