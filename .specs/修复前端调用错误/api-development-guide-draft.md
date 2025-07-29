# Bastion前端API开发规范指南（草案）

## 概述
本指南为Bastion项目前端开发人员提供标准化的API模块开发流程。遵循本规范可以在5分钟内完成一个新API模块的创建，并确保代码质量和一致性。

## 快速开始：5分钟创建新API模块

### 示例：添加角色管理(Role)模块

#### 第1步：创建类型定义（1分钟）
```typescript
// frontend/src/services/types/role.ts
export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateRoleDTO {
  name: string;
  description: string;
  permissions: string[];
}

export interface UpdateRoleDTO {
  name?: string;
  description?: string;
  permissions?: string[];
}
```

#### 第2步：创建Service类（2分钟）
```typescript
// frontend/src/services/api/RoleApiService.ts
import { BaseApiService, PaginatedResult } from '../base/BaseApiService';
import { Role, CreateRoleDTO, UpdateRoleDTO } from '../types/role';

export class RoleApiService extends BaseApiService {
  constructor() {
    super('/roles');
  }
  
  // 获取角色列表
  async getRoles(params?: any): Promise<{
    success: boolean;
    data: PaginatedResult<Role>;
  }> {
    const data = await this.get<PaginatedResult<Role>>(this.endpoint, params);
    return {
      success: true,
      data
    };
  }
  
  // 获取单个角色
  async getRoleById(id: number): Promise<{ success: boolean; data: Role }> {
    const data = await this.get<Role>(this.buildUrl(`/${id}`));
    return {
      success: true,
      data
    };
  }
  
  // 创建角色
  async createRole(roleData: CreateRoleDTO): Promise<{ success: boolean; data: Role }> {
    const data = await this.post<Role>(this.endpoint, roleData);
    return {
      success: true,
      data
    };
  }
  
  // 更新角色
  async updateRole(id: number, roleData: UpdateRoleDTO): Promise<{ success: boolean; data: Role }> {
    const data = await this.put<Role>(this.buildUrl(`/${id}`), roleData);
    return {
      success: true,
      data
    };
  }
  
  // 删除角色
  async deleteRole(id: number): Promise<{ success: boolean }> {
    await this.delete(this.buildUrl(`/${id}`));
    return {
      success: true
    };
  }
  
  // 角色特有方法：分配权限
  async assignPermissions(roleId: number, permissions: string[]): Promise<{ success: boolean; data: Role }> {
    const data = await this.post<Role>(this.buildUrl(`/${roleId}/permissions`), { permissions });
    return {
      success: true,
      data
    };
  }
}

// 导出实例
export const roleApiService = new RoleApiService();
```

#### 第3步：创建Redux Slice（2分钟）
```typescript
// frontend/src/store/roleSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
import { roleApiService } from '../services/api/RoleApiService';
import { Role } from '../services/types/role';

interface RoleState {
  roles: Role[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: RoleState = {
  roles: [],
  total: 0,
  loading: false,
  error: null,
};

// 异步actions
export const fetchRoles = createAsyncThunk(
  'role/fetchRoles',
  async (params: { page?: number; page_size?: number; keyword?: string }) => {
    const response = await roleApiService.getRoles(params);
    return response.data;
  }
);

export const createRole = createAsyncThunk(
  'role/createRole',
  async (roleData: { name: string; description: string; permissions: string[] }) => {
    const response = await roleApiService.createRole(roleData);
    message.success('角色创建成功');
    return response.data;
  }
);

export const updateRole = createAsyncThunk(
  'role/updateRole',
  async ({ id, roleData }: { id: number; roleData: any }) => {
    const response = await roleApiService.updateRole(id, roleData);
    message.success('角色更新成功');
    return response.data;
  }
);

export const deleteRole = createAsyncThunk(
  'role/deleteRole',
  async (id: number) => {
    await roleApiService.deleteRole(id);
    message.success('角色删除成功');
    return id;
  }
);

const roleSlice = createSlice({
  name: 'role',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取角色列表
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取角色列表失败';
      })
      // 创建角色
      .addCase(createRole.fulfilled, (state, action) => {
        state.roles.unshift(action.payload);
        state.total += 1;
      })
      // 更新角色
      .addCase(updateRole.fulfilled, (state, action) => {
        const index = state.roles.findIndex(role => role.id === action.payload.id);
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
      })
      // 删除角色
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.roles = state.roles.filter(role => role.id !== action.payload);
        state.total -= 1;
      });
  },
});

export const { clearError } = roleSlice.actions;
export default roleSlice.reducer;
```

## 开发规范详解

### 1. 目录结构规范
```
frontend/src/
├── services/
│   ├── base/
│   │   └── BaseApiService.ts      # 基础类（不要修改）
│   ├── api/
│   │   ├── UserApiService.ts      # 用户模块
│   │   ├── RoleApiService.ts      # 角色模块（新增）
│   │   └── [Module]ApiService.ts  # 其他模块
│   └── types/
│       ├── common.ts              # 通用类型
│       ├── user.ts                # 用户类型
│       ├── role.ts                # 角色类型（新增）
│       └── [module].ts            # 其他模块类型
└── store/
    ├── userSlice.ts               # 用户状态
    ├── roleSlice.ts               # 角色状态（新增）
    └── [module]Slice.ts           # 其他模块状态
```

### 2. 命名规范
- **Service类**：`[Module]ApiService` (首字母大写)
- **Service实例**：`[module]ApiService` (首字母小写)
- **Slice文件**：`[module]Slice.ts` (首字母小写)
- **类型文件**：`[module].ts` (全小写)
- **接口命名**：
  - 实体：`[Module]` (如 Role, User)
  - 创建DTO：`Create[Module]DTO`
  - 更新DTO：`Update[Module]DTO`

### 3. Service类编写规范

#### 必须继承BaseApiService
```typescript
export class [Module]ApiService extends BaseApiService {
  constructor() {
    super('/[endpoint]'); // API端点路径
  }
}
```

#### 标准方法命名
- 获取列表：`get[Modules](params?)`
- 获取单个：`get[Module]ById(id)`
- 创建：`create[Module](data)`
- 更新：`update[Module](id, data)`
- 删除：`delete[Module](id)`

#### 返回值格式
所有方法必须返回统一格式：
```typescript
{
  success: boolean;
  data: T;  // T为具体的数据类型
}
```

### 4. Redux Slice编写规范

#### 标准状态结构
```typescript
interface [Module]State {
  [modules]: [Module][];  // 列表数据
  total: number;         // 总数
  loading: boolean;      // 加载状态
  error: string | null;  // 错误信息
}
```

#### 标准异步Actions
- `fetch[Modules]` - 获取列表
- `create[Module]` - 创建
- `update[Module]` - 更新
- `delete[Module]` - 删除

#### 错误处理
- 使用message.success()显示成功消息
- 使用message.error()显示错误消息
- 在rejected状态设置error信息

### 5. 类型定义规范

#### 基础实体接口
```typescript
export interface [Module] {
  id: number;
  // 其他字段...
  created_at: string;
  updated_at: string;
}
```

#### DTO接口
```typescript
// 创建时需要的字段（不包含id和时间戳）
export interface Create[Module]DTO {
  // 必填字段
}

// 更新时的字段（全部可选）
export interface Update[Module]DTO {
  // 所有字段都是可选的
}
```

### 6. 测试要求

#### Service层测试
```typescript
describe('[Module]ApiService', () => {
  it('should fetch [modules] list', async () => {
    const result = await [module]ApiService.get[Modules]();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.items)).toBe(true);
  });
  
  // 其他CRUD测试...
});
```

#### Redux Slice测试
```typescript
describe('[module]Slice', () => {
  it('should handle fetch[Modules]', async () => {
    const result = await store.dispatch(fetch[Modules]({}));
    expect(result.type).toBe('role/fetch[Modules]/fulfilled');
    // 验证状态更新...
  });
});
```

### 7. 常见场景处理

#### 处理嵌套关系
```typescript
// 如果角色包含权限列表
export interface Role {
  id: number;
  name: string;
  permissions: Permission[]; // 嵌套关系
}
```

#### 处理特殊查询
```typescript
// 添加特殊的查询方法
async getRolesByPermission(permission: string): Promise<{
  success: boolean;
  data: PaginatedResult<Role>;
}> {
  const data = await this.get<PaginatedResult<Role>>(
    this.buildUrl('/by-permission'),
    { permission }
  );
  return { success: true, data };
}
```

#### 处理批量操作
```typescript
// 批量删除
async batchDeleteRoles(ids: number[]): Promise<{ success: boolean }> {
  await this.post(this.buildUrl('/batch-delete'), { ids });
  return { success: true };
}
```

### 8. 代码模板使用

可以使用以下命令快速生成模板（需要安装相应工具）：
```bash
# 生成Service类
cp frontend/templates/ApiService.template.ts frontend/src/services/api/[Module]ApiService.ts

# 生成Slice
cp frontend/templates/Slice.template.ts frontend/src/store/[module]Slice.ts

# 生成类型定义
cp frontend/templates/types.template.ts frontend/src/services/types/[module].ts
```

然后使用查找替换功能：
- `[Module]` → 实际模块名（首字母大写，如Role）
- `[module]` → 实际模块名（首字母小写，如role）
- `[modules]` → 实际模块名复数（如roles）
- `[endpoint]` → API端点（如/roles）

### 9. 集成检查清单

- [ ] 类型定义文件创建完成
- [ ] Service类继承自BaseApiService
- [ ] 所有方法返回统一格式
- [ ] Redux Slice创建完成
- [ ] 在store/index.ts中注册新的reducer
- [ ] 错误处理正确
- [ ] TypeScript编译通过
- [ ] 基本CRUD功能测试通过

### 10. 注意事项

1. **不要修改BaseApiService**：所有通用功能应该在基类中实现
2. **保持一致性**：新模块应该与现有模块保持一致的代码风格
3. **类型安全**：充分利用TypeScript的类型系统
4. **错误处理**：确保所有异常都被正确处理
5. **性能考虑**：避免不必要的API调用

## 附录：完整示例代码

完整的角色管理模块代码请参考：
- Service类：`frontend/src/services/api/RoleApiService.ts`
- 类型定义：`frontend/src/services/types/role.ts`
- Redux Slice：`frontend/src/store/roleSlice.ts`

遵循本规范，您可以快速、高效地添加新的API模块，同时保证代码质量和一致性。