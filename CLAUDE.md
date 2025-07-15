# Bastion 项目开发指南

## 项目概述
Bastion 是一个现代化的运维堡垒机系统，提供安全的 SSH 连接管理和会话监控功能。

## 技术栈
- **前端**: React 18 + TypeScript + Ant Design 5.x
- **后端**: Go 1.19+ + Gin + GORM
- **数据库**: MySQL 8.0 + Redis 7.x
- **基础设施**: Docker + Docker Compose
- **开发工具**: ESLint + Prettier + TypeScript

## 语言要求
- 所有对话请使用中文
- 代码注释使用中文（关键逻辑）
- 文档和说明使用中文
- 变量和函数名使用英文（遵循业界标准）

## 🔧 开发环境管理

### 服务管理脚本
- **重要**: 始终使用 `./manage.sh` 脚本来管理服务
- 不要直接使用 docker 或 docker-compose 命令

```bash
# 基础操作
./manage.sh start     # 启动所有服务
./manage.sh stop      # 停止所有服务  
./manage.sh restart   # 重启所有服务
./manage.sh status    # 查看服务状态

# 调试操作
./manage.sh logs [service]  # 查看日志
./manage.sh build          # 重新构建服务
./manage.sh shell [service] # 进入容器shell
```

### 开发流程
1. 修改代码后使用 `./manage.sh restart [service]` 重启相关服务
2. 查看日志时使用 `./manage.sh logs [service]` 命令
3. 遇到问题时先检查服务状态：`./manage.sh status`

## 🎨 前端开发规范

### Ant Design 最佳实践

#### 1. 组件使用原则
- **严格遵循 Ant Design 官方模式**: 优先使用官方组件组合，避免重复造轮子
- **组件组合标准化**:
  ```tsx
  // ✅ 正确：使用 Input.Search 的 addonBefore
  <Input.Search addonBefore={<Select/>} />
  
  // ❌ 错误：自定义包装容器
  <div><Select/><Input/></div>
  ```

#### 2. 布局组件规范
```tsx
// 页面布局
<Row gutter={[16, 16]}>
  <Col span={6}>侧边栏</Col>
  <Col span={18}>主内容</Col>
</Row>

// 组件间距
<Space size="middle" direction="vertical">
  <Button>按钮1</Button>  
  <Button>按钮2</Button>
</Space>

// 表单布局
<Form layout="vertical">
  <Form.Item label="标签" name="field">
    <Input />
  </Form.Item>
</Form>
```

#### 3. 样式覆盖策略
```tsx
// 1. 优先使用 props API
<Button size="large" type="primary" danger />

// 2. 使用 CSS Modules 或 styled-components
import styles from './Component.module.css';

// 3. 必要时使用类名选择器（最后选择）
const StyledComponent = styled.div`
  .ant-btn {
    border-radius: 0 !important;
  }
`;
```

#### 4. TypeScript 类型规范
```tsx
// 使用 Ant Design 提供的类型
import type { ButtonProps, FormProps } from 'antd';

// 扩展组件 props
interface CustomButtonProps extends ButtonProps {
  customProp?: string;
}

// 严格的事件处理类型
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // 处理逻辑
};
```

### 性能优化指南
- 使用 `React.memo` 包装展示组件
- 使用 `useMemo` 和 `useCallback` 优化重复计算
- 表格数据使用虚拟滚动（大数据量时）
- 图片使用懒加载
- 路由代码分割 `React.lazy`

### 代码质量
```json
// 推荐的 ESLint 规则
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

## 🔒 安全规范

### 环境变量管理
```bash
# 使用 .env 文件管理敏感信息
DB_HOST=localhost
DB_USER=bastion_user
DB_PASSWORD=${MYSQL_PASSWORD}  # 从环境变量注入
```

### 前端安全
- 所有用户输入必须验证和转义
- 使用 HTTPS 进行数据传输
- 实施 CSP (Content Security Policy)
- 敏感信息不存储在 localStorage

## 📁 项目结构

```
bastion/
├── frontend/
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── pages/         # 页面组件  
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── services/      # API 服务层
│   │   ├── store/         # 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   └── utils/         # 工具函数
├── backend/
│   ├── cmd/              # 应用入口
│   ├── internal/         # 内部包
│   ├── pkg/              # 可复用包
│   └── configs/          # 配置文件
└── deployments/          # 部署配置
```

## 🚀 SuperClaude 指令集成

### 智能指令映射
根据关键词自动建议合适的 SuperClaude 指令：

| 场景 | 关键词 | 建议指令 |
|------|--------|----------|
| 🐛 故障排查 | "bug", "错误", "不工作" | `/troubleshoot --prod --five-whys` |
| ⚡ 性能优化 | "卡顿", "慢", "优化" | `/improve --performance --iterate` |
| 🏗️ 架构设计 | "新功能", "设计", "架构" | `/design --api --ddd` |
| 🔒 安全审计 | "安全", "漏洞", "权限" | `/analyze --security --think-hard` |
| 📊 代码分析 | "分析", "重构", "优化" | `/analyze --code --think` |

### 标准上下文模板
```
【项目】Bastion 运维堡垒机系统
【技术栈】Go + React + TypeScript + Ant Design + Docker
【架构】前后端分离，微服务架构，容器化部署
【约束】严格遵循 Ant Design 最佳实践，使用 ./manage.sh 管理服务
【安全】敏感信息环境变量化，遵循 OWASP 安全规范
```

## 📚 开发资源

### 官方文档
- [Ant Design 官方文档](https://ant.design/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)

### 内部资源
- API 文档: `/docs/api`
- 组件库: `/docs/components`
- 部署指南: `/docs/deployment`

---

> 💡 **提示**: 此文档会随项目发展持续更新，请定期查看最新版本。
> 📝 **贡献**: 发现改进建议请提交 Issue 或 PR。