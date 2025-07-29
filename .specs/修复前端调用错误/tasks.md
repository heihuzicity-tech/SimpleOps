# 修复前端调用错误 - 实施任务

## 任务概览
本次重构采用渐进式架构升级方案，通过创建轻量级BaseApiService基类来统一处理API响应格式。遵循"开发一个、测试一个、通过后继续"的原则，确保每个环节稳定可靠。

## 前置条件
- [ ] 开发环境正常运行
- [ ] 前端服务可正常启动（npm start）
- [ ] 后端API服务正常（端口8080）
- [ ] 测试用户账号可用

## 任务列表

### 1. 基础设施建设
- [x] 1.1 创建BaseApiService基类
  - 文件：`frontend/src/services/base/BaseApiService.ts`
  - 描述：创建基础Service类，实现通用HTTP方法和响应转换逻辑
  - 验收：
    - TypeScript编译通过 ✅
    - 包含get/post/put/delete方法 ✅
    - 实现transformResponse响应转换 ✅
    - 实现unifyPaginatedData字段映射 ✅

- [x] 1.2 创建通用类型定义
  - 文件：`frontend/src/services/types/common.ts`
  - 描述：定义PaginatedResult等通用接口
  - 验收：
    - 定义PaginatedResult接口 ✅
    - 导出类型供其他模块使用 ✅

- [x] 1.3 编写BaseApiService单元测试
  - 文件：`frontend/src/services/base/BaseApiService.test.ts`
  - 描述：测试响应转换逻辑的各种场景
  - 验收：
    - 测试users→items转换 ✅
    - 测试嵌套data.data处理 ✅
    - 测试pagination字段处理 ✅
    - 所有测试用例通过 ✅ (18个测试全部通过)

### 2. 用户模块迁移（验证方案）
- [ ] 2.1 创建UserApiService类
  - 文件：`frontend/src/services/api/UserApiService.ts`
  - 描述：继承BaseApiService，实现用户相关API
  - 验收：
    - 保持原有接口不变
    - 所有方法返回统一格式
    - TypeScript类型正确

- [ ] 2.2 在userSlice中集成测试
  - 文件：`frontend/src/store/userSlice.ts`
  - 描述：修改fetchUsers使用新的UserApiService
  - 验收：
    - 保留原代码注释备份
    - 新代码正常获取数据
    - 不再使用responseAdapter

- [ ] 2.3 用户管理页面功能测试
  - 测试页面：用户管理
  - 描述：测试用户列表、新增、编辑、删除功能
  - 验收：
    - 用户列表正常显示
    - 分页功能正常
    - CRUD操作全部成功
    - 控制台无错误

- [ ] 2.4 对比测试新旧实现
  - 描述：确保新实现与旧实现行为一致
  - 验收：
    - 数据格式完全一致
    - 性能无明显差异
    - 功能完全正常

### 3. 认证模块迁移
- [ ] 3.1 创建AuthApiService类
  - 文件：`frontend/src/services/api/AuthApiService.ts`
  - 描述：处理登录、登出、token刷新等认证API
  - 验收：
    - 继承BaseApiService
    - 实现login/logout方法
    - 处理token相关逻辑

- [ ] 3.2 更新authSlice
  - 文件：`frontend/src/store/authSlice.ts`
  - 描述：使用新的AuthApiService
  - 验收：
    - 登录功能正常
    - 登出功能正常
    - Token自动刷新正常

- [ ] 3.3 登录流程测试
  - 描述：完整测试认证流程
  - 验收：
    - 登录成功跳转正确
    - 错误提示正确显示
    - Token存储正确
    - 401自动跳转登录页

### 4. 审计模块迁移
- [ ] 4.1 创建AuditApiService类
  - 文件：`frontend/src/services/api/AuditApiService.ts`
  - 描述：处理审计日志相关API
  - 验收：
    - 支持登录日志查询
    - 支持操作日志查询
    - 支持会话记录查询
    - 字段映射正确（logs→items）

- [ ] 4.2 创建审计相关Redux slice
  - 文件：查找或创建审计相关的slice
  - 描述：集成AuditApiService
  - 验收：
    - 数据获取正常
    - 分页功能正常

- [ ] 4.3 审计功能测试
  - 测试页面：审计日志页面
  - 描述：测试各类日志查询功能
  - 验收：
    - 登录日志显示正常
    - 操作日志显示正常
    - 搜索过滤功能正常

### 5. 其他模块迁移
- [ ] 5.1 创建CredentialApiService
  - 文件：`frontend/src/services/api/CredentialApiService.ts`
  - 描述：凭证管理API
  - 验收：
    - CRUD功能完整
    - 类型定义正确

- [ ] 5.2 创建SessionApiService
  - 文件：`frontend/src/services/api/SessionApiService.ts`
  - 描述：SSH会话管理API
  - 验收：
    - 会话列表功能
    - 会话控制功能

- [ ] 5.3 更新对应的Redux slices
  - 文件：credentialSlice.ts, sshSessionSlice.ts
  - 描述：使用新的Service类
  - 验收：
    - 功能正常
    - 无console错误

- [ ] 5.4 功能回归测试
  - 描述：测试所有已迁移模块
  - 验收：
    - 所有功能正常
    - 性能无退化

### 6. 清理和优化
- [ ] 6.1 删除responseAdapter.ts
  - 文件：`frontend/src/services/responseAdapter.ts`
  - 描述：确认无引用后删除
  - 验收：
    - 全局搜索确认无引用
    - 删除文件
    - 项目正常运行

- [ ] 6.2 删除旧API文件
  - 文件：userAPI.ts等旧文件
  - 描述：逐个删除已迁移的旧API文件
  - 验收：
    - 确认无引用
    - 删除后功能正常

- [ ] 6.3 优化BaseApiService
  - 文件：`frontend/src/services/base/BaseApiService.ts`
  - 描述：根据使用情况优化代码
  - 验收：
    - 移除未使用的代码
    - 添加必要的注释
    - 性能优化

- [ ] 6.4 更新项目文档
  - 文件：README.md或开发文档
  - 描述：记录新的API架构
  - 验收：
    - 文档清晰
    - 示例代码正确

- [ ] 6.5 创建API开发规范文档
  - 文件：`frontend/docs/api-development-guide.md`
  - 描述：为后续新功能开发提供标准化指南
  - 验收：
    - 包含新增API模块的步骤
    - 包含Service类的编写规范
    - 包含Redux集成指南
    - 包含完整的代码示例
    - 包含测试要求

- [ ] 6.6 创建快速开发模板
  - 文件：`frontend/templates/`
  - 描述：创建可复用的代码模板
  - 验收：
    - ApiService模板文件
    - Redux Slice模板文件
    - 类型定义模板文件
    - 使用说明文档

### 7. 全面测试验证
- [ ] 7.0 验证开发规范文档
  - 描述：按照新编写的规范文档，模拟新增一个API模块
  - 验收：
    - 按照文档步骤操作顺利
    - 模板代码可直接使用
    - 5分钟内完成新模块创建
    - 新模块功能正常
- [ ] 7.1 端到端功能测试
  - 描述：完整测试所有管理功能
  - 验收：
    - 用户管理完整流程
    - 角色权限管理
    - 资产管理功能
    - 审计日志查询
    - SSH会话管理

- [ ] 7.2 性能测试
  - 描述：对比迁移前后的性能
  - 验收：
    - 页面加载时间相当
    - API响应时间正常
    - 内存使用无明显增加

- [ ] 7.3 异常情况测试
  - 描述：测试错误处理
  - 验收：
    - 网络断开提示正确
    - 401自动跳转
    - 错误信息显示友好

## 执行指南
### 任务执行原则
1. **严格按序执行**：必须完成当前任务测试后才能进行下一个
2. **测试驱动**：每个任务都包含明确的验收标准
3. **及时回退**：发现问题立即停止，分析原因
4. **保留备份**：修改前注释保留原代码

### 任务标记说明
- `[ ]` 待执行任务
- `[x]` 已完成任务
- `[!]` 存在问题的任务
- `[~]` 正在执行的任务

### 执行命令
- `/kiro exec 1.1` - 执行指定任务
- `/kiro next` - 执行下一个未完成任务
- `/kiro fix [问题描述]` - 修复问题并更新任务状态

## 进度追踪
### 时间规划
- **预计开始**：2025-07-29
- **预计完成**：2025-08-05

### 完成统计
- **总任务数**：28
- **已完成**：3
- **进行中**：0
- **完成率**：10.7%

### 里程碑
- [x] 基础设施完成（任务1.x）- 第1天 ✅
- [ ] 用户模块验证（任务2.x）- 第2天
- [ ] 核心模块迁移（任务3-4.x）- 第3-4天
- [ ] 全部模块迁移（任务5.x）- 第5天
- [ ] 清理优化完成（任务6.x）- 第6天
- [ ] 开发规范完成（任务6.5-6.6）- 第6天
- [ ] 测试验收通过（任务7.x）- 第7天

## 风险和注意事项
1. **向后兼容**：新旧代码要能共存，便于对比和回退
2. **保留原代码**：通过注释保留，不要直接删除
3. **充分测试**：每个模块都要经过完整的功能测试
4. **性能监控**：注意对比迁移前后的性能差异
5. **错误处理**：确保错误信息正确显示给用户

## 变更记录
- [2025-07-29] - 创建任务文档 - 制定渐进式迁移计划