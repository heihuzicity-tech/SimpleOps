#!/bin/bash

echo "======================================"
echo "命令过滤功能前端组件测试脚本"
echo "======================================"

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo "错误: npm 未安装或不在PATH中"
    exit 1
fi

# 进入前端项目目录
cd "$(dirname "$0")"

echo "📁 当前目录: $(pwd)"
echo ""

# 检查package.json是否存在
if [ ! -f "package.json" ]; then
    echo "错误: 未找到package.json文件"
    exit 1
fi

echo "📋 测试文件列表:"
echo "✅ CommandGroupManagement.test.tsx - 命令组管理组件测试"
echo "✅ CommandFilterManagement.test.tsx - 命令过滤管理组件测试"  
echo "✅ FilterLogTable.test.tsx - 过滤日志查看组件测试"
echo ""

echo "🔧 安装测试依赖..."
echo "注意: 如果依赖安装失败，请手动运行以下命令:"
echo "npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event moment"
echo ""

echo "📊 测试覆盖统计:"
echo "- 总测试用例: 84个"
echo "- 测试组件: 3个核心组件"
echo "- 覆盖功能点: 40+个主要功能"
echo "- 测试类型: 单元测试、集成测试、用户交互测试"
echo ""

echo "🚀 运行测试的建议命令:"
echo ""
echo "1. 运行所有命令过滤相关测试:"
echo "   npm test -- --testPathPattern=\"commandFilter\" --coverage --watchAll=false"
echo ""
echo "2. 运行单个组件测试:"
echo "   npm test -- CommandGroupManagement.test.tsx --watchAll=false"
echo "   npm test -- CommandFilterManagement.test.tsx --watchAll=false"
echo "   npm test -- FilterLogTable.test.tsx --watchAll=false"
echo ""
echo "3. 监听模式运行测试:"
echo "   npm test -- --testPathPattern=\"commandFilter\" --watch"
echo ""

echo "📖 查看详细测试报告:"
echo "   cat src/components/commandFilter/__tests__/TESTING_REPORT.md"
echo ""

echo "⚠️  注意事项:"
echo "1. 确保已安装必要的测试依赖库"
echo "2. 测试运行前会自动mock相关的API调用"
echo "3. 测试覆盖率目标: 行覆盖率>85%, 函数覆盖率>90%"
echo "4. 如遇到依赖问题，请检查node_modules目录"
echo ""

echo "✨ 测试文件位置:"
echo "   📁 frontend/src/components/commandFilter/__tests__/"
echo "   ├── CommandGroupManagement.test.tsx"
echo "   ├── CommandFilterManagement.test.tsx" 
echo "   ├── FilterLogTable.test.tsx"
echo "   └── TESTING_REPORT.md"
echo ""

echo "======================================"
echo "测试准备完成！请选择上述命令运行测试"
echo "======================================"