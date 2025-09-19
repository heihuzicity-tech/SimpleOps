# 命令策略功能 - 技术设计文档

## 概述
基于现有的堡垒机系统架构，设计命令策略管理功能。该功能将在用户SSH会话中实时拦截被禁止的命令，并记录审计日志。

## 现有代码分析

### 相关模块
- **SSH服务模块** (`backend/services/ssh_service.go`): 管理SSH会话和连接
- **WebSocket服务** (`backend/services/websocket_service.go`): 处理实时通信
- **SSH控制器** (`backend/controllers/ssh_controller.go`): 处理终端输入输出，包含命令拦截点
- **审计服务** (`backend/services/audit_service.go`): 记录操作日志和命令日志
- **数据库模型** (`backend/models/user.go`): 包含CommandLog等审计相关模型

### 关键拦截点
在 `ssh_controller.go` 的 `handleWebSocketMessage` 方法中，`case "input"` 分支处理用户输入，这是实现命令拦截的最佳位置：
```go
case "input":
    // 在此处添加命令策略检查
    err = sc.sshService.WriteToSession(wsConn.sessionID, []byte(message.Data))
```

### 依赖分析
- 使用现有的 GORM 进行数据库操作
- 复用现有的审计日志记录机制
- 利用 WebSocket 消息机制向前端发送拦截提示

## 架构设计

### 系统架构
```
前端React应用
    ↓ WebSocket
SSH控制器
    ↓ 
命令策略服务 (新增)
    ↓ 检查通过
SSH服务 → 目标主机

    ↓ 检查失败
审计服务 (记录拦截日志)
```

### 模块划分
- **命令策略服务** (`backend/services/command_policy_service.go`): 核心策略管理和检查逻辑
- **命令策略控制器** (`backend/controllers/command_policy_controller.go`): HTTP API接口
- **数据模型** (`backend/models/command_policy.go`): 策略相关数据结构
- **前端页面** (`frontend/src/pages/settings/CommandPolicyPage.tsx`): 策略管理界面

## 核心组件设计

### 组件1: 命令策略服务
- **职责**: 管理命令策略，执行策略检查，维护策略缓存
- **位置**: `backend/services/command_policy_service.go`
- **接口设计**:
  ```go
  type CommandPolicyService interface {
      // 检查命令是否被允许
      CheckCommand(userID uint, command string) (bool, *PolicyViolation)
      // 获取用户的所有策略
      GetUserPolicies(userID uint) ([]*CommandPolicy, error)
      // 管理命令和命令组
      CreateCommand(cmd *Command) error
      CreateCommandGroup(group *CommandGroup) error
      // 用户策略绑定
      BindUserPolicy(userID uint, policyID uint) error
  }
  ```
- **依赖**: 数据库服务、缓存服务、审计服务

### 组件2: SSH控制器改造
- **职责**: 在处理用户输入时调用策略检查
- **位置**: `backend/controllers/ssh_controller.go`
- **修改内容**: 在 `case "input"` 分支添加策略检查逻辑
- **拦截提示**: 返回红色文本 "命令 `xxx` 是被禁止的 ..."

### 组件3: 命令策略控制器
- **职责**: 提供策略管理的HTTP API
- **位置**: `backend/controllers/command_policy_controller.go`
- **接口设计**: RESTful API，支持CRUD操作

## 数据模型设计

### 核心实体
```go
// 命令定义
type Command struct {
    ID          uint      `gorm:"primaryKey"`
    Name        string    `gorm:"size:100;not null;uniqueIndex"`
    Type        string    `gorm:"size:20;default:'exact'"` // exact或regex
    Description string    `gorm:"size:500"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   gorm.DeletedAt
}

// 命令组
type CommandGroup struct {
    ID          uint      `gorm:"primaryKey"`
    Name        string    `gorm:"size:100;not null;uniqueIndex"`
    Description string    `gorm:"size:500"`
    IsPreset    bool      `gorm:"default:false"` // 是否预设组
    Commands    []Command `gorm:"many2many:command_group_commands"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   gorm.DeletedAt
}

// 用户命令策略
type UserCommandPolicy struct {
    ID           uint `gorm:"primaryKey"`
    UserID       uint `gorm:"not null;index"`
    CommandID    *uint `gorm:"index"`
    CommandGroupID *uint `gorm:"index"`
    User         User         `gorm:"foreignKey:UserID"`
    Command      *Command     `gorm:"foreignKey:CommandID"`
    CommandGroup *CommandGroup `gorm:"foreignKey:CommandGroupID"`
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

// 命令拦截日志
type CommandInterceptLog struct {
    ID          uint      `gorm:"primaryKey"`
    SessionID   string    `gorm:"size:100;not null;index"`
    UserID      uint      `gorm:"not null;index"`
    Username    string    `gorm:"size:50;not null"`
    AssetID     uint      `gorm:"not null;index"`
    Command     string    `gorm:"type:text;not null"`
    PolicyType  string    `gorm:"size:20"` // command或command_group
    PolicyID    uint      `gorm:"not null"`
    PolicyName  string    `gorm:"size:100"`
    InterceptTime time.Time `gorm:"not null"`
    CreatedAt   time.Time
}
```

### 数据库表结构
```sql
-- 命令表
CREATE TABLE `commands` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `type` varchar(20) DEFAULT 'exact' COMMENT '匹配类型: exact-精确匹配, regex-正则表达式',
    `description` varchar(500) DEFAULT NULL,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_command_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 命令组表
CREATE TABLE `command_groups` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `description` varchar(500) DEFAULT NULL,
    `is_preset` tinyint(1) DEFAULT 0,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_group_name` (`name`),
    KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 命令组与命令关联表
CREATE TABLE `command_group_commands` (
    `command_group_id` bigint unsigned NOT NULL,
    `command_id` bigint unsigned NOT NULL,
    PRIMARY KEY (`command_group_id`, `command_id`),
    FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`command_id`) REFERENCES `commands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户命令策略表
CREATE TABLE `user_command_policies` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `user_id` bigint unsigned NOT NULL,
    `command_id` bigint unsigned DEFAULT NULL,
    `command_group_id` bigint unsigned DEFAULT NULL,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_command_id` (`command_id`),
    KEY `idx_command_group_id` (`command_group_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`command_id`) REFERENCES `commands`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`command_group_id`) REFERENCES `command_groups`(`id`) ON DELETE CASCADE,
    CONSTRAINT `chk_policy_type` CHECK (
        (`command_id` IS NOT NULL AND `command_group_id` IS NULL) OR
        (`command_id` IS NULL AND `command_group_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 命令拦截日志表
CREATE TABLE `command_intercept_logs` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `session_id` varchar(100) NOT NULL,
    `user_id` bigint unsigned NOT NULL,
    `username` varchar(50) NOT NULL,
    `asset_id` bigint unsigned NOT NULL,
    `command` text NOT NULL,
    `policy_type` varchar(20) NOT NULL,
    `policy_id` bigint unsigned NOT NULL,
    `policy_name` varchar(100) NOT NULL,
    `intercept_time` timestamp NOT NULL,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_intercept_time` (`intercept_time`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## API设计

### REST API路径前缀
所有API路径前缀为 `/api/command-filter`

### REST API端点
```
# 策略管理
GET    /api/command-filter/policies              - 获取策略列表
POST   /api/command-filter/policies              - 创建策略
PUT    /api/command-filter/policies/:id          - 更新策略（含开启/关闭）
DELETE /api/command-filter/policies/:id          - 删除策略

# 命令管理
GET    /api/command-filter/commands              - 获取命令列表
POST   /api/command-filter/commands              - 创建命令
PUT    /api/command-filter/commands/:id          - 更新命令
DELETE /api/command-filter/commands/:id          - 删除命令

# 命令组管理
GET    /api/command-filter/command-groups        - 获取命令组列表
POST   /api/command-filter/command-groups        - 创建命令组
PUT    /api/command-filter/command-groups/:id    - 更新命令组
DELETE /api/command-filter/command-groups/:id    - 删除命令组

# 策略关联
POST   /api/command-filter/policies/:id/bind-users    - 绑定用户到策略
POST   /api/command-filter/policies/:id/bind-commands - 绑定命令/命令组到策略

# 拦截日志
GET    /api/command-filter/intercept-logs        - 获取拦截日志
```

## 文件修改计划

### 新建文件
- `backend/models/command_policy.go` - 命令策略数据模型
- `backend/services/command_policy_service.go` - 命令策略服务
- `backend/controllers/command_policy_controller.go` - 命令策略控制器
- `backend/migrations/20250128_create_command_policy_tables.sql` - 数据库迁移脚本
- `frontend/src/pages/AccessControl/CommandFilterPage.tsx` - 命令过滤主页面
- `frontend/src/components/commandFilter/PolicyTable.tsx` - 策略列表组件
- `frontend/src/components/commandFilter/CommandTable.tsx` - 命令列表组件
- `frontend/src/components/commandFilter/CommandGroupTable.tsx` - 命令组列表组件
- `frontend/src/services/commandFilterService.ts` - 前端API服务

### 修改文件
- `backend/controllers/ssh_controller.go` - 添加命令拦截逻辑
- `backend/routers/router.go` - 添加命令策略路由
- `backend/main.go` - 注册命令策略服务
- `frontend/src/routes/index.tsx` - 添加策略管理页面路由
- `frontend/src/components/layout/SideMenu.tsx` - 添加菜单项

## 错误处理策略
- 策略检查失败：返回友好提示，记录日志，不影响会话
- 缓存失效：降级到数据库查询
- 数据库连接失败：使用默认允许策略，避免影响正常使用

## 性能与安全考虑

### 性能目标
- 命令检查延迟 < 10ms
- 使用内存缓存减少数据库查询
- 批量加载用户策略，减少查询次数

### 安全控制
- 策略管理需要admin权限
- 所有操作记录审计日志
- 防止SQL注入和XSS攻击
- 策略匹配在服务端进行

## 基础测试策略
- 单元测试：策略匹配逻辑、缓存机制
- 集成测试：SSH会话中的命令拦截
- 性能测试：大量策略下的匹配性能
- 安全测试：权限控制、输入验证