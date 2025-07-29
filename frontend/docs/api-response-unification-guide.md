# API 响应格式统一化指南

## 核心原则

### 1. 统一响应格式是架构的核心价值
- **所有分页数据必须使用 `PaginatedResult<T>` 格式**
- **列表数据统一使用 `items` 字段名**
- **不要为特殊情况做特殊处理**

### 2. 三层架构的职责划分

#### BaseApiService 层
- 负责将后端各种格式转换为统一格式
- 处理 `users → items`、`logs → items` 等字段映射
- 处理嵌套的 `data.data` 结构

#### ApiService 层
- 继承 BaseApiService
- 声明返回类型为 `PaginatedResult<T>`
- 不做任何格式转换（由基类处理）

#### 组件层
- **必须使用统一格式 `response.data.items`**
- **不允许使用旧格式字段名（users、logs、records等）**
- 相信 ApiService 返回的格式

## 错误示例 ❌

```typescript
// 组件中不应该这样写
if (response.success) {
  setData(response.data.logs || []);  // ❌ 使用旧字段名
  setData(response.data.users || []); // ❌ 使用旧字段名
}
```

## 正确示例 ✅

```typescript
// 组件中应该这样写
if (response.success) {
  setData(response.data.items || []);  // ✅ 使用统一字段名
  setTotal(response.data.total);
}
```

## 迁移检查清单

当迁移一个模块时，请确保：

1. [ ] ApiService 返回类型声明为 `PaginatedResult<T>`
2. [ ] 组件中所有列表数据使用 `items` 字段
3. [ ] 删除所有特殊字段名的引用
4. [ ] 测试数据能正常显示

## 为什么这样做？

1. **减少维护成本**：不需要记住每个API的特殊字段名
2. **提高开发效率**：新组件可以直接复用现有模式
3. **便于后端迁移**：当后端统一格式后，只需修改 BaseApiService
4. **类型安全**：TypeScript 可以更好地推断类型

## 后续模块迁移顺序

1. ✅ 用户管理 (UserApiService)
2. ✅ 认证 (AuthApiService)
3. ✅ 审计日志 (AuditApiService)
4. ⏳ 资产管理 (AssetApiService)
5. ⏳ 凭证管理 (CredentialApiService)
6. ⏳ SSH会话 (SSHApiService)
7. ⏳ 角色管理 (RoleApiService)

## 注意事项

- 如果发现组件使用旧字段名，立即修改为 `items`
- 如果后端返回新的列表字段，在 BaseApiService 中添加映射
- 保持耐心，渐进式迁移，每个模块都要测试