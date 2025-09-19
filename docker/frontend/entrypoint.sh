#!/bin/sh

# 前端容器启动脚本
echo "Starting Bastion Frontend..."
echo "Nginx will proxy API requests to backend at 172.20.0.6:8080"

# 确保环境配置文件存在
if [ ! -f /usr/share/nginx/html/env-config.js ]; then
    echo "Creating env-config.js..."
    cat > /usr/share/nginx/html/env-config.js <<EOF
window._env_ = {
  REACT_APP_API_BASE_URL: window.location.origin,
  REACT_APP_WS_BASE_URL: window.location.origin.replace('http', 'ws'),
  REACT_APP_ENVIRONMENT: 'docker',
  REACT_APP_VERSION: '1.0.0'
};
EOF
fi

# 在index.html中注入env-config.js（如果还没有）
if ! grep -q "env-config.js" /usr/share/nginx/html/index.html; then
    echo "Injecting env-config.js into index.html..."
    sed -i 's|</head>|<script src="/env-config.js"></script></head>|' /usr/share/nginx/html/index.html
fi

# 启动nginx
exec nginx -g 'daemon off;'