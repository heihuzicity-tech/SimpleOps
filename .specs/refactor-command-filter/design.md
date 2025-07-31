# 命令过滤功能重构 - 技术设计

## 概述
本设计文档详细说明了命令过滤功能的重构方案，包括数据库设计、API接口设计、前端组件架构等技术细节。

## 现有代码分析

### 相关模块
- **数据模型**：`backend/models/command_policy.go` - 包含Command、CommandGroup、CommandPolicy等模型
- **服务层**：`backend/services/command_policy_service.go` - 业务逻辑实现
- **控制器**：`backend/controllers/command_policy_controller.go` - API路由处理
- **前端组件**：
  - `frontend/src/components/commandFilter/CommandGroupTable.tsx` - 命令组管理
  - `frontend/src/components/commandFilter/PolicyTable.tsx` - 策略管理
  - `frontend/src/services/commandFilterService.ts` - API调用服务

### 依赖分析
- 前端依赖：React + TypeScript + Ant Design
- 后端依赖：Go + Gin + GORM
- 数据库：MySQL

## 架构设计

### 系统架构
整体采用前后端分离架构，保持现有技术栈不变，重点优化数据模型和业务逻辑。

### 模块划分
- **命令组模块**：管理命令的分组，支持命令和正则表达式
- **命令过滤模块**：配置过滤规则，关联用户、资产、账号和命令组

## 核心组件设计

### 组件1: 命令组管理
- **职责**：创建、编辑、删除命令组，管理命令内容
- **位置**：`frontend/src/components/commandFilter/CommandGroupManagement.tsx`
- **接口设计**：
  ```typescript
  interface CommandGroup {
    id: number;
    name: string;
    remark?: string;
    items: CommandGroupItem[];
    created_at: string;
    updated_at: string;
  }
  
  interface CommandGroupItem {
    id: number;
    command_group_id: number;
    type: 'command' | 'regex';
    content: string;
    ignore_case: boolean;
    sort_order: number;
  }
  ```
- **依赖**：Ant Design组件库

### 组件2: 命令过滤管理
- **职责**：配置过滤规则，设置过滤目标和动作
- **位置**：`frontend/src/components/commandFilter/CommandFilterManagement.tsx`
- **接口设计**：
  ```typescript
  interface CommandFilter {
    id: number;
    name: string;
    priority: number;
    enabled: boolean;
    users: FilterTarget;
    assets: FilterTarget;
    accounts: FilterTarget;
    command_group_id: number;
    action: 'deny' | 'allow' | 'alert' | 'prompt_alert';
    remark?: string;
    created_at: string;
    updated_at: string;
  }
  
  interface FilterTarget {
    type: 'all' | 'specific' | 'attribute';
    ids?: number[];
    attributes?: FilterAttribute[];
  }
  
  interface FilterAttribute {
    name: string;
    value: string;
  }
  ```

## 数据模型设计

### 设计原则
1. 在简化和性能之间找到平衡
2. 支持高效的规则匹配
3. 便于查询和维护

### 核心实体

#### 1. 命令组表 (command_groups)
```sql
CREATE TABLE `command_groups` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '命令组名称',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组表';
```

#### 2. 命令组项表 (command_group_items)
```sql
CREATE TABLE `command_group_items` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `command_group_id` bigint unsigned NOT NULL COMMENT '所属命令组ID',
    `type` varchar(20) NOT NULL DEFAULT 'command' COMMENT '类型: command-命令, regex-正则表达式',
    `content` varchar(500) NOT NULL COMMENT '命令内容或正则表达式',
    `ignore_case` tinyint(1) DEFAULT 0 COMMENT '是否忽略大小写',
    `sort_order` int DEFAULT 0 COMMENT '排序顺序',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_command_group_id` (`command_group_id`),
    KEY `idx_content` (`content`(100)),
    CONSTRAINT `fk_cgi_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令组项表';
```

#### 3. 命令过滤表 (command_filters)
```sql
CREATE TABLE `command_filters` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '过滤规则名称',
    `priority` int NOT NULL DEFAULT 50 COMMENT '优先级，1-100，数字越小优先级越高',
    `enabled` tinyint(1) DEFAULT 1 COMMENT '是否启用',
    `user_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '用户类型: all-全部, specific-指定, attribute-属性',
    `asset_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '资产类型: all-全部, specific-指定, attribute-属性',
    `account_type` varchar(20) NOT NULL DEFAULT 'all' COMMENT '账号类型: all-全部, specific-指定',
    `account_names` varchar(500) DEFAULT NULL COMMENT '指定账号名称，逗号分隔',
    `command_group_id` bigint unsigned NOT NULL COMMENT '关联的命令组ID',
    `action` varchar(20) NOT NULL COMMENT '动作: deny-拒绝, allow-接受, alert-告警, prompt_alert-提示并告警',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_priority_enabled` (`priority`, `enabled`),
    KEY `idx_command_group_id` (`command_group_id`),
    KEY `idx_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_cf_command_group` FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令过滤规则表';
```

#### 4. 过滤规则用户关联表 (filter_users)
```sql
CREATE TABLE `filter_users` (
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
    PRIMARY KEY (`filter_id`, `user_id`),
    KEY `idx_user_id` (`user_id`),
    CONSTRAINT `fk_fu_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_fu_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则用户关联表';
```

#### 5. 过滤规则资产关联表 (filter_assets)
```sql
CREATE TABLE `filter_assets` (
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `asset_id` bigint unsigned NOT NULL COMMENT '资产ID',
    PRIMARY KEY (`filter_id`, `asset_id`),
    KEY `idx_asset_id` (`asset_id`),
    CONSTRAINT `fk_fa_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_fa_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则资产关联表';
```

#### 6. 过滤规则属性表 (filter_attributes)
```sql
CREATE TABLE `filter_attributes` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `filter_id` bigint unsigned NOT NULL COMMENT '过滤规则ID',
    `target_type` varchar(20) NOT NULL COMMENT '目标类型: user-用户属性, asset-资产属性',
    `attribute_name` varchar(50) NOT NULL COMMENT '属性名称',
    `attribute_value` varchar(200) NOT NULL COMMENT '属性值',
    PRIMARY KEY (`id`),
    KEY `idx_filter_id` (`filter_id`),
    KEY `idx_target_attribute` (`target_type`, `attribute_name`),
    CONSTRAINT `fk_fattr_filter` FOREIGN KEY (`filter_id`) REFERENCES `command_filters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='过滤规则属性表';
```

#### 7. 过滤日志表 (command_filter_logs)
```sql
CREATE TABLE `command_filter_logs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `session_id` varchar(100) NOT NULL COMMENT 'SSH会话ID',
    `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
    `username` varchar(50) NOT NULL COMMENT '用户名',
    `asset_id` bigint unsigned NOT NULL COMMENT '资产ID',
    `asset_name` varchar(100) NOT NULL COMMENT '资产名称',
    `account` varchar(50) NOT NULL COMMENT '登录账号',
    `command` text NOT NULL COMMENT '执行的命令',
    `filter_id` bigint unsigned NOT NULL COMMENT '触发的过滤规则ID',
    `filter_name` varchar(100) NOT NULL COMMENT '过滤规则名称',
    `action` varchar(20) NOT NULL COMMENT '执行的动作',
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_filter_id` (`filter_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令过滤日志表';
```

### 关系模型
- 命令组 ↔ 命令组项：一对多关系
- 命令过滤 → 命令组：多对一关系
- 命令过滤 ↔ 用户：多对多关系（通过filter_users）
- 命令过滤 ↔ 资产：多对多关系（通过filter_assets）
- 命令过滤 → 属性：一对多关系（通过filter_attributes）

### 设计优势

1. **命令组项独立存储**
   - 支持对命令内容建立索引
   - 便于查询和统计
   - 支持排序和灵活管理

2. **过滤规则使用关联表**
   - 可以快速查询某用户/资产适用的规则
   - 利用数据库索引优化性能
   - 保持数据规范化

3. **属性过滤单独存储**
   - 灵活支持各种属性条件
   - 便于扩展新的属性类型
   - 查询效率高

## API设计

### REST API端点

#### 命令组管理
```
GET    /api/command-filter/groups          - 获取命令组列表
POST   /api/command-filter/groups          - 创建命令组
GET    /api/command-filter/groups/{id}     - 获取命令组详情
PUT    /api/command-filter/groups/{id}     - 更新命令组
DELETE /api/command-filter/groups/{id}     - 删除命令组
```

#### 命令过滤管理
```
GET    /api/command-filter/filters         - 获取过滤规则列表
POST   /api/command-filter/filters         - 创建过滤规则
GET    /api/command-filter/filters/{id}    - 获取过滤规则详情
PUT    /api/command-filter/filters/{id}    - 更新过滤规则
DELETE /api/command-filter/filters/{id}    - 删除过滤规则
PATCH  /api/command-filter/filters/{id}/toggle - 启用/禁用规则
```

#### 过滤日志
```
GET    /api/command-filter/logs            - 获取过滤日志列表
```

### 请求/响应示例

#### 创建命令组
```json
// Request
POST /api/command-filter/groups
{
  "name": "危险命令组",
  "remark": "系统危险命令",
  "items": [
    {
      "type": "command",
      "content": "rm",
      "ignore_case": false
    },
    {
      "type": "command",
      "content": "reboot",
      "ignore_case": false
    },
    {
      "type": "regex",
      "content": "^rm\\s+-rf",
      "ignore_case": false
    }
  ]
}

// Response
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "危险命令组",
    "remark": "系统危险命令",
    "items": [
      {
        "id": 1,
        "command_group_id": 1,
        "type": "command",
        "content": "rm",
        "ignore_case": false,
        "sort_order": 0
      },
      {
        "id": 2,
        "command_group_id": 1,
        "type": "command",
        "content": "reboot",
        "ignore_case": false,
        "sort_order": 1
      },
      {
        "id": 3,
        "command_group_id": 1,
        "type": "regex",
        "content": "^rm\\s+-rf",
        "ignore_case": false,
        "sort_order": 2
      }
    ],
    "created_at": "2025-01-30T10:00:00Z",
    "updated_at": "2025-01-30T10:00:00Z"
  }
}
```

#### 创建过滤规则
```json
// Request
POST /api/command-filter/filters
{
  "name": "禁止root执行危险命令",
  "priority": 10,
  "enabled": true,
  "user_type": "all",
  "user_ids": [],
  "asset_type": "specific",
  "asset_ids": [1, 2, 3],
  "account_type": "specific",
  "account_names": "root",
  "command_group_id": 1,
  "action": "deny",
  "remark": "防止误操作"
}
```

## 后端数据结构

```go
// CommandGroup 命令组
type CommandGroup struct {
    ID        uint                `json:"id"`
    Name      string              `json:"name"`
    Remark    string              `json:"remark"`
    Items     []CommandGroupItem  `json:"items,omitempty"`
    CreatedAt time.Time           `json:"created_at"`
    UpdatedAt time.Time           `json:"updated_at"`
}

// CommandGroupItem 命令组项
type CommandGroupItem struct {
    ID            uint   `json:"id"`
    CommandGroupID uint   `json:"command_group_id"`
    Type          string `json:"type"` // command or regex
    Content       string `json:"content"`
    IgnoreCase    bool   `json:"ignore_case"`
    SortOrder     int    `json:"sort_order"`
}

// CommandFilter 命令过滤规则
type CommandFilter struct {
    ID            uint     `json:"id"`
    Name          string   `json:"name"`
    Priority      int      `json:"priority"`
    Enabled       bool     `json:"enabled"`
    UserType      string   `json:"user_type"`
    AssetType     string   `json:"asset_type"`
    AccountType   string   `json:"account_type"`
    AccountNames  string   `json:"account_names"`
    CommandGroupID uint     `json:"command_group_id"`
    Action        string   `json:"action"`
    Remark        string   `json:"remark"`
    
    // 关联数据
    Users      []uint              `json:"users,omitempty"`
    Assets     []uint              `json:"assets,omitempty"`
    Attributes []FilterAttribute   `json:"attributes,omitempty"`
    CommandGroup *CommandGroup     `json:"command_group,omitempty"`
}

// FilterAttribute 过滤属性
type FilterAttribute struct {
    ID          uint   `json:"id"`
    FilterID    uint   `json:"filter_id"`
    TargetType  string `json:"target_type"` // user or asset
    Name        string `json:"name"`
    Value       string `json:"value"`
}
```

## 查询优化

### 查找适用于特定用户的规则
```sql
SELECT DISTINCT cf.* FROM command_filters cf
WHERE cf.enabled = 1 
AND (cf.user_type = 'all' OR 
     (cf.user_type = 'specific' AND EXISTS (SELECT 1 FROM filter_users fu WHERE fu.filter_id = cf.id AND fu.user_id = ?)))
ORDER BY cf.priority;
```

### 匹配命令
```sql
SELECT cgi.* FROM command_group_items cgi
WHERE cgi.command_group_id = ?
AND ((cgi.type = 'command' AND cgi.content = ?) 
     OR (cgi.type = 'regex' AND ? REGEXP cgi.content));
```

## 文件修改计划

### 需要删除的文件
- `backend/models/command_policy.go` - 旧的数据模型
- `backend/services/command_policy_service.go` - 旧的服务层
- `backend/controllers/command_policy_controller.go` - 旧的控制器
- `backend/migrations/20250128_create_command_policy_tables.sql` - 旧的数据库迁移
- `frontend/src/components/commandFilter/PolicyTable.tsx` - 策略管理组件
- `frontend/src/components/commandFilter/CommandTable.tsx` - 命令管理组件（如存在）

### 新建文件
- `backend/models/command_filter.go` - 新的数据模型
- `backend/services/command_filter_service.go` - 新的服务层
- `backend/controllers/command_filter_controller.go` - 新的控制器
- `backend/migrations/20250130_create_command_filter_tables.sql` - 新的数据库迁移
- `backend/migrations/20250130_drop_old_command_tables.sql` - 删除旧表的迁移
- `frontend/src/components/commandFilter/CommandGroupManagement.tsx` - 命令组管理
- `frontend/src/components/commandFilter/CommandFilterManagement.tsx` - 过滤规则管理
- `frontend/src/components/commandFilter/FilterLogTable.tsx` - 日志查看组件

### 需要修改的文件
- `backend/routes/routes.go` - 更新路由配置
- `frontend/src/services/commandFilterService.ts` - 更新API调用
- `frontend/src/types/index.ts` - 更新类型定义
- `frontend/src/pages/CommandFilterPage.tsx` - 更新页面布局

## 错误处理策略
- 用户输入错误：前端验证 + 后端二次验证
- 系统运行时错误：统一错误响应格式，记录详细日志
- 网络通信错误：前端重试机制 + 友好提示

## 性能与安全考虑

### 性能目标
- 命令匹配缓存：使用Redis缓存编译后的正则表达式
- 规则优先级索引：确保快速匹配
- 批量操作优化：支持批量创建/删除

### 安全控制
- 权限验证：只有管理员可以配置过滤规则
- 输入验证：防止正则表达式DoS攻击
- 审计日志：记录所有配置变更

## 基本测试策略
- 单元测试：覆盖核心业务逻辑
- 集成测试：验证API端到端功能
- 性能测试：验证大量规则下的匹配性能