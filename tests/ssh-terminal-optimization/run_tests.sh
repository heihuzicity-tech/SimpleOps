#!/bin/bash

# SSH终端性能优化测试脚本

echo "=== SSH终端性能优化集成测试 ==="
echo "开始时间: $(date)"
echo ""

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境变量
if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}错误: 请设置AUTH_TOKEN环境变量${NC}"
    echo "使用方法: export AUTH_TOKEN=your_token_here"
    exit 1
fi

# 创建结果目录
RESULTS_DIR="test_results_$(date +%Y%m%d_%H%M%S)"
mkdir -p $RESULTS_DIR

echo -e "${YELLOW}创建测试结果目录: $RESULTS_DIR${NC}"
echo ""

# 编译测试程序
echo -e "${YELLOW}编译测试程序...${NC}"
go build -o stress_test stress_test.go
go build -o input_test input_test.go
go build -o benchmark_test benchmark_test.go

if [ $? -ne 0 ]; then
    echo -e "${RED}编译失败${NC}"
    exit 1
fi

echo -e "${GREEN}编译成功${NC}"
echo ""

# 运行测试
run_test() {
    local test_name=$1
    local test_binary=$2
    local test_duration=$3
    
    echo -e "${YELLOW}运行测试: $test_name${NC}"
    echo "预计时长: $test_duration"
    
    ./$test_binary > $RESULTS_DIR/${test_name}_output.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name 完成${NC}"
        # 移动结果文件
        mv *_results_*.json $RESULTS_DIR/ 2>/dev/null
    else
        echo -e "${RED}✗ $test_name 失败${NC}"
        echo "查看日志: $RESULTS_DIR/${test_name}_output.log"
    fi
    echo ""
}

# 1. 性能基准测试（建立基线）
echo -e "${YELLOW}=== 阶段1: 性能基准测试 ===${NC}"
run_test "benchmark" "benchmark_test" "5分钟"

# 2. 高频输入测试
echo -e "${YELLOW}=== 阶段2: 高频输入测试 ===${NC}"
run_test "input" "input_test" "2分钟"

# 3. 短时间压力测试
echo -e "${YELLOW}=== 阶段3: 压力测试 ===${NC}"
echo "注意: 可以按Ctrl+C提前结束压力测试"
# 修改压力测试为10分钟
sed -i.bak 's/duration := 30 \* time.Minute/duration := 10 \* time.Minute/' stress_test.go
go build -o stress_test stress_test.go
run_test "stress" "stress_test" "10分钟"

# 4. 生成测试报告
echo -e "${YELLOW}=== 生成测试报告 ===${NC}"
cat > $RESULTS_DIR/test_summary.md << EOF
# SSH终端性能优化测试报告

测试时间: $(date)
测试目录: $RESULTS_DIR

## 测试结果汇总

### 1. 性能基准测试
$(grep -A 20 "=== 性能基准测试报告 ===" $RESULTS_DIR/benchmark_output.log 2>/dev/null || echo "未找到测试结果")

### 2. 高频输入测试
$(grep -A 10 "=== 高频输入测试报告 ===" $RESULTS_DIR/input_output.log 2>/dev/null || echo "未找到测试结果")

### 3. 压力测试
$(grep -A 15 "=== 压力测试报告 ===" $RESULTS_DIR/stress_output.log 2>/dev/null || echo "未找到测试结果")

## 详细结果文件
- benchmark_results_*.json - 性能基准详细数据
- input_test_results_*.json - 输入测试详细数据
- stress_test_results_*.json - 压力测试详细数据

## 功能兼容性测试
请参考 compatibility_checklist.md 进行手动测试
EOF

echo -e "${GREEN}测试报告已生成: $RESULTS_DIR/test_summary.md${NC}"

# 清理
rm -f stress_test input_test benchmark_test stress_test.go.bak

echo ""
echo -e "${GREEN}=== 测试完成 ===${NC}"
echo "结果目录: $RESULTS_DIR"
echo ""
echo "下一步:"
echo "1. 查看测试报告: cat $RESULTS_DIR/test_summary.md"
echo "2. 执行功能兼容性测试: 参考 compatibility_checklist.md"
echo "3. 分析详细数据: 查看 $RESULTS_DIR/*.json 文件"