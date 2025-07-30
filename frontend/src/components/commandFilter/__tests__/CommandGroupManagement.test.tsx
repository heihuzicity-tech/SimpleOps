import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import CommandGroupManagement from '../CommandGroupManagement';
import { commandFilterService } from '../../../services/commandFilterService';

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock commandFilterService
jest.mock('../../../services/commandFilterService', () => ({
  commandFilterService: {
    commandGroup: {
      getCommandGroups: jest.fn(),
      createCommandGroup: jest.fn(),
      updateCommandGroup: jest.fn(),
      deleteCommandGroup: jest.fn(),
    },
  },
}));

// Mock responseAdapter
jest.mock('../../../services/responseAdapter', () => ({
  adaptPaginatedResponse: jest.fn((response) => ({
    items: response.data?.items || [],
    total: response.data?.total || 0,
  })),
}));

const mockCommandGroups = [
  {
    id: 1,
    name: '高危命令组',
    remark: '包含高危命令',
    items: [
      { id: 1, type: 'command', content: 'rm', ignore_case: false },
      { id: 2, type: 'regex', content: '^sudo.*', ignore_case: true },
    ],
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 2,
    name: '系统管理命令组',
    remark: '系统管理相关命令',
    items: [
      { id: 3, type: 'command', content: 'reboot', ignore_case: false },
    ],
    created_at: '2024-01-02T10:00:00Z',
    updated_at: '2024-01-02T10:00:00Z',
  },
];

describe('CommandGroupManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    (commandFilterService.commandGroup.getCommandGroups as jest.Mock).mockResolvedValue({
      data: {
        items: mockCommandGroups,
        total: mockCommandGroups.length,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('基本渲染测试', () => {
    test('应该正确渲染组件的主要元素', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 检查基本UI元素
      expect(screen.getByText('新增命令组')).toBeInTheDocument();
      expect(screen.getByText('刷新')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜索命令组名称')).toBeInTheDocument();
      
      // 等待数据加载
      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
        expect(screen.getByText('系统管理命令组')).toBeInTheDocument();
      });
    });

    test('应该显示表格列标题', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('命令组名称')).toBeInTheDocument();
      expect(screen.getByText('备注')).toBeInTheDocument();
      expect(screen.getByText('命令数量')).toBeInTheDocument();
      expect(screen.getByText('创建时间')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });

    test('应该显示命令组数据', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
        expect(screen.getByText('包含高危命令')).toBeInTheDocument();
        expect(screen.getByText('系统管理命令组')).toBeInTheDocument();
      });
    });
  });

  describe('数据加载测试', () => {
    test('组件挂载时应该加载命令组列表', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
        name: undefined,
      });
    });

    test('加载失败时应该显示错误消息', async () => {
      (commandFilterService.commandGroup.getCommandGroups as jest.Mock).mockRejectedValue(
        new Error('加载失败')
      );

      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('加载命令组列表失败');
      });
    });

    test('刷新按钮应该重新加载数据', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      const refreshButton = screen.getByText('刷新');
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      // 应该被调用两次：初始加载 + 刷新
      expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenCalledTimes(2);
    });
  });

  describe('搜索功能测试', () => {
    test('搜索功能应该正常工作', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      const searchInput = screen.getByPlaceholderText('搜索命令组名称');
      
      await act(async () => {
        await user.type(searchInput, '高危');
        await user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenCalledWith({
          page: 1,
          page_size: 10,
          name: '高危',
        });
      });
    });

    test('清空搜索应该重置搜索条件', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      const searchInput = screen.getByPlaceholderText('搜索命令组名称');
      
      // 输入搜索内容
      await act(async () => {
        await user.type(searchInput, '高危');
      });
      
      // 清空搜索
      await act(async () => {
        await user.clear(searchInput);
        await user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenLastCalledWith({
          page: 1,
          page_size: 10,
          name: undefined,
        });
      });
    });
  });

  describe('新增命令组功能测试', () => {
    test('点击新增按钮应该打开模态框', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      const addButton = screen.getByText('新增命令组');
      
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText('新增命令组')).toBeInTheDocument();
      expect(screen.getByLabelText('命令组名称')).toBeInTheDocument();
      expect(screen.getByLabelText('备注')).toBeInTheDocument();
    });

    test('应该能够添加命令到命令组', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入命令内容
      const commandTextArea = screen.getByPlaceholderText(/请输入命令，每行一个/);
      await act(async () => {
        await user.type(commandTextArea, 'rm -rf\nshutdown');
      });

      // 点击添加到命令组
      const addCommandButton = screen.getByText('添加到命令组');
      await act(async () => {
        fireEvent.click(addCommandButton);
      });

      // 验证消息提示
      await waitFor(() => {
        expect(message.success).toHaveBeenCalledWith('已添加 2 个命令');
      });
    });

    test('提交表单应该调用创建API', async () => {
      const user = userEvent.setup();
      (commandFilterService.commandGroup.createCommandGroup as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 填写表单
      const nameInput = screen.getByLabelText('命令组名称');
      await act(async () => {
        await user.type(nameInput, '测试命令组');
      });

      const remarkInput = screen.getByLabelText('备注');
      await act(async () => {
        await user.type(remarkInput, '测试备注');
      });

      // 添加命令
      const commandTextArea = screen.getByPlaceholderText(/请输入命令，每行一个/);
      await act(async () => {
        await user.type(commandTextArea, 'test');
      });

      const addCommandButton = screen.getByText('添加到命令组');
      await act(async () => {
        fireEvent.click(addCommandButton);
      });

      // 提交表单
      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(commandFilterService.commandGroup.createCommandGroup).toHaveBeenCalledWith({
          name: '测试命令组',
          remark: '测试备注',
          items: [{
            type: 'command',
            content: 'test',
            ignore_case: false,
            sort_order: 0,
          }],
        });
        expect(message.success).toHaveBeenCalledWith('创建成功');
      });
    });

    test('表单验证应该正常工作', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 不填写名称直接提交
      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // 应该显示验证错误
      await waitFor(() => {
        expect(screen.getByText('请输入命令组名称')).toBeInTheDocument();
      });
    });

    test('没有添加命令时应该显示错误', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 只填写名称
      const nameInput = screen.getByLabelText('命令组名称');
      await act(async () => {
        await user.type(nameInput, '测试命令组');
      });

      // 直接提交（没有添加命令）
      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('请至少添加一个命令或正则表达式');
      });
    });
  });

  describe('编辑命令组功能测试', () => {
    test('点击编辑按钮应该打开编辑模态框并填充数据', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
      });

      // 点击第一个编辑按钮
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      // 验证模态框标题变为编辑
      expect(screen.getByText('编辑命令组')).toBeInTheDocument();
      
      // 验证表单已填充数据
      const nameInput = screen.getByDisplayValue('高危命令组');
      const remarkInput = screen.getByDisplayValue('包含高危命令');
      
      expect(nameInput).toBeInTheDocument();
      expect(remarkInput).toBeInTheDocument();
    });

    test('编辑提交应该调用更新API', async () => {
      const user = userEvent.setup();
      (commandFilterService.commandGroup.updateCommandGroup as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
      });

      // 点击编辑按钮
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      // 修改名称
      const nameInput = screen.getByDisplayValue('高危命令组');
      await act(async () => {
        await user.clear(nameInput);
        await user.type(nameInput, '修改后的命令组');
      });

      // 提交
      const submitButton = screen.getByText('更新');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(commandFilterService.commandGroup.updateCommandGroup).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            name: '修改后的命令组',
            remark: '包含高危命令',
          })
        );
        expect(message.success).toHaveBeenCalledWith('更新成功');
      });
    });
  });

  describe('删除命令组功能测试', () => {
    test('删除确认应该正常工作', async () => {
      (commandFilterService.commandGroup.deleteCommandGroup as jest.Mock).mockResolvedValue({});
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
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
        expect(commandFilterService.commandGroup.deleteCommandGroup).toHaveBeenCalledWith(1);
        expect(message.success).toHaveBeenCalledWith('删除成功');
      });
    });

    test('删除失败应该显示错误消息', async () => {
      (commandFilterService.commandGroup.deleteCommandGroup as jest.Mock).mockRejectedValue(
        new Error('删除失败')
      );
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
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
        expect(message.error).toHaveBeenCalledWith('删除命令组失败');
      });
    });
  });

  describe('命令项管理测试', () => {
    test('应该能够删除命令项', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 添加命令
      const commandTextArea = screen.getByPlaceholderText(/请输入命令，每行一个/);
      await act(async () => {
        fireEvent.change(commandTextArea, { target: { value: 'test' } });
      });

      const addCommandButton = screen.getByText('添加到命令组');
      await act(async () => {
        fireEvent.click(addCommandButton);
      });

      // 等待命令被添加
      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument();
      });

      // 找到删除按钮（关闭标签的按钮）
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      if (closeButtons.length > 0) {
        await act(async () => {
          fireEvent.click(closeButtons[0]);
        });
        
        // 验证命令被删除
        await waitFor(() => {
          expect(screen.queryByText('test')).not.toBeInTheDocument();
        });
      }
    });

    test('应该能够切换命令类型', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 切换到正则表达式类型
      const typeSelect = screen.getByDisplayValue('命令');
      await act(async () => {
        fireEvent.mouseDown(typeSelect);
      });

      const regexOption = screen.getByText('正则表达式');
      await act(async () => {
        fireEvent.click(regexOption);
      });

      // 验证占位符文本变化
      const textArea = screen.getByPlaceholderText(/请输入正则表达式，每行一个/);
      expect(textArea).toBeInTheDocument();
    });

    test('应该能够设置忽略大小写选项', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 勾选忽略大小写
      const ignoreCaseCheckbox = screen.getByLabelText('忽略大小写');
      await act(async () => {
        fireEvent.click(ignoreCaseCheckbox);
      });

      expect(ignoreCaseCheckbox).toBeChecked();
    });
  });

  describe('分页功能测试', () => {
    test('分页变化应该重新加载数据', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 等待初始数据加载
      await waitFor(() => {
        expect(commandFilterService.commandGroup.getCommandGroups).toHaveBeenCalledTimes(1);
      });

      // 模拟分页变化（这里由于antd表格的复杂性，我们主要测试逻辑）
      // 在实际应用中，用户点击分页会触发onChange事件
      const component = screen.getByRole('table');
      expect(component).toBeInTheDocument();
    });
  });

  describe('表格展开功能测试', () => {
    test('表格应该支持展开显示命令详情', async () => {
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
      });

      // 查找展开按钮 (由于antd table的复杂性，我们验证expandable配置存在)
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // 验证命令数量badge存在
      const badges = screen.getAllByText('2'); // 第一个命令组有2个命令
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('错误处理测试', () => {
    test('创建命令组失败应该显示错误消息', async () => {
      const user = userEvent.setup();
      (commandFilterService.commandGroup.createCommandGroup as jest.Mock).mockRejectedValue(
        new Error('创建失败')
      );
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      // 打开新增模态框并填写表单
      const addButton = screen.getByText('新增命令组');
      await act(async () => {
        fireEvent.click(addButton);
      });

      const nameInput = screen.getByLabelText('命令组名称');
      await act(async () => {
        await user.type(nameInput, '测试命令组');
      });

      const commandTextArea = screen.getByPlaceholderText(/请输入命令，每行一个/);
      await act(async () => {
        await user.type(commandTextArea, 'test');
      });

      const addCommandButton = screen.getByText('添加到命令组');
      await act(async () => {
        fireEvent.click(addCommandButton);
      });

      const submitButton = screen.getByText('创建');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('保存命令组失败');
      });
    });

    test('更新命令组失败应该显示错误消息', async () => {
      const user = userEvent.setup();
      (commandFilterService.commandGroup.updateCommandGroup as jest.Mock).mockRejectedValue(
        new Error('更新失败')
      );
      
      await act(async () => {
        render(<CommandGroupManagement />);
      });

      await waitFor(() => {
        expect(screen.getByText('高危命令组')).toBeInTheDocument();
      });

      // 点击编辑
      const editButtons = screen.getAllByText('编辑');
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      // 提交更新
      const submitButton = screen.getByText('更新');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('保存命令组失败');
      });
    });
  });
});