# 下次会话提示词

我正在进行运维堡垒机系统的命令审计功能调整。项目路径：`/Users/skip/workspace/bastion`

## 当前进度
已完成了大部分功能实现，包括：
1. 只记录命令过滤中匹配的命令（已完成）
2. 会话ID点击播放录屏功能（已完成）
3. 界面调整：日期时间改为执行时间，添加指令类型列（已完成）
4. 删除操作栏和详情功能（已完成）
5. 批量删除功能前端和后端控制器已实现（90%完成）

## 下一步任务
需要在 `backend/services/audit_service.go` 中实现 `BatchDeleteCommandLogs` 方法来完成批量删除功能。

参考实现（参考同文件中的 `BatchDeleteOperationLogs` 方法）：
```go
func (a *AuditService) BatchDeleteCommandLogs(ids []uint, username, ip, reason string) error {
    // 1. 记录删除操作到操作日志
    // 2. 执行批量删除命令日志
    // 3. 返回错误信息
}
```

## 技术信息
- 后端：Go + Gin框架
- 前端：React + TypeScript + Ant Design
- 数据库：MySQL
- 命令日志表：command_logs
- 模型定义：models.CommandLog

## 相关文件
- 进度文档：`.specs/命令审计功能调整/progress.md`
- 需求文档：`.specs/命令审计功能调整/requirements.md`
- 设计文档：`.specs/命令审计功能调整/design.md`
- 任务文档：`.specs/命令审计功能调整/tasks.md`

请帮我完成 BatchDeleteCommandLogs 方法的实现，然后进行完整的功能测试。