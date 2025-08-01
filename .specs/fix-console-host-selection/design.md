# 修复控制台主机选中问题 - 技术设计

## 概述
当用户在控制台选择主机并关闭凭证选择窗口后，该主机无法再次被选中。这是由于状态管理不当导致的问题。

## 现有代码分析
### 相关模块
- WorkspaceStandalone组件：控制台主页面 - 位置：`frontend/src/pages/connect/WorkspaceStandalone.tsx`
- ResourceTree组件：资源树显示 - 位置：`frontend/src/components/sessions/ResourceTree.tsx`
- CredentialSelector组件：凭证选择对话框 - 位置：`frontend/src/components/sessions/CredentialSelector.tsx`

### 问题根源分析
1. **状态锁定问题**：
   - 当用户选择主机时，`selectedAsset`状态被设置
   - 弹出凭证选择窗口
   - 用户关闭窗口时，`credentialSelectorVisible`设为false
   - 但`selectedAsset`状态未被清理，导致重复选择同一主机时被阻止

2. **Menu组件选中状态问题**：
   - ResourceTree使用Menu组件在控制台模式下显示主机
   - Menu的selectedKeys可能保持了之前的选中状态
   - 导致视觉上看起来主机仍被选中，但无法触发新的选择事件

## 架构设计
### 状态管理改进
```typescript
// WorkspaceStandalone组件状态
{
  selectedAsset: Asset | null,          // 当前选中的资产
  credentialSelectorVisible: boolean,    // 凭证选择器可见性
  selectedMenuKeys: string[],            // Menu组件选中键值
}
```

### 事件流程设计
1. 用户点击主机 → 设置selectedAsset → 显示凭证选择器
2. 用户选择凭证 → 创建会话 → 清理状态
3. 用户取消/关闭窗口 → 清理selectedAsset和selectedMenuKeys → 恢复可选状态

## 核心组件设计
### WorkspaceStandalone组件修改
- **责任**：管理主机选择和凭证选择的完整流程
- **位置**：`frontend/src/pages/connect/WorkspaceStandalone.tsx`
- **接口设计**：
  - handleCredentialCancel: 处理凭证选择取消事件
  - clearSelection: 清理选中状态
- **依赖**：ResourceTree, CredentialSelector

### ResourceTree组件增强
- **责任**：管理Menu组件的选中状态
- **位置**：`frontend/src/components/sessions/ResourceTree.tsx`
- **接口设计**：
  - 接收外部的selectedMenuKeys属性
  - 支持清除选中状态的回调

## 数据模型设计
### 状态同步机制
```typescript
interface SelectionState {
  asset: Asset | null;
  menuKeys: string[];
  isSelecting: boolean;
}
```

## 文件修改计划
### 需要修改的文件
- `frontend/src/pages/connect/WorkspaceStandalone.tsx` - 添加取消处理逻辑
- `frontend/src/components/sessions/ResourceTree.tsx` - 支持外部控制选中状态
- `frontend/src/components/sessions/CredentialSelector.tsx` - 确保取消事件正确触发

### 修改内容
1. WorkspaceStandalone：
   - 添加handleCredentialCancel方法
   - 在凭证选择器关闭时清理selectedAsset
   - 管理ResourceTree的selectedMenuKeys

2. ResourceTree：
   - 接收外部selectedMenuKeys属性
   - 同步Menu组件的选中状态

## 错误处理策略
- 用户取消操作：清理所有相关状态
- 重复选择同一主机：允许重新打开凭证选择器
- 状态不一致：在组件卸载时清理所有状态

## 性能与安全考虑
### 性能优化
- 使用useCallback避免不必要的重渲染
- 状态更新批量处理

### 用户体验
- 取消操作后立即恢复可选状态
- 清除视觉上的选中效果

## 测试策略
- 单元测试：测试状态清理逻辑
- 集成测试：测试完整的选择-取消-重选流程
- 边界测试：快速点击、多次取消等场景