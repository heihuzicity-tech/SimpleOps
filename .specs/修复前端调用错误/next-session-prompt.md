# 下次会话提示词

## 当前状态
我们正在进行前端API响应格式统一化改造，使用 BaseApiService 统一处理所有API响应格式。

## 已完成工作
1. ✅ 创建了 BaseApiService 基类，实现响应格式转换
2. ✅ 迁移了 UserApiService（用户管理）
3. ✅ 迁移了 AuthApiService（认证）
4. ✅ 迁移了 AuditApiService（审计日志）
5. ✅ 修复了组件使用统一的 items 字段
6. ✅ 优化了 BaseApiService 只对分页数据进行转换

## 当前问题
**严重问题：后端 /profile 接口未返回用户角色信息**
- 影响：用户登录后菜单无法正常显示，权限判断失败
- 详情：见 `.specs/修复前端调用错误/issues/profile-api-missing-roles.md`

## 下一步任务
1. **【紧急】修复后端 /profile 接口**
   - 确保返回用户的 roles 数组
   - 测试权限系统恢复正常
   
2. **继续迁移其他模块**
   - 资产管理 (AssetApiService)
   - 凭证管理 (CredentialApiService)
   - SSH会话 (SSHApiService)
   - 角色管理 (RoleApiService)

3. **清理工作**
   - 删除 responseAdapter.ts
   - 删除旧的 API 文件
   - 更新文档

## 重要原则
1. **坚持统一架构**：所有组件必须使用 `items` 字段访问列表数据
2. **不做特殊处理**：不为特殊情况破坏统一性
3. **渐进但彻底**：每个模块迁移必须完整

## 参考文档
- 架构规范：`frontend/docs/api-response-unification-guide.md`
- 任务列表：`.specs/修复前端调用错误/tasks.md`
- 进度记录：`.specs/修复前端调用错误/progress.md`

## 提示词示例
```
我需要继续进行前端API响应格式统一化改造。当前有一个紧急问题需要解决：
后端 /profile 接口没有返回用户的 roles 信息，导致前端权限系统失效。
请先帮我检查并修复这个问题，然后继续迁移剩余的API模块。

工作目录：/Users/skip/workspace/bastion
相关文档在：.specs/修复前端调用错误/
```