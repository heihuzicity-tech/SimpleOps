#!/bin/bash

echo "=== 验证前端Docker构建 ==="
echo ""

# 显示当前目录
echo "当前目录: $(pwd)"
echo ""

# 检查前端目录结构
echo "前端目录结构:"
ls -la frontend/ | head -10
echo ""

echo "检查必要文件是否存在:"
echo -n "package.json: "
[ -f "frontend/package.json" ] && echo "✓" || echo "✗"
echo -n "public/index.html: "
[ -f "frontend/public/index.html" ] && echo "✓" || echo "✗"
echo -n "src/App.tsx: "
[ -f "frontend/src/App.tsx" ] && echo "✓" || echo "✗"
echo -n "tsconfig.json: "
[ -f "frontend/tsconfig.json" ] && echo "✓" || echo "✗"
echo ""

# 测试构建
echo "开始测试构建..."
docker build -f docker/frontend/Dockerfile -t bastion-frontend:test . --no-cache

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 构建成功！"
    echo ""
    echo "可以运行以下命令测试镜像:"
    echo "docker run -d -p 3000:80 --name test-frontend bastion-frontend:test"
    echo "然后访问 http://localhost:3000"
else
    echo ""
    echo "❌ 构建失败，请检查上面的错误信息"
fi