# SSH终端性能优化测试套件

本测试套件用于验证SSH终端性能优化的效果，包括自动化测试和手动测试两部分。

## 快速开始

### 1. 环境准备
```bash
# 设置认证Token（从浏览器开发者工具获取）
export AUTH_TOKEN="your_jwt_token_here"

# 确保堡垒机系统正在运行
# 后端: http://localhost:8080
# 前端: http://localhost:3000
```

### 2. 运行自动化测试
```bash
# 执行所有测试（约20分钟）
./run_tests.sh

# 测试将按以下顺序执行：
# 1. 性能基准测试 (5分钟)
# 2. 高频输入测试 (2分钟)  
# 3. 压力测试 (10分钟)
```

### 3. 手动功能测试
打开 `compatibility_checklist.md`，按照清单逐项测试。

## 测试文件说明

### 自动化测试脚本
- `stress_test.go` - 压力测试，监控内存和资源使用
- `input_test.go` - 输入性能测试，验证输入聚合效果
- `benchmark_test.go` - 性能基准测试，量化各项指标
- `run_tests.sh` - 一键运行所有测试

### 测试文档
- `test-plan.md` - 完整的测试方案
- `compatibility_checklist.md` - 功能兼容性测试清单
- `performance_comparison_template.md` - 性能对比报告模板

## 测试结果

测试完成后，结果保存在 `test_results_[timestamp]/` 目录：
- `test_summary.md` - 测试汇总报告
- `*_output.log` - 各测试的控制台输出
- `*_results_*.json` - 详细的测试数据

## 获取认证Token

1. 打开浏览器，登录堡垒机系统
2. 打开开发者工具 (F12)
3. 在Network标签页找到任意API请求
4. 从请求头中复制Authorization字段的值（去掉"Bearer "前缀）

## 常见问题

### Q: 编译失败
A: 确保已安装Go 1.16+，并且在项目根目录执行

### Q: 连接WebSocket失败
A: 检查：
- 堡垒机后端是否运行在8080端口
- AUTH_TOKEN是否正确设置
- 测试主机ID是否存在（默认为1）

### Q: 测试时间太长
A: 可以修改测试脚本中的duration参数，或按Ctrl+C提前结束

## 性能目标验证

优化后应达到：
- ✅ 输入延迟 < 50ms
- ✅ 网络请求减少 90%
- ✅ 内存无泄漏
- ✅ 渲染流畅度 60fps

## 联系方式

如有问题，请查看：
- 设计文档: `.specs/ssh-terminal-optimization/design.md`
- 任务追踪: `.specs/ssh-terminal-optimization/tasks.md`