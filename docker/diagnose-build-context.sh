#!/bin/bash

echo "=== 诊断Docker构建上下文 ==="
echo ""

# 显示当前目录
echo "当前工作目录："
pwd
echo ""

# 检查项目结构
echo "项目根目录内容："
ls -la | head -20
echo ""

# 检查frontend目录
echo "frontend目录是否存在："
if [ -d "frontend" ]; then
    echo "✓ frontend目录存在"
    echo ""
    echo "frontend目录内容："
    ls -la frontend/ | head -20
    echo ""
    
    # 检查public目录
    echo "frontend/public目录是否存在："
    if [ -d "frontend/public" ]; then
        echo "✓ frontend/public目录存在"
        echo "内容："
        ls -la frontend/public/
    else
        echo "✗ frontend/public目录不存在"
    fi
    echo ""
    
    # 检查src目录
    echo "frontend/src目录是否存在："
    if [ -d "frontend/src" ]; then
        echo "✓ frontend/src目录存在"
    else
        echo "✗ frontend/src目录不存在"
    fi
else
    echo "✗ frontend目录不存在"
fi
echo ""

# 检查.dockerignore
echo ".dockerignore文件内容："
if [ -f ".dockerignore" ]; then
    echo "--- 开始 ---"
    cat .dockerignore
    echo "--- 结束 ---"
else
    echo "没有.dockerignore文件"
fi
echo ""

# 测试Docker构建上下文
echo "测试Docker构建上下文..."
echo "创建测试Dockerfile..."
cat > Dockerfile.test << 'EOF'
FROM alpine:latest
WORKDIR /test
# 列出构建上下文根目录
RUN echo "=== Build context root ===" && ls -la /
# 尝试复制frontend目录
COPY frontend /test/frontend || echo "Failed to copy frontend"
# 列出复制后的内容
RUN echo "=== After copy ===" && ls -la /test/ && \
    echo "=== Frontend contents ===" && ls -la /test/frontend/ || echo "No frontend dir"
EOF

echo "执行测试构建..."
docker build -f Dockerfile.test -t context-test . --no-cache

# 清理
rm -f Dockerfile.test

echo ""
echo "诊断完成！"
echo ""
echo "建议的下一步："
echo "1. 如果frontend目录不存在，需要先获取前端源代码"
echo "2. 如果.dockerignore排除了必要文件，需要调整规则"
echo "3. 确保在正确的目录（项目根目录）执行docker-compose命令"