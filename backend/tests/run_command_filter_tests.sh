#!/bin/bash

# 命令过滤功能集成测试执行脚本
# 作者: AI Test Automation Expert
# 日期: 2025-07-30

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 输出带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要工具
check_prerequisites() {
    print_info "检查测试环境..."
    
    # 检查Go版本
    if ! command -v go &> /dev/null; then
        print_error "Go 未安装或不在PATH中"
        exit 1
    fi
    
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    print_info "Go版本: $GO_VERSION"
    
    # 检查项目根目录
    if [ ! -f "go.mod" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查测试文件
    if [ ! -f "tests/command_filter_integration_test.go" ]; then
        print_error "集成测试文件不存在: tests/command_filter_integration_test.go"
        exit 1
    fi
    
    print_success "环境检查通过"
}

# 设置测试环境
setup_test_env() {
    print_info "设置测试环境..."
    
    # 创建测试结果目录
    mkdir -p tests/results
    
    # 设置测试环境变量
    export GO_ENV=test
    export TEST_DB_URL="mysql://root:password@localhost:3306/bastion_test"
    
    # 清理之前的测试结果
    rm -f tests/results/*
    
    print_success "测试环境设置完成"
}

# 运行基础功能测试
run_basic_tests() {
    print_info "运行基础功能测试..."
    
    # 命令组CRUD测试
    print_info "测试命令组管理功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestCommandGroupCRUD \
        > tests/results/command_group_crud.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "命令组管理测试通过"
    else
        print_error "命令组管理测试失败"
        return 1
    fi
    
    # 过滤规则CRUD测试
    print_info "测试过滤规则管理功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestCommandFilterCRUD \
        > tests/results/command_filter_crud.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "过滤规则管理测试通过"
    else
        print_error "过滤规则管理测试失败"
        return 1
    fi
    
    return 0
}

# 运行命令匹配测试
run_matching_tests() {
    print_info "运行命令匹配测试..."
    
    # 精确匹配测试
    print_info "测试精确匹配功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestCommandMatchingExact \
        > tests/results/exact_matching.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "精确匹配测试通过"
    else
        print_error "精确匹配测试失败"
        return 1
    fi
    
    # 正则匹配测试
    print_info "测试正则表达式匹配功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestCommandMatchingRegex \
        > tests/results/regex_matching.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "正则匹配测试通过"
    else
        print_error "正则匹配测试失败"
        return 1
    fi
    
    return 0
}

# 运行高级功能测试
run_advanced_tests() {
    print_info "运行高级功能测试..."
    
    # 优先级测试
    print_info "测试规则优先级功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestFilterPriority \
        > tests/results/priority.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "优先级测试通过"
    else
        print_error "优先级测试失败"
        return 1
    fi
    
    # 属性过滤测试
    print_info "测试属性过滤功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestFilterByUserAttribute \
        > tests/results/user_attribute.log 2>&1
    
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestFilterByAssetAttribute \
        > tests/results/asset_attribute.log 2>&1
    
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestFilterBySpecificAccount \
        > tests/results/specific_account.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "属性过滤测试通过"
    else
        print_error "属性过滤测试失败"
        return 1
    fi
    
    return 0
}

# 运行复杂场景测试
run_complex_tests() {
    print_info "运行复杂场景测试..."
    
    # 复杂组合场景
    print_info "测试复杂组合场景..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestComplexScenario \
        > tests/results/complex_scenario.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "复杂场景测试通过"
    else
        print_error "复杂场景测试失败"
        return 1
    fi
    
    # 日志记录测试
    print_info "测试日志记录功能..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestCommandFilterLogging \
        > tests/results/logging.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "日志记录测试通过"
    else
        print_error "日志记录测试失败"
        return 1
    fi
    
    return 0
}

# 运行性能测试
run_performance_tests() {
    print_info "运行性能测试..."
    
    # 性能基准测试
    print_info "执行性能基准测试..."
    go test -v ./tests/command_filter_integration_test.go -run TestCommandFilterIntegrationTestSuite/TestPerformance \
        > tests/results/performance.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "性能测试通过"
        
        # 提取性能数据
        if grep -q "Performance test:" tests/results/performance.log; then
            PERF_RESULT=$(grep "Performance test:" tests/results/performance.log | head -1)
            print_info "性能结果: $PERF_RESULT"
        fi
    else
        print_error "性能测试失败"
        return 1
    fi
    
    return 0
}

# 运行完整测试套件
run_full_test_suite() {
    print_info "运行完整集成测试套件..."
    
    # 生成覆盖率报告
    print_info "生成测试覆盖率报告..."
    go test -v ./tests/command_filter_integration_test.go \
        -coverprofile=tests/results/coverage.out \
        -covermode=atomic \
        > tests/results/full_test.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "完整测试套件执行成功"
        
        # 生成HTML覆盖率报告
        if [ -f "tests/results/coverage.out" ]; then
            go tool cover -html=tests/results/coverage.out -o tests/results/coverage.html
            print_success "覆盖率报告生成: tests/results/coverage.html"
            
            # 显示覆盖率统计
            COVERAGE=$(go tool cover -func=tests/results/coverage.out | grep "total:" | awk '{print $3}')
            print_info "总体代码覆盖率: $COVERAGE"
        fi
    else
        print_error "完整测试套件执行失败"
        return 1
    fi
    
    return 0
}

# 生成测试报告
generate_test_report() {
    print_info "生成测试报告..."
    
    REPORT_FILE="tests/results/test_execution_report.md"
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$REPORT_FILE" << EOF
# 命令过滤功能集成测试执行报告

**生成时间**: $TIMESTAMP  
**执行环境**: $(uname -s) $(uname -r)  
**Go版本**: $(go version | awk '{print $3}')  

## 测试执行概况

EOF
    
    # 统计测试结果
    TOTAL_TESTS=0
    PASSED_TESTS=0
    FAILED_TESTS=0
    
    for log_file in tests/results/*.log; do
        if [ -f "$log_file" ]; then
            TEST_NAME=$(basename "$log_file" .log)
            if grep -q "PASS" "$log_file" && ! grep -q "FAIL" "$log_file"; then
                echo "- ✅ $TEST_NAME" >> "$REPORT_FILE"
                ((PASSED_TESTS++))
            else
                echo "- ❌ $TEST_NAME" >> "$REPORT_FILE"
                ((FAILED_TESTS++))
            fi
            ((TOTAL_TESTS++))
        fi
    done
    
    cat >> "$REPORT_FILE" << EOF

## 测试统计

| 项目 | 数量 |
|------|------|
| 总测试数 | $TOTAL_TESTS |
| 通过测试 | $PASSED_TESTS |
| 失败测试 | $FAILED_TESTS |
| 成功率 | $((PASSED_TESTS * 100 / TOTAL_TESTS))% |

EOF
    
    # 添加覆盖率信息
    if [ -f "tests/results/coverage.out" ]; then
        COVERAGE=$(go tool cover -func=tests/results/coverage.out | grep "total:" | awk '{print $3}')
        echo "**代码覆盖率**: $COVERAGE" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

## 详细日志

详细的测试执行日志请查看 tests/results/ 目录下的各个 .log 文件。

---
*报告自动生成于 $TIMESTAMP*
EOF
    
    print_success "测试报告已生成: $REPORT_FILE"
}

# 清理测试环境
cleanup() {
    print_info "清理测试环境..."
    
    # 清理临时文件
    # rm -f tests/results/*.tmp
    
    print_success "清理完成"
}

# 显示帮助信息
show_help() {
    echo "命令过滤功能集成测试执行脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -a, --all         运行所有测试（默认）"
    echo "  -b, --basic       仅运行基础功能测试"
    echo "  -m, --matching    仅运行命令匹配测试"
    echo "  -d, --advanced    仅运行高级功能测试"
    echo "  -c, --complex     仅运行复杂场景测试"
    echo "  -p, --performance 仅运行性能测试"
    echo "  -f, --full        运行完整测试套件（包含覆盖率）"
    echo "  -r, --report      仅生成测试报告"
    echo "  -h, --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 -a                # 运行所有测试"
    echo "  $0 -b -m             # 运行基础功能和匹配测试"
    echo "  $0 -f                # 运行完整测试套件"
    echo ""
}

# 主函数
main() {
    local run_basic=false
    local run_matching=false
    local run_advanced=false
    local run_complex=false
    local run_performance=false
    local run_full=false
    local run_all=false
    local generate_report=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -a|--all)
                run_all=true
                shift
                ;;
            -b|--basic)
                run_basic=true
                shift
                ;;
            -m|--matching)
                run_matching=true
                shift
                ;;
            -d|--advanced)
                run_advanced=true
                shift
                ;;
            -c|--complex)
                run_complex=true
                shift
                ;;
            -p|--performance)
                run_performance=true
                shift
                ;;
            -f|--full)
                run_full=true
                shift
                ;;
            -r|--report)
                generate_report=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 如果没有指定任何选项，默认运行所有测试
    if [ "$run_basic" = false ] && [ "$run_matching" = false ] && [ "$run_advanced" = false ] && \
       [ "$run_complex" = false ] && [ "$run_performance" = false ] && [ "$run_full" = false ] && \
       [ "$generate_report" = false ]; then
        run_all=true
    fi
    
    # 检查环境
    check_prerequisites
    
    # 设置测试环境
    setup_test_env
    
    # 执行测试
    local exit_code=0
    
    if [ "$run_all" = true ] || [ "$run_full" = true ]; then
        if ! run_full_test_suite; then
            exit_code=1
        fi
    else
        if [ "$run_basic" = true ]; then
            if ! run_basic_tests; then
                exit_code=1
            fi
        fi
        
        if [ "$run_matching" = true ]; then
            if ! run_matching_tests; then
                exit_code=1
            fi
        fi
        
        if [ "$run_advanced" = true ]; then
            if ! run_advanced_tests; then
                exit_code=1
            fi
        fi
        
        if [ "$run_complex" = true ]; then
            if ! run_complex_tests; then
                exit_code=1
            fi
        fi
        
        if [ "$run_performance" = true ]; then
            if ! run_performance_tests; then
                exit_code=1
            fi
        fi
    fi
    
    # 生成测试报告
    if [ "$generate_report" = true ] || [ "$run_all" = true ] || [ "$run_full" = true ]; then
        generate_test_report
    fi
    
    # 清理环境
    cleanup
    
    # 显示总结
    if [ $exit_code -eq 0 ]; then
        print_success "所有测试执行完成"
        print_info "查看详细结果: tests/results/"
    else
        print_error "部分测试执行失败"
        print_info "查看错误日志: tests/results/"
    fi
    
    exit $exit_code
}

# 捕获中断信号，确保清理
trap cleanup EXIT

# 执行主函数
main "$@"