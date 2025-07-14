# SSH会话管理修复验证指南

## 修复内容概览

### 1. ✅ 修复WebSocket断开时不清理SSH会话的问题
**文件**: `controllers/ssh_controller.go`
**修复内容**:
- 在WebSocket连接关闭时立即清理对应的SSH会话
- 添加详细的日志记录和错误处理

### 2. ✅ 缩短会话超时时间配置
**文件**: `config/config.yaml`
**修复内容**:
- 会话超时时间从3600秒(1小时)缩短到900秒(15分钟)
- 监控会话超时时间从3600秒缩短到900秒
- 最大非活跃时间从1800秒缩短到600秒(10分钟)

### 3. ✅ 增加SSH连接健康检查机制
**文件**: `services/ssh_service.go`
**修复内容**:
- 新增`IsConnectionAlive()`方法检查SSH连接真实状态
- 增强`IsActive()`方法包含连接健康检查
- 优化`CleanupInactiveSessions()`支持连接状态检查
- 新增`HealthCheckSessions()`方法支持手动触发清理

### 4. ✅ 优化会话清理逻辑
**修复内容**:
- 清理间隔从5分钟缩短到2分钟
- 增加连接丢失检测机制
- 改进日志记录和审计追踪

### 5. ✅ 新增健康检查API接口
**文件**: `controllers/ssh_controller.go`, `routers/router.go`
**新增接口**: `POST /api/v1/ssh/sessions/health-check`
**权限要求**: 管理员权限

## 验证步骤

### 步骤1: 启动服务
```bash
cd /Users/skip/workspace/bastion/backend
./bastion
```

### 步骤2: 创建SSH会话
```bash
# 1. 先登录获取token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# 2. 创建SSH会话
curl -X POST http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_id":1,"credential_id":1,"protocol":"ssh"}'
```

### 步骤3: 测试WebSocket断开清理
```bash
# 1. 建立WebSocket连接到会话
# 2. 关闭WebSocket连接（关闭浏览器或断开网络）
# 3. 检查会话是否被立即清理

curl -X GET http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 步骤4: 测试手动健康检查
```bash
curl -X POST http://localhost:8080/api/v1/ssh/sessions/health-check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 步骤5: 测试自动清理机制
```bash
# 等待15分钟（新的超时时间），检查会话是否自动清理
# 或者等待2分钟，查看清理日志
```

## 预期结果

### WebSocket断开测试
- **修复前**: WebSocket断开后，SSH会话仍然存在于内存中，需要等待1小时才被清理
- **修复后**: WebSocket断开后，SSH会话立即被清理，日志显示清理原因

### 超时时间测试
- **修复前**: 会话需要1小时无活动才被清理
- **修复后**: 会话需要15分钟无活动就被清理

### 健康检查测试
- **修复前**: 无法检测SSH连接是否真实存活
- **修复后**: 能够检测并清理已断开但未正确关闭的SSH连接

### 自动清理测试
- **修复前**: 每5分钟检查一次，只检查超时
- **修复后**: 每2分钟检查一次，同时检查超时和连接状态

## 监控指标

### 日志关键词
- "WebSocket disconnected for session" - WebSocket断开清理
- "Cleaning up session" - 会话清理
- "Health check completed" - 健康检查完成
- "SSH session cleanup service started" - 清理服务启动

### 检查命令
```bash
# 查看SSH会话清理日志
tail -f logs/app.log | grep -E "(WebSocket disconnected|Cleaning up session|Health check)"

# 检查活跃会话数量
curl -X GET http://localhost:8080/api/v1/ssh/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data | length'

# 检查审计页面活跃会话统计
curl -X GET http://localhost:8080/api/v1/audit/active-sessions \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data.total'
```

## 问题排查

### 如果会话仍然不被清理
1. 检查配置文件是否生效: `grep -A 5 "session:" config/config.yaml`
2. 检查清理服务是否启动: 查找日志中的 "SSH session cleanup service started"
3. 手动触发健康检查: 调用健康检查API
4. 检查SSH连接状态: 查看 `IsConnectionAlive()` 的返回值

### 如果前端仍显示错误的会话数
1. 检查前端是否使用了正确的API端点
2. 确认前端没有缓存旧数据
3. 刷新浏览器或清除缓存
4. 检查WebSocket连接是否正常

## 性能影响评估

### 资源使用
- **CPU**: 健康检查会略微增加CPU使用，但影响很小
- **网络**: 每次健康检查会发送少量keepalive包
- **内存**: 清理及时会减少内存使用

### 响应时间
- **WebSocket断开**: 从原来的最长1小时延迟到立即清理
- **自动清理**: 从5分钟间隔缩短到2分钟间隔
- **连接检测**: 新增连接状态检测，提高准确性

## 长期监控建议

1. **设置告警**: 对异常的会话清理数量设置告警
2. **性能监控**: 监控健康检查的执行时间和资源使用
3. **日志分析**: 定期分析会话清理的原因分布
4. **用户反馈**: 收集用户对会话管理体验的反馈

通过这些修复，SSH会话管理问题应该得到根本解决，系统资源使用更加高效，用户体验也会得到显著改善。