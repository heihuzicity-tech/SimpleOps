import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form } from 'antd';
import CommandListManagement from '../CommandListManagement';
import CommandGroupManagement from '../CommandGroupManagement';
import FilterRuleWizard from '../FilterRuleWizard';
import { commandFilterService } from '../../../services/commandFilterService';

// Mock the service
jest.mock('../../../services/commandFilterService');

describe('实时表单验证测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (commandFilterService.command.getCommands as jest.Mock).mockResolvedValue({
      data: { items: [], total: 0 }
    });
    (commandFilterService.commandGroup.getCommandGroups as jest.Mock).mockResolvedValue({
      data: { items: [], total: 0 }
    });
  });

  describe('CommandListManagement 实时验证', () => {
    it('应该在输入不合法的命令名称时显示错误', async () => {
      render(<CommandListManagement />);
      
      // 点击新增按钮
      const addButton = screen.getByText('新增命令');
      fireEvent.click(addButton);

      // 等待模态框出现
      await waitFor(() => {
        expect(screen.getByText('新增命令')).toBeInTheDocument();
      });

      // 输入包含中文的命令名称
      const nameInput = screen.getByPlaceholderText(/请输入命令名称/);
      await userEvent.type(nameInput, '删除文件');
      
      // 触发 blur 事件
      fireEvent.blur(nameInput);

      // 应该显示错误信息
      await waitFor(() => {
        expect(screen.getByText(/命令名称只能包含字母、数字、下划线、横线、斜杠、点号和星号/)).toBeInTheDocument();
      });
    });

    it('应该在输入合法的命令名称时不显示错误', async () => {
      render(<CommandListManagement />);
      
      const addButton = screen.getByText('新增命令');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('新增命令')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(/请输入命令名称/);
      await userEvent.type(nameInput, 'rm -rf');
      fireEvent.blur(nameInput);

      // 不应该显示错误信息
      await waitFor(() => {
        expect(screen.queryByText(/命令名称只能包含字母、数字、下划线、横线、斜杠、点号和星号/)).not.toBeInTheDocument();
      });
    });
  });

  describe('CommandGroupManagement 实时验证', () => {
    it('应该在输入超长描述时显示字符计数', async () => {
      render(<CommandGroupManagement />);
      
      const addButton = screen.getByText('新增命令组');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('新增命令组')).toBeInTheDocument();
      });

      const remarkInput = screen.getByPlaceholderText('请输入命令组的描述信息');
      await userEvent.type(remarkInput, 'a'.repeat(100));

      // 应该显示字符计数
      await waitFor(() => {
        expect(screen.getByText(/100 \/ 500/)).toBeInTheDocument();
      });
    });

    it('应该在输入不合法的正则表达式时显示警告', async () => {
      render(<CommandGroupManagement />);
      
      const addButton = screen.getByText('新增命令组');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('新增命令组')).toBeInTheDocument();
      });

      // 切换到正则表达式模式
      const selectButton = screen.getByText('命令');
      fireEvent.click(selectButton);
      const regexOption = screen.getByText('正则表达式');
      fireEvent.click(regexOption);

      // 输入无效的正则表达式
      const textArea = screen.getByPlaceholderText(/请输入正则表达式/);
      await userEvent.type(textArea, '[');

      // 应该显示警告消息
      await waitFor(() => {
        expect(screen.getByText(/正则表达式语法错误/)).toBeInTheDocument();
      });
    });
  });

  describe('FilterRuleWizard 实时验证', () => {
    const defaultProps = {
      visible: true,
      editingFilter: null,
      commandGroups: [
        { id: 1, name: '测试命令组', items: [], created_at: new Date().toISOString() }
      ],
      users: [],
      assets: [],
      availableAccounts: [],
      onCancel: jest.fn(),
      onSubmit: jest.fn()
    };

    it('应该验证规则名称格式', async () => {
      render(<FilterRuleWizard {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/请输入规则名称/);
      await userEvent.type(nameInput, 'test@rule#');
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(screen.getByText(/规则名称只能包含中文、字母、数字、下划线、横线和空格/)).toBeInTheDocument();
      });
    });

    it('应该验证优先级范围', async () => {
      render(<FilterRuleWizard {...defaultProps} />);

      const priorityInput = screen.getByRole('spinbutton');
      await userEvent.clear(priorityInput);
      await userEvent.type(priorityInput, '200');
      fireEvent.blur(priorityInput);

      await waitFor(() => {
        expect(screen.getByText(/优先级范围为1-100/)).toBeInTheDocument();
      });
    });
  });
});