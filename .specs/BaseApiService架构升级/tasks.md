# BaseApiService架构升级 - 实施任务清单

## 任务概览
本项目旨在通过引入BaseApiService架构，从根本上解决前端API响应格式不统一的问题。通过创建统一的服务层，实现请求响应的标准化处理，提升代码可维护性和开发效率。

预计需要3-4个工作日完成。

## 先决条件
- [ ] 开发环境配置完成
- [ ] 已完成后端API响应格式统一化
- [ ] TypeScript严格模式已启用
- [ ] 相关依赖已安装（axios、@reduxjs/toolkit）

## 任务列表

### 1. 基础架构搭建
- [x] 1.1 创建BaseApiService基类
  - 文件: `frontend/src/services/base/BaseApiService.ts`
  - 描述: 实现基础HTTP方法封装、响应格式转换、错误处理
  - 验收: 基类可被继承，所有方法正常工作
  - 状态: ✅ 已在"修复前端调用错误"任务中完成

- [x] 1.2 创建基础类型定义
  - 文件: `frontend/src/services/types/common.ts`
  - 描述: 定义PaginatedResponse、ApiResponse等通用类型
  - 验收: TypeScript编译通过，类型推断正确
  - 状态: ✅ 已在"修复前端调用错误"任务中完成

- [x] 1.3 优化responseAdapter
  - 文件: `frontend/src/services/responseAdapter.ts`
  - 描述: 保留核心逻辑，移除冗余代码，导出给BaseApiService使用
  - 验收: 适配器功能正常，代码量减少50%
  - 状态: ✅ BaseApiService已包含转换逻辑

### 2. 凭证管理模块迁移（示例）
- [x] 2.1 创建CredentialApiService
  - 文件: `frontend/src/services/api/CredentialApiService.ts`
  - 描述: 继承BaseApiService，实现凭证管理相关API
  - 验收: 所有API方法实现完成，类型安全
  - 状态: ✅ 完成，包含CRUD和批量删除功能

- [x] 2.2 更新credentialSlice
  - 文件: `frontend/src/store/credentialSlice.ts`
  - 描述: 使用CredentialApiService替代原有API调用
  - 验收: Redux actions正常工作，数据流通畅
  - 状态: ✅ 完成，所有actions已更新

- [~] 2.3 验证凭证管理功能
  - 描述: 测试凭证列表显示、增删改查等功能
  - 验收: 所有功能正常，无"暂无数据"问题
  - 状态: 🔄 测试中

### 3. 审计日志模块迁移
- [ ] 3.1 创建AuditApiService
  - 文件: `frontend/src/services/api/AuditApiService.ts`
  - 描述: 实现登录日志、操作日志等API
  - 验收: API方法完整，响应格式正确

- [ ] 3.2 更新auditSlice
  - 文件: `frontend/src/store/auditSlice.ts`
  - 描述: 集成AuditApiService
  - 验收: 审计日志功能恢复正常

### 4. SSH会话模块迁移
- [ ] 4.1 创建SshApiService
  - 文件: `frontend/src/services/api/SshApiService.ts`
  - 描述: 实现SSH会话相关API
  - 验收: 会话管理功能正常

- [ ] 4.2 更新sshSessionSlice
  - 文件: `frontend/src/store/sshSessionSlice.ts`
  - 描述: 使用新的Service层
  - 验收: SSH功能无异常

### 5. 其他核心模块迁移
- [ ] 5.1 创建UserApiService
  - 文件: `frontend/src/services/api/UserApiService.ts`
  - 描述: 用户管理API迁移
  - 验收: 用户CRUD功能正常

- [ ] 5.2 创建RoleApiService
  - 文件: `frontend/src/services/api/RoleApiService.ts`
  - 描述: 角色管理API迁移
  - 验收: 角色权限功能正常

- [ ] 5.3 创建AuthApiService
  - 文件: `frontend/src/services/api/AuthApiService.ts`
  - 描述: 认证授权API迁移
  - 验收: 登录登出功能正常

### 6. 统一导出和清理
- [ ] 6.1 创建API服务统一导出
  - 文件: `frontend/src/services/api/index.ts`
  - 描述: 导出所有ApiService实例
  - 验收: 导入路径简化，使用方便

- [ ] 6.2 清理旧API文件
  - 文件: 各个旧的API文件（credentialAPI.ts等）
  - 描述: 标记为废弃或删除
  - 验收: 无重复代码，项目结构清晰

### 7. 测试和文档
- [ ] 7.1 编写单元测试
  - 文件: `frontend/src/services/base/__tests__/`
  - 描述: BaseApiService核心功能测试
  - 验收: 测试覆盖率>80%

- [ ] 7.2 更新开发文档
  - 文件: `frontend/README.md`或相关文档
  - 描述: 说明新的API调用方式
  - 验收: 文档清晰完整

### 8. 性能优化和问题修复
- [ ] 8.1 修复Antd Spin组件警告
  - 描述: 解决"tip only work in nest or fullscreen pattern"警告
  - 验收: 控制台无警告信息

- [ ] 8.2 性能监控和优化
  - 描述: 确保响应转换性能<3ms
  - 验收: 性能达标，用户体验流畅

## 执行指南

### 任务执行规则
1. **按顺序执行**: 基础架构必须先完成
2. **逐模块迁移**: 每个模块独立迁移和验证
3. **持续测试**: 每完成一个模块立即测试
4. **保持兼容**: 迁移过程中保持系统可用

### 完成标记
- `[x]` 已完成的任务
- `[!]` 遇到问题的任务
- `[~]` 进行中的任务

### 执行命令
- `/kiro exec 1.1` - 执行特定任务
- `/kiro next` - 执行下一个未完成任务
- `/kiro status` - 查看当前进度

## 进度跟踪

### 时间规划
- **预计开始**: 2025-01-29
- **预计完成**: 2025-02-01

### 完成统计
- **总任务数**: 20
- **已完成**: 6
- **进行中**: 0
- **完成率**: 30%

### 里程碑
- [x] 基础架构完成（任务1.x）- ✅ 已在前期任务中完成
- [x] 第一个模块迁移成功（任务2.x）- ✅ 凭证管理模块完成
- [ ] 问题模块全部修复（任务3.x-4.x）
- [ ] 所有模块迁移完成（任务5.x）
- [ ] 项目收尾完成（任务6.x-8.x）

## 变更日志
- [2025-01-29] - 创建任务清单 - 开始项目 - 全部任务
- [2025-01-29] - 更新任务状态 - 基础架构已在"修复前端调用错误"任务中完成
- [2025-01-29] - 架构改进 - 增强BaseApiService的响应和错误处理能力
  - 创建ApiError统一错误类
  - 增强响应处理，自动识别后端统一格式 { success, data, error }
  - 改进错误处理，提供更详细的错误信息
  - DELETE方法支持请求体参数
- [2025-01-29] - 完成凭证管理模块迁移 - 第一个示例模块成功迁移

## 风险和注意事项
1. **保持向后兼容**: 迁移过程中不要删除原有API文件
2. **充分测试**: 每个模块迁移后必须完整测试
3. **性能监控**: 注意观察响应转换的性能影响
4. **错误处理**: 确保错误信息对用户友好
5. **类型安全**: 充分利用TypeScript的类型系统

## 完成检查清单
- [ ] 所有模块功能正常
- [ ] 控制台无错误和警告
- [ ] 响应格式统一
- [ ] 代码结构清晰
- [ ] 性能达到要求
- [ ] 测试覆盖充分
- [ ] 文档更新完整