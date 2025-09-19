# Docker镜像构建加速优化

## 优化内容

### 1. 后端镜像 (Alpine Linux)
- **Alpine镜像源**: 替换为阿里云镜像 `mirrors.aliyun.com`
- **Go模块代理**: 设置为 `goproxy.cn`
- 影响：apk包安装和Go模块下载速度大幅提升

### 2. 前端镜像 (Node.js)
- **Alpine镜像源**: 替换为阿里云镜像 `mirrors.aliyun.com`
- **npm镜像源**: 设置为 `registry.npmmirror.com`
- 影响：npm包下载速度大幅提升

### 3. SSH服务器镜像 (Ubuntu)
- **Ubuntu镜像源**: 替换为阿里云镜像 `mirrors.aliyun.com`
- 影响：apt包安装速度大幅提升

### 4. MySQL镜像
- 保持原样（官方镜像通常不需要额外软件安装）

## 使用效果

在中国大陆地区使用时，构建速度预计提升：
- Alpine包安装：提升 5-10 倍
- Go模块下载：提升 3-5 倍
- npm包下载：提升 3-5 倍
- Ubuntu包安装：提升 5-10 倍

## 注意事项

1. 这些镜像源主要适用于中国大陆地区
2. 如果在海外部署，可能需要移除这些镜像源设置
3. 阿里云镜像源是免费的，但有一定的并发限制
4. 建议在CI/CD环境中也配置相应的镜像源

## 其他可选镜像源

### Alpine
- 清华大学：`mirrors.tuna.tsinghua.edu.cn`
- 中科大：`mirrors.ustc.edu.cn`

### npm
- 淘宝镜像：`registry.npmmirror.com` (推荐)
- cnpm：`r.cnpmjs.org`

### Go Proxy
- 七牛云：`goproxy.cn` (推荐)
- 阿里云：`https://mirrors.aliyun.com/goproxy/`
- 官方：`proxy.golang.org` (国内访问慢)

### Ubuntu
- 清华大学：`mirrors.tuna.tsinghua.edu.cn`
- 中科大：`mirrors.ustc.edu.cn`
- 网易：`mirrors.163.com`