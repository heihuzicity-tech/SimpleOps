# 仪表盘功能 - 技术设计文档

## 概述
基于现有的堡垒机系统架构，设计并实现一个综合性的仪表盘页面，利用现有的审计服务和监控服务提供的统计数据，结合前端可视化技术展示系统运行状态。

## 现有代码分析

### 相关模块
- **审计服务**: `backend/services/audit_service.go` - 提供 `GetAuditStatistics()` 方法
- **监控服务**: `backend/services/monitor_service.go` - 提供 `GetMonitorStatistics()` 方法
- **审计控制器**: `backend/controllers/audit_controller.go` - 暴露统计数据API端点
- **前端审计API**: `frontend/src/services/auditAPI.ts` - 已包含 `getAuditStatistics()` 和 `getMonitorStatistics()` 方法

### 依赖分析
- **前端框架**: React 18.2 + TypeScript
- **UI组件库**: Ant Design 5.11
- **状态管理**: Redux Toolkit
- **HTTP客户端**: Axios
- **图表库**: 需要新增（建议使用 Recharts 或 ECharts）

## 架构设计

### 系统架构
```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  DashboardPage.tsx                                          │
│  ├─ StatsCards (统计卡片组件)                              │
│  ├─ RecentLoginTable (最近登录表格)                        │
│  ├─ HostDistributionChart (主机分布图表)                   │
│  ├─ ActivityTrendChart (活跃趋势图表)                      │
│  ├─ AuditSummary (审计统计摘要)                           │
│  └─ QuickAccess (快速访问列表)                            │
├─────────────────────────────────────────────────────────────┤
│  Redux Store (dashboardSlice)                              │
│  ├─ stats (统计数据)                                       │
│  ├─ recentLogins (最近登录)                               │
│  ├─ hostGroups (主机分组)                                 │
│  └─ loading/error states                                   │
├─────────────────────────────────────────────────────────────┤
│  API Services                                              │
│  ├─ dashboardAPI.ts (新增)                                │
│  ├─ auditAPI.ts (复用现有)                                │
│  └─ assetAPI.ts (复用现有)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端 (Go/Gin)                         │
├─────────────────────────────────────────────────────────────┤
│  DashboardController (新增)                                │
│  ├─ GetDashboardStats()                                    │
│  ├─ GetRecentLogins()                                      │
│  ├─ GetHostDistribution()                                  │
│  └─ GetActivityTrends()                                    │
├─────────────────────────────────────────────────────────────┤
│  DashboardService (新增)                                   │
│  ├─ 聚合各服务数据                                        │
│  ├─ 计算统计指标                                          │
│  └─ 缓存优化                                              │
├─────────────────────────────────────────────────────────────┤
│  现有服务 (复用)                                           │
│  ├─ AuditService                                          │
│  ├─ MonitorService                                        │
│  ├─ AssetService                                          │
│  └─ UserService                                           │
└─────────────────────────────────────────────────────────────┘
```

### 模块划分

#### 前端模块
1. **页面组件** (`frontend/src/pages/DashboardPage.tsx`)
   - 主容器组件，负责布局和数据获取
   - 处理自动刷新逻辑（30秒间隔）

2. **展示组件** (`frontend/src/components/dashboard/`)
   - `StatsCards.tsx`: 统计卡片组件
   - `RecentLoginTable.tsx`: 最近登录表格
   - `HostDistributionChart.tsx`: 主机分布环形图
   - `ActivityTrendChart.tsx`: 活跃趋势折线图
   - `AuditSummary.tsx`: 审计统计概览
   - `QuickAccessList.tsx`: 快速访问列表

3. **状态管理** (`frontend/src/store/dashboardSlice.ts`)
   - 管理仪表盘相关状态
   - 处理异步数据获取
   - 缓存和更新策略

4. **API服务** (`frontend/src/services/dashboardAPI.ts`)
   - 封装仪表盘相关API调用
   - 数据格式转换和适配

#### 后端模块
1. **控制器** (`backend/controllers/dashboard_controller.go`)
   - 提供仪表盘专用API端点
   - 权限验证和参数校验

2. **服务层** (`backend/services/dashboard_service.go`)
   - 聚合多个服务的数据
   - 实现复杂的统计计算
   - 提供数据缓存机制

## 核心组件设计

### 1. 统计卡片组件 (StatsCards)
```typescript
interface StatsCardData {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    type: 'up' | 'down';
  };
  subtitle?: string;
  color?: string;
}
```

### 2. 仪表盘状态管理 (Redux)
```typescript
interface DashboardState {
  stats: {
    hosts: {
      total: number;
      online: number;
      groups: number;
    };
    sessions: {
      active: number;
      total: number;
    };
    users: {
      total: number;
      online: number;
      todayLogins: number;
    };
    credentials: {
      passwords: number;
      sshKeys: number;
    };
  };
  recentLogins: LoginRecord[];
  hostDistribution: HostGroupData[];
  activityTrends: ActivityTrendData[];
  auditSummary: AuditSummaryData;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
}
```

### 3. API响应数据结构
```go
// DashboardStats 仪表盘统计数据
type DashboardStats struct {
    Hosts struct {
        Total  int `json:"total"`
        Online int `json:"online"`
        Groups int `json:"groups"`
    } `json:"hosts"`
    Sessions struct {
        Active int `json:"active"`
        Total  int `json:"total"`
    } `json:"sessions"`
    Users struct {
        Total       int `json:"total"`
        Online      int `json:"online"`
        TodayLogins int `json:"today_logins"`
    } `json:"users"`
    Credentials struct {
        Passwords int `json:"passwords"`
        SSHKeys   int `json:"ssh_keys"`
    } `json:"credentials"`
}
```

## 数据模型设计

### 核心实体扩展
无需修改现有数据库结构，仅通过聚合查询获取统计数据。

### 关系模型
- 复用现有的 assets、users、credentials、session_records 等表
- 通过 JOIN 和聚合函数获取统计信息

## API设计

### REST API端点
```
GET /api/v1/dashboard/stats          - 获取仪表盘统计数据
GET /api/v1/dashboard/recent-logins  - 获取最近登录记录
GET /api/v1/dashboard/host-groups    - 获取主机分组分布
GET /api/v1/dashboard/activity-trends - 获取活跃趋势数据
GET /api/v1/dashboard/quick-access   - 获取快速访问列表
```

### WebSocket实时更新（可选）
```
WS /api/v1/ws/dashboard - 实时推送仪表盘数据更新
```

## 文件修改计划

### 新增文件
#### 前端
- `frontend/src/pages/DashboardPage.tsx` - 仪表盘页面组件
- `frontend/src/components/dashboard/StatsCards.tsx` - 统计卡片组件
- `frontend/src/components/dashboard/RecentLoginTable.tsx` - 最近登录表格
- `frontend/src/components/dashboard/HostDistributionChart.tsx` - 主机分布图表
- `frontend/src/components/dashboard/ActivityTrendChart.tsx` - 活跃趋势图表
- `frontend/src/components/dashboard/AuditSummary.tsx` - 审计统计组件
- `frontend/src/components/dashboard/QuickAccessList.tsx` - 快速访问列表
- `frontend/src/store/dashboardSlice.ts` - Redux状态管理
- `frontend/src/services/dashboardAPI.ts` - API服务封装

#### 后端
- `backend/controllers/dashboard_controller.go` - 仪表盘控制器
- `backend/services/dashboard_service.go` - 仪表盘服务层
- `backend/models/dashboard.go` - 仪表盘数据模型

### 修改文件
#### 前端
- `frontend/src/App.tsx` - 添加DashboardPage导入和路由
- `frontend/src/store/index.ts` - 注册dashboardSlice
- `frontend/package.json` - 添加图表库依赖（recharts）

#### 后端
- `backend/routers/router.go` - 添加仪表盘路由组

## 错误处理策略
- **数据加载失败**: 显示友好的错误提示，提供重试按钮
- **部分数据缺失**: 降级显示，不影响其他模块
- **权限不足**: 根据用户角色过滤数据，普通用户只看个人数据

## 性能与安全考虑

### 性能优化
- **数据缓存**: 后端实现5分钟缓存，减少数据库查询
- **分页加载**: 最近登录记录分页展示
- **懒加载**: 图表组件按需加载
- **防抖处理**: API调用防抖，避免频繁请求

### 安全控制
- **权限验证**: 所有API需要登录认证
- **数据过滤**: 根据用户角色过滤敏感数据
- **SQL注入防护**: 使用GORM参数化查询
- **XSS防护**: 前端数据展示进行转义处理

## 基础测试策略
- **单元测试**: 测试服务层统计计算逻辑
- **集成测试**: 测试API端点返回数据正确性
- **前端测试**: 测试组件渲染和交互逻辑
- **性能测试**: 测试大数据量下的响应时间