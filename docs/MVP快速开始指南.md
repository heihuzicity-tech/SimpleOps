# 运维堡垒机MVP快速开始指南

## 🚀 快速概览

这是一个基于Go + React的运维堡垒机系统MVP版本，专注于SSH访问控制和基础审计功能。

### 核心特性
- ✅ 用户认证与权限管理
- ✅ 服务器资产管理
- ✅ SSH访问代理
- ✅ WebSSH终端
- ✅ 基础操作审计

## 🛠️ 技术栈

### 后端
- **Go 1.19+** - 主要开发语言
- **Gin** - Web框架
- **GORM** - ORM框架
- **JWT** - 认证令牌
- **MySQL 8.0** - 主数据库
- **Redis** - 缓存和会话存储

### 前端
- **React 18** - 前端框架
- **Ant Design** - UI组件库
- **TypeScript** - 类型安全
- **Axios** - HTTP客户端

## 🏗️ 项目结构

```
bastion/
├── backend/                 # 后端服务
│   ├── main.go             # 入口文件
│   ├── config/             # 配置文件
│   ├── models/             # 数据模型
│   ├── controllers/        # 控制器
│   ├── services/           # 业务逻辑
│   ├── middleware/         # 中间件
│   └── utils/              # 工具函数
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   └── public/
└── docker-compose.yml      # 部署配置
```

## 🚀 快速启动

### 1. 环境准备

```bash
# 安装Go 1.19+
go version

# 安装Node.js 16+
node --version

# 安装Docker和Docker Compose
docker --version
docker-compose --version
```

### 2. 启动依赖服务

```bash
# 启动MySQL和Redis
docker-compose up -d mysql redis

# 等待服务启动
sleep 10
```

### 3. 后端开发

```bash
# 进入后端目录
cd backend

# 安装依赖
go mod init bastion
go mod tidy

# 创建配置文件
cp config/config.example.yaml config/config.yaml

# 运行数据库迁移
go run main.go --migrate

# 启动开发服务
go run main.go
```

### 4. 前端开发

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm start
```

### 5. 访问应用

- 前端界面: http://localhost:3000
- 后端API: http://localhost:8080
- 默认管理员: admin/admin123

## 📝 开发顺序

### 第1周：项目基础
- [x] 创建项目结构
- [x] 配置数据库连接
- [x] 实现基础认证接口
- [x] 创建用户模型和接口

### 第2周：用户管理
- [ ] 实现用户CRUD接口
- [ ] 添加角色权限系统
- [ ] 创建前端登录页面
- [ ] 实现用户管理界面

### 第3周：资产管理
- [ ] 实现资产CRUD接口
- [ ] 添加凭证管理功能
- [ ] 实现连接测试功能
- [ ] 创建资产管理界面

### 第4周：SSH访问
- [ ] 实现SSH协议代理
- [ ] 创建WebSSH终端
- [ ] 实现会话管理
- [ ] 集成前后端SSH功能

### 第5周：审计功能
- [ ] 实现操作日志记录
- [ ] 添加会话记录功能
- [ ] 创建日志查看界面
- [ ] 完善审计报告

### 第6周：测试部署
- [ ] 完整功能测试
- [ ] 性能测试优化
- [ ] 部署文档编写
- [ ] 用户手册编写

## 🔧 核心功能实现

### 1. 用户认证流程

```go
// 登录接口
func Login(c *gin.Context) {
    // 验证用户名密码
    user := validateCredentials(username, password)
    
    // 生成JWT Token
    token := generateJWT(user)
    
    // 返回Token
    c.JSON(200, gin.H{"token": token})
}

// JWT中间件
func JWTMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        user := validateJWT(token)
        c.Set("user", user)
        c.Next()
    }
}
```

### 2. SSH连接代理

```go
// SSH连接处理
func HandleSSHConnection(c *gin.Context) {
    // 获取目标服务器信息
    asset := getAssetInfo(assetId)
    
    // 建立SSH连接
    sshClient := createSSHClient(asset)
    
    // 创建WebSocket连接
    wsConn := upgradeWebSocket(c)
    
    // 代理SSH数据
    proxySSHData(sshClient, wsConn)
}
```

### 3. 前端终端组件

```typescript
// WebSSH终端组件
const SSHTerminal: React.FC = () => {
    const [socket, setSocket] = useState<WebSocket>();
    const terminalRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // 创建WebSocket连接
        const ws = new WebSocket('ws://localhost:8080/ssh');
        
        // 初始化xterm.js
        const term = new Terminal();
        term.open(terminalRef.current);
        
        // 处理数据传输
        ws.onmessage = (event) => {
            term.write(event.data);
        };
        
        term.onData((data) => {
            ws.send(data);
        });
    }, []);
    
    return <div ref={terminalRef} className="terminal" />;
};
```

## 🔍 调试技巧

### 1. 后端调试

```bash
# 启用调试模式
export GIN_MODE=debug

# 查看数据库连接
go run main.go --debug-db

# 测试API接口
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. 前端调试

```bash
# 启用详细日志
export REACT_APP_DEBUG=true

# 查看网络请求
# 在浏览器开发者工具中查看Network标签
```

## 📚 相关资源

### 文档链接
- [Go Gin框架文档](https://gin-gonic.com/docs/)
- [GORM使用指南](https://gorm.io/docs/)
- [React官方文档](https://react.dev/)
- [Ant Design组件库](https://ant.design/)

### 示例代码
- [JWT认证示例](https://github.com/golang-jwt/jwt)
- [WebSSH实现参考](https://github.com/elfinder/webssh)
- [SSH代理实现](https://github.com/golang/crypto/tree/master/ssh)

## 🤝 贡献指南

1. **代码规范**: 遵循Go和TypeScript的标准编码规范
2. **提交格式**: 使用conventional commits格式
3. **测试要求**: 关键功能必须有单元测试
4. **文档更新**: 新功能需要更新相关文档

## 📞 支持与反馈

如果在开发过程中遇到问题，可以：
1. 查看项目文档和示例代码
2. 在GitHub上提交Issue
3. 参与技术讨论群组

---

**开始你的堡垒机开发之旅吧！** 🚀 