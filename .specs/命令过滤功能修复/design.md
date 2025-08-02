# 命令过滤功能修复 - 技术设计文档

## 概述
本设计文档详细说明了如何修复命令过滤功能的现有问题，包括命令组编辑bug修复和界面布局优化。通过分析现有代码实现，设计了完整的解决方案，确保功能的正确性和用户体验的提升。

## 架构设计

### 整体架构
```
┌─────────────────────────────────────────────┐
│            CommandFilterPage                 │
│                                             │
│  ┌─────────┬──────────────┬──────────────┐ │
│  │  过滤   │   命令列表    │   命令组     │ │
│  │  规则   │              │              │ │
│  │         │              │              │ │
│  └─────────┴──────────────┴──────────────┘ │
└─────────────────────────────────────────────┘
```

### 组件架构
- **CommandFilterPage**: 主页面容器，使用三分栏布局
- **FilterRuleManagement**: 过滤规则管理组件（左栏）
- **CommandListManagement**: 命令列表管理组件（中栏）
- **CommandGroupManagement**: 命令组管理组件（右栏）

## 组件和接口

### 组件 1: CommandGroupManagement 修复
- **目的**: 修复编辑时无法显示已添加命令的问题
- **接口**: 保持现有接口不变
- **依赖**: commandFilterService, Ant Design组件

#### 问题分析
1. 后端 API 正确返回了命令组的 items 数据
2. 前端在 `handleEdit` 中正确设置了 `commandItems` 状态
3. 但是 Modal 中的已添加命令列表没有正确渲染这些数据

#### 修复方案
需要确保在编辑模式下，从后端获取完整的命令组数据（包括items），并正确显示在界面上。

### 组件 2: CommandFilterPage 布局重构
- **目的**: 实现三分栏布局，提供更好的操作体验
- **接口**: 新增布局管理接口
- **依赖**: Ant Design Layout组件

### 组件 3: FilterRuleManagement 新组件
- **目的**: 管理过滤规则，采用向导式设计
- **接口**: 
  ```typescript
  interface FilterRuleManagementProps {
    onRuleChange?: (rules: FilterRule[]) => void;
  }
  ```
- **依赖**: Steps组件、Transfer组件

### 组件 4: CommandListManagement 新组件
- **目的**: 独立的命令列表管理界面
- **接口**:
  ```typescript
  interface CommandListManagementProps {
    onCommandSelect?: (commands: Command[]) => void;
  }
  ```
- **依赖**: Table组件、Modal组件

## 数据模型

### 命令组数据结构（前端）
```typescript
interface CommandGroup {
  id: number;
  name: string;
  remark?: string;
  items: CommandGroupItem[];  // 关键：需要正确处理这个字段
  created_at: string;
  updated_at: string;
}

interface CommandGroupItem {
  id?: number;
  command_group_id?: number;
  type: 'command' | 'regex';
  content: string;
  ignore_case: boolean;
  sort_order?: number;
}
```

### API 响应适配
需要确保前端正确解析后端返回的数据结构，特别是嵌套的 items 数组。

## 错误处理

### 命令组编辑问题
- **问题**: 编辑时获取到数据但未正确显示
- **处理**: 需要在 `handleEdit` 方法中添加数据获取逻辑，确保从后端获取完整数据

### 数据同步问题
- **问题**: 状态更新可能不同步
- **处理**: 使用 useEffect 监听数据变化，确保界面及时更新

### API 错误处理
- **网络错误**: 显示重试提示
- **权限错误**: 跳转到登录页面
- **数据验证错误**: 显示具体错误信息

## 测试策略

### 单元测试
1. **命令组编辑功能测试**
   - 测试数据加载是否正确
   - 测试编辑模式下命令项的显示
   - 测试保存功能是否正常

2. **布局组件测试**
   - 测试三分栏布局响应式
   - 测试组件间通信
   - 测试数据流转

### 集成测试
1. **端到端测试**
   - 创建命令组并编辑
   - 验证数据持久化
   - 测试批量操作

2. **性能测试**
   - 大量数据渲染性能
   - 搜索响应时间
   - 内存占用情况

### 测试覆盖要求
- 单元测试覆盖率 > 80%
- 关键路径必须有集成测试
- 所有 bug 修复必须有对应的测试用例

## 实现细节

### Bug 修复：命令组编辑显示问题

#### 根本原因
在 `CommandGroupManagement.tsx` 中，`handleEdit` 方法只是设置了本地状态，但没有确保从后端获取完整的命令组详情数据。

#### 解决方案
1. 修改 `handleEdit` 方法，先调用 API 获取完整的命令组详情
2. 确保 `items` 数据正确加载到 `commandItems` 状态
3. 验证 Modal 中的渲染逻辑正确使用 `commandItems`

### 三分栏布局实现

#### 布局结构
```typescript
<Row gutter={16}>
  <Col span={6}>
    <FilterRuleManagement />
  </Col>
  <Col span={9}>
    <CommandListManagement />
  </Col>
  <Col span={9}>
    <CommandGroupManagement />
  </Col>
</Row>
```

#### 响应式设计
- 大屏幕：6-9-9 布局
- 中等屏幕：8-8-8 布局
- 小屏幕：垂直堆叠

### 向导式过滤规则设计

#### 步骤划分
1. **基本信息**: 规则名称、描述、启用状态
2. **关联命令/命令组**: 使用 Transfer 组件选择
3. **关联用户/用户组**: 使用 Transfer 组件选择
4. **关联资源**: 选择适用的主机或凭证

#### 数据流
- 每步完成后临时保存数据
- 最后一步统一提交
- 支持步骤间前后切换

## 性能优化

### 列表虚拟滚动
对于大量命令和命令组，使用虚拟滚动技术减少 DOM 节点数量。

### 搜索防抖
搜索输入添加 300ms 防抖，减少不必要的 API 请求。

### 数据缓存
- 命令组列表缓存 5 分钟
- 编辑时强制刷新缓存
- 使用 React Query 或 SWR 管理缓存

### 懒加载
- 命令详情按需加载
- 大文本内容使用懒加载
- 图标和静态资源预加载