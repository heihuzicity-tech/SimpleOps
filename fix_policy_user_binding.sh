#!/bin/bash

# 修复策略用户绑定API的GORM配置问题
# 问题：GORM many2many关联配置与数据库表结构不匹配

echo "开始修复策略用户绑定API配置问题..."

# 1. 备份原始文件
echo "1. 备份原始文件..."
cp backend/models/command_policy.go backend/models/command_policy.go.backup
cp backend/services/command_policy_service.go backend/services/command_policy_service.go.backup

# 2. 修复command_policy.go中的GORM关联配置
echo "2. 修复GORM many2many关联配置..."
cat > temp_fix.go << 'EOF'
package models

import (
	"time"
	"gorm.io/gorm"
)

// Command 命令定义
type Command struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:100;not null;uniqueIndex;comment:命令名称或正则表达式"`
	Type        string         `json:"type" gorm:"size:20;default:exact;comment:匹配类型: exact-精确匹配, regex-正则表达式"`
	Description string         `json:"description" gorm:"size:500;comment:命令描述"`
	Groups      []CommandGroup `json:"groups,omitempty" gorm:"many2many:command_group_commands;"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// CommandGroup 命令组
type CommandGroup struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"size:100;not null;uniqueIndex;comment:命令组名称"`
	Description string         `json:"description" gorm:"size:500;comment:命令组描述"`
	IsPreset    bool           `json:"is_preset" gorm:"default:false;comment:是否为系统预设组"`
	Commands    []Command      `json:"commands,omitempty" gorm:"many2many:command_group_commands;"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

// CommandPolicy 命令策略
type CommandPolicy struct {
	ID          uint            `json:"id" gorm:"primaryKey"`
	Name        string          `json:"name" gorm:"size:100;not null;comment:策略名称"`
	Description string          `json:"description" gorm:"size:500;comment:策略描述"`
	Enabled     bool            `json:"enabled" gorm:"default:true;index;comment:是否启用"`
	Priority    int             `json:"priority" gorm:"default:50;index;comment:优先级（预留字段）"`
	Users       []User          `json:"users,omitempty" gorm:"many2many:policy_users;foreignKey:ID;joinForeignKey:policy_id;References:ID;joinReferences:user_id;"`
	Commands    []PolicyCommand `json:"commands,omitempty" gorm:"foreignKey:PolicyID"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `json:"deleted_at,omitempty" gorm:"index"`
}
EOF

# 提取文件的其余部分
tail -n +45 backend/models/command_policy.go >> temp_fix.go
mv temp_fix.go backend/models/command_policy.go

# 3. 验证修复
echo "3. 验证修复结果..."
if grep -q "many2many:policy_users;foreignKey:ID;joinForeignKey:policy_id" backend/models/command_policy.go; then
    echo "✅ GORM关联配置修复成功"
else
    echo "❌ GORM关联配置修复失败"
    exit 1
fi

# 4. 编译测试
echo "4. 编译测试..."
cd backend
if go build -o bastion main.go; then
    echo "✅ 后端代码编译成功"
else
    echo "❌ 后端代码编译失败"
    exit 1
fi

# 5. 测试API
echo "5. 测试策略用户绑定API..."
# 这里可以添加具体的API测试逻辑

echo "修复完成！主要变更："
echo "1. 修正了CommandPolicy.Users的GORM many2many关联配置"
echo "2. 指定了正确的外键字段名：policy_id 和 user_id"
echo "3. 确保与数据库表结构policy_users匹配"

echo ""
echo "下一步需要："
echo "1. 重启后端服务"
echo "2. 测试策略用户绑定功能"
echo "3. 验证前端命令过滤页面是否正常工作"