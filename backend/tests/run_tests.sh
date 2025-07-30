#!/bin/bash

# 命令过滤功能测试脚本
# 用于快速启动和测试后端 API

echo "======================================"
echo "🚀 Bastion 命令过滤功能测试"
echo "======================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
API_URL="http://localhost:8080/api/v1"
TEST_MODE="full"
BACKEND_PID=""

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            TEST_MODE="quick"
            shift
            ;;
        --url)
            API_URL="$2"
            shift 2
            ;;
        --no-backend)
            NO_BACKEND=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--quick] [--url API_URL] [--no-backend]"
            exit 1
            ;;
    esac
done

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 错误：未找到 Python3${NC}"
    exit 1
fi

# 检查 requests 模块
if ! python3 -c "import requests" &> /dev/null; then
    echo -e "${YELLOW}⚠️  警告：未安装 requests 模块${NC}"
    echo "正在安装 requests..."
    pip3 install requests
fi

# 启动后端（如果需要）
if [ -z "$NO_BACKEND" ]; then
    echo -e "\n${YELLOW}📦 检查后端服务...${NC}"
    
    # 检查端口是否被占用
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✅ 后端服务已在运行${NC}"
    else
        echo "正在启动后端服务..."
        cd ../
        go run main.go > tests/backend.log 2>&1 &
        BACKEND_PID=$!
        
        # 等待服务启动
        echo -n "等待服务启动"
        for i in {1..10}; do
            if curl -s http://localhost:8080/api/v1/health > /dev/null; then
                echo -e "\n${GREEN}✅ 后端服务启动成功${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
        
        if ! curl -s http://localhost:8080/api/v1/health > /dev/null; then
            echo -e "\n${RED}❌ 后端服务启动失败${NC}"
            echo "查看日志: tests/backend.log"
            exit 1
        fi
        
        cd tests/
    fi
fi

# 运行测试
echo -e "\n${YELLOW}🧪 运行测试...${NC}"
echo "API URL: $API_URL"
echo "测试模式: $TEST_MODE"
echo "----------------------------------------"

if [ "$TEST_MODE" = "quick" ]; then
    python3 api_test_command_filter.py --quick --url "$API_URL"
else
    python3 api_test_command_filter.py --url "$API_URL"
fi

TEST_RESULT=$?

# 清理
if [ ! -z "$BACKEND_PID" ]; then
    echo -e "\n${YELLOW}🧹 停止后端服务...${NC}"
    kill $BACKEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
fi

# 显示结果
echo "----------------------------------------"
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ 测试完成！${NC}"
else
    echo -e "${RED}❌ 测试失败！${NC}"
fi

exit $TEST_RESULT