# 修复控制台主机选中问题 - 需求规格说明书

## 概述
控制台页面中主机选择功能存在交互问题，当用户从侧边栏资源树中点击具体主机时，系统无法正确响应选中事件，导致无法建立SSH连接。

## 用户故事
作为堡垒机用户，我希望在控制台页面中能够通过点击左侧资源树中的主机来快速建立SSH连接，以便高效地管理多台服务器。

## 验收标准（EARS格式）
1. WHEN 用户在控制台页面点击左侧资源树中的具体主机 THEN 系统SHALL 弹出凭证选择对话框
2. IF 用户选择了凭证并确认 THEN 系统SHALL 创建新的SSH会话标签页
3. WHILE 主机已被选中 THE 界面 SHALL 显示选中状态的视觉反馈
4. WHEN 用户点击已连接的主机 THEN 系统SHALL 允许创建多个会话标签页

## 功能需求
### 主机选择交互
- 支持通过ResourceTree组件的Menu模式选择主机
- 正确处理Menu组件的onSelect事件
- 保持选中状态的视觉反馈

### 事件传递机制
- Menu组件的选择事件需正确传递到父组件
- 确保handleTreeSelect能够处理Menu模式下的选择事件
- 维护selectedKeys状态的同步

### 多会话支持
- 允许同一主机创建多个SSH会话标签页
- 每个标签页使用独立的会话ID
- 标签页标题显示主机名和用户名

## 非功能需求
### 性能需求
- 主机选择响应时间：< 100ms
- 凭证对话框显示时间：< 200ms

### 可用性需求
- 选中状态必须有明确的视觉反馈
- 操作流程符合用户直觉
- 错误提示清晰友好

## 约束条件
### 技术约束
- 必须兼容现有的ResourceTree组件架构
- 不能破坏其他页面的资源树功能
- 保持与现有Menu/Tree组件API的兼容性

### 业务约束
- 不改变现有的权限控制逻辑
- 不影响审计日志记录功能

## 风险评估
### 技术风险
- Menu组件与Tree组件事件处理差异 - 概率：高，影响：高
- 状态管理不同步 - 概率：中，影响：中

### 缓解策略
- Menu组件事件差异：详细测试Menu组件的事件机制，确保兼容性
- 状态管理：使用统一的状态管理方案，避免组件间状态不一致

## 问题分析
通过代码分析发现：
1. WorkspaceStandalone组件的handleTreeSelect只处理了Tree组件的选择事件
2. ResourceTree在showHostDetails模式下使用Menu组件替代Tree组件
3. Menu组件的onSelect事件参数格式与Tree组件不同
4. 当前的事件处理逻辑无法正确识别Menu组件传递的选择事件

## 影响范围
- /frontend/src/pages/connect/WorkspaceStandalone.tsx
- /frontend/src/components/sessions/ResourceTree.tsx
- 不影响其他使用ResourceTree的页面（如资产管理页面）