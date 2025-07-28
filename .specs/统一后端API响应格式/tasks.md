# 统一后端API响应格式 - 实施任务清单

## 任务概览
这是一次彻底的API响应格式重构和统一，目标是建立整个系统的统一响应标准，提升系统的可维护性和扩展性。

核心目标：
1. 后端API统一格式 - 建立标准化的响应规范
2. 前端对接后端API - 全面适配新的统一格式

预计需要3-4个工作日完成。

## 先决条件
- [x] 开发环境配置完成
- [x] 创建功能分支 feature/unified-api-response
- [x] 数据库已备份

## 任务列表

### 目标1: 后端API统一格式

#### 1.1 创建响应辅助函数
- [x] 创建 `backend/utils/response.go`
  - 文件: `backend/utils/response.go`
  - 描述: 实现 RespondWithPagination, RespondWithData, RespondWithSuccess, RespondWithError
  - 验收: 函数可正常调用，返回统一格式

#### 1.2 改造命令策略控制器
- [x] 统一命令策略控制器响应格式
  - 文件: `backend/controllers/command_policy_controller.go`
  - 描述: 使用响应辅助函数重构所有接口，建立标准化模板
  - 验收: 所有端点返回统一格式，可作为其他控制器的参考模板

#### 1.3 改造资产管理控制器
- [ ] 统一资产管理控制器响应格式
  - 文件: `backend/controllers/asset_controller.go`
  - 描述: 将 assets 改为 items，扁平化 pagination
  - 验收: GET /api/assets 返回统一格式

#### 1.4 改造其余控制器
- [ ] 批量改造剩余7个控制器
  - 文件: `user_controller.go`, `ssh_controller.go`, `audit_controller.go`, `monitor_controller.go`, `recording_controller.go`, `auth_controller.go`, `role_controller.go`
  - 描述: 统一所有分页和数据响应格式
  - 验收: 所有API返回格式一致

### 目标2: 前端对接后端API

#### 2.1 全面更新前端数据处理逻辑
- [ ] 更新所有使用分页数据的组件
  - 文件: 所有包含Table组件的文件（命令过滤、资产管理、用户管理、审计日志等）
  - 描述: 统一使用 response.data.items 获取数据列表
  - 验收: 所有模块的列表页面正常显示数据

#### 2.2 修改前端类型定义
- [ ] 统一前端响应类型
  - 文件: `frontend/src/types/index.ts`
  - 描述: 删除 CommandFilterPaginatedResponse，统一使用 PaginatedResponse
  - 验收: TypeScript编译通过

#### 2.3 修改前端服务层
- [ ] 更新API服务返回类型
  - 文件: `frontend/src/services/commandFilterService.ts`
  - 描述: 将所有 CommandFilterPaginatedResponse 改为 PaginatedResponse
  - 验收: 服务层类型正确

#### 2.4 全面测试验证
- [ ] 验证所有模块功能
  - 描述: 系统性测试所有模块的增删改查功能
  - 验收: 所有模块功能正常，API响应格式一致，无数据显示异常

## 执行指南

### 执行顺序
1. 先完成后端API统一（目标1）
2. 再进行前端对接（目标2）
3. 后端改一个，前端跟进测试一个

### 执行命令
- `/kiro exec 1.1` - 开始创建响应辅助函数
- `/kiro next` - 执行下一个任务

## 进度跟踪

### 时间规划
- **预计开始**: 2025-01-28
- **预计完成**: 2025-01-30

### 完成统计
- **总任务数**: 8
- **已完成**: 0
- **进行中**: 0
- **完成率**: 0%

### 里程碑
- [ ] 响应辅助函数完成（1.1）
- [ ] 命令策略控制器改造完成（1.2）
- [ ] 后端API格式统一完成（目标1）
- [ ] 前端对接完成（目标2）

## 变更日志
- [2024-01-28] - 创建任务清单 - 开始项目 - 全部任务