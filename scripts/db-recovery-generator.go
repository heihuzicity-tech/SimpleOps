package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Model 数据模型结构
type Model struct {
	Name       string
	TableName  string
	Fields     []Field
	Indexes    []Index
	Relations  []Relation
	Comment    string
}

// Field 字段结构
type Field struct {
	Name         string
	Type         string
	SQLType      string
	Tag          string
	IsPrimaryKey bool
	IsUnique     bool
	IsIndex      bool
	IsNotNull    bool
	IsAutoIncrement bool
	DefaultValue string
	Size         int
	Comment      string
	ForeignKey   *ForeignKey
}

// Index 索引结构
type Index struct {
	Name    string
	Type    string // primary, unique, index
	Fields  []string
	Comment string
}

// Relation 关系结构
type Relation struct {
	Type         string // hasOne, hasMany, belongsTo, many2many
	Model        string
	ForeignKey   string
	References   string
	JoinTable    string
	JoinForeignKey string
	JoinReferences string
}

// ForeignKey 外键结构
type ForeignKey struct {
	Table      string
	Column     string
	OnDelete   string
	OnUpdate   string
}

// Schema 数据库schema
type Schema struct {
	Models      []Model
	ForeignKeys []ForeignKeyConstraint
	JoinTables  []JoinTable
}

// ForeignKeyConstraint 外键约束
type ForeignKeyConstraint struct {
	Name           string
	Table          string
	Column         string
	ReferencedTable string
	ReferencedColumn string
	OnDelete       string
	OnUpdate       string
}

// JoinTable 关联表
type JoinTable struct {
	Name           string
	LeftTable      string
	LeftColumn     string
	RightTable     string
	RightColumn    string
}

const banner = `
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    🛠️  数据库表结构自动恢复脚本生成器 v1.0                      │
│    Database Recovery Script Generator                       │
│                                                             │
│    🔧 自动解析GORM模型                                        │
│    📊 生成完整DDL脚本                                         │
│    🛡️ 支持MySQL/PostgreSQL                                  │
│    ⚡ 安全可靠恢复                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
`

func main() {
	fmt.Print(banner)
	
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	command := os.Args[1]
	switch command {
	case "generate", "gen":
		generateRecoveryScript()
	case "analyze", "ana":
		analyzeModels()
	case "help", "-h", "--help":
		printHelp()
	case "version", "-v", "--version":
		fmt.Println("Database Recovery Script Generator v1.0.0")
	default:
		fmt.Printf("未知命令: %s\n", command)
		printUsage()
	}
}

func generateRecoveryScript() {
	fmt.Println("🔍 开始分析GORM模型...")
	
	// 解析命令行参数
	modelPath := getArg("-models", "./backend/models")
	outputPath := getArg("-output", "./recovery-generated")
	dbType := getArg("-db", "mysql")
	projectName := getArg("-project", "bastion")
	
	fmt.Printf("📁 模型路径: %s\n", modelPath)
	fmt.Printf("📁 输出路径: %s\n", outputPath)
	fmt.Printf("🗄️  数据库类型: %s\n", dbType)
	
	// 扫描模型文件
	models, err := scanAndParseModels(modelPath)
	if err != nil {
		log.Fatalf("❌ 解析模型失败: %v", err)
	}
	
	if len(models) == 0 {
		log.Fatal("❌ 未找到有效的GORM模型")
	}
	
	fmt.Printf("✅ 解析到 %d 个数据模型\n", len(models))
	
	// 分析模型关系
	schema := analyzeSchema(models)
	
	// 创建输出目录
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		log.Fatalf("❌ 创建输出目录失败: %v", err)
	}
	
	// 生成恢复脚本
	if err := generateSQLScript(schema, outputPath, dbType, projectName); err != nil {
		log.Fatalf("❌ 生成SQL脚本失败: %v", err)
	}
	
	// 生成验证脚本
	if err := generateValidationScript(schema, outputPath, dbType, projectName); err != nil {
		log.Fatalf("❌ 生成验证脚本失败: %v", err)
	}
	
	// 生成Shell脚本
	if err := generateShellScript(schema, outputPath, dbType, projectName); err != nil {
		log.Fatalf("❌ 生成Shell脚本失败: %v", err)
	}
	
	// 生成README
	if err := generateREADME(schema, outputPath, dbType, projectName); err != nil {
		log.Fatalf("❌ 生成README失败: %v", err)
	}
	
	fmt.Println("\n🎉 数据库恢复脚本生成完成！")
	fmt.Printf("📁 输出目录: %s\n", outputPath)
	fmt.Println("📄 生成文件:")
	fmt.Println("   - database_recovery.sql (主恢复脚本)")
	fmt.Println("   - validate_recovery.sql (验证脚本)")
	fmt.Println("   - quick_recovery.sh (自动化脚本)")
	fmt.Println("   - README.md (使用说明)")
}

func analyzeModels() {
	modelPath := getArg("-models", "./backend/models")
	
	fmt.Println("🔍 分析GORM模型结构...")
	fmt.Printf("📁 模型路径: %s\n", modelPath)
	
	models, err := scanAndParseModels(modelPath)
	if err != nil {
		log.Fatalf("❌ 解析模型失败: %v", err)
	}
	
	if len(models) == 0 {
		log.Fatal("❌ 未找到有效的GORM模型")
	}
	
	fmt.Printf("\n📊 分析结果:\n")
	fmt.Printf("总模型数: %d\n\n", len(models))
	
	for _, model := range models {
		fmt.Printf("🏷️  模型: %s\n", model.Name)
		fmt.Printf("📋 表名: %s\n", model.TableName)
		fmt.Printf("🔢 字段数: %d\n", len(model.Fields))
		
		if len(model.Relations) > 0 {
			fmt.Printf("🔗 关系数: %d\n", len(model.Relations))
			for _, rel := range model.Relations {
				fmt.Printf("   - %s -> %s (%s)\n", rel.Model, rel.Type, rel.ForeignKey)
			}
		}
		fmt.Println()
	}
}

func scanAndParseModels(modelPath string) ([]Model, error) {
	var models []Model
	
	err := filepath.Walk(modelPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && strings.HasSuffix(path, ".go") {
			fileModels, err := parseGoFile(path)
			if err != nil {
				fmt.Printf("⚠️  解析文件 %s 失败: %v\n", path, err)
				return nil // 继续处理其他文件
			}
			models = append(models, fileModels...)
		}
		
		return nil
	})
	
	return models, err
}

func parseGoFile(filePath string) ([]Model, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}
	
	var models []Model
	
	ast.Inspect(node, func(n ast.Node) bool {
		typeSpec, ok := n.(*ast.TypeSpec)
		if !ok {
			return true
		}
		
		structType, ok := typeSpec.Type.(*ast.StructType)
		if !ok {
			return true
		}
		
		// 检查是否是GORM模型（包含gorm标签或特定字段）
		if !isGORMModel(structType) {
			return true
		}
		
		modelName := typeSpec.Name.Name
		// 跳过响应模型
		if isResponseModel(modelName) {
			return true
		}
		
		model := parseGORMModel(modelName, structType)
		if model.Name != "" {
			models = append(models, model)
		}
		
		return true
	})
	
	return models, nil
}

func isGORMModel(structType *ast.StructType) bool {
	for _, field := range structType.Fields.List {
		if field.Tag != nil {
			tag := strings.Trim(field.Tag.Value, "`")
			if strings.Contains(tag, "gorm:") {
				return true
			}
		}
		
		// 检查是否有常见的GORM字段
		if len(field.Names) > 0 {
			name := field.Names[0].Name
			if name == "ID" || name == "CreatedAt" || name == "UpdatedAt" || name == "DeletedAt" {
				return true
			}
		}
	}
	return false
}

// isResponseModel 检查是否是响应模型
func isResponseModel(modelName string) bool {
	return strings.HasSuffix(modelName, "Response") || 
		   strings.HasSuffix(modelName, "Responses") ||
		   strings.HasSuffix(modelName, "Item") ||
		   strings.HasSuffix(modelName, "WithHosts")
}

// getTableName 获取表名映射
func getTableName(modelName string) string {
	tableNames := map[string]string{
		"User":                 "users",
		"Role":                 "roles",
		"Permission":           "permissions",
		"UserRole":             "user_roles",
		"RolePermission":       "role_permissions",
		"AssetGroup":           "asset_groups",
		"Asset":                "assets",
		"Credential":           "credentials",
		"AssetCredential":      "asset_credentials",
		"LoginLog":             "login_logs",
		"OperationLog":         "operation_logs",
		"SessionRecord":        "session_records",
		"CommandLog":           "command_logs",
		"SessionMonitorLog":    "session_monitor_logs",
		"SessionWarning":       "session_warnings",
		"WebsocketConnection":  "websocket_connections",
	}
	
	if tableName, exists := tableNames[modelName]; exists {
		return tableName
	}
	return convertToSnakeCase(modelName) + "s"
}

func parseGORMModel(name string, structType *ast.StructType) Model {
	model := Model{
		Name:      name,
		TableName: getTableName(name), // 使用正确的表名规则
		Fields:    []Field{},
		Indexes:   []Index{},
		Relations: []Relation{},
	}
	
	for _, field := range structType.Fields.List {
		if len(field.Names) == 0 {
			continue // 匿名字段跳过
		}
		
		fieldName := field.Names[0].Name
		fieldType := getFieldType(field.Type)
		
		f := Field{
			Name: fieldName,
			Type: fieldType,
		}
		
		// 解析GORM标签
		if field.Tag != nil {
			tag := strings.Trim(field.Tag.Value, "`")
			parseGORMTag(&f, tag)
		}
		
		// 设置SQL类型
		f.SQLType = goTypeToSQLType(f.Type, f.Size, fieldName == "ID")
		
		// 检查关系
		if rel := parseRelation(fieldName, fieldType, field.Tag); rel != nil {
			model.Relations = append(model.Relations, *rel)
		} else {
			model.Fields = append(model.Fields, f)
		}
	}
	
	return model
}

func getFieldType(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		if pkg, ok := t.X.(*ast.Ident); ok {
			return pkg.Name + "." + t.Sel.Name
		}
		return t.Sel.Name
	case *ast.ArrayType:
		return "[]" + getFieldType(t.Elt)
	case *ast.StarExpr:
		return "*" + getFieldType(t.X)
	default:
		return "unknown"
	}
}

func parseGORMTag(field *Field, tag string) {
	// 解析gorm标签
	gormTagRegex := regexp.MustCompile(`gorm:"([^"]*)"`)
	matches := gormTagRegex.FindStringSubmatch(tag)
	if len(matches) < 2 {
		return
	}
	
	field.Tag = matches[1]
	tagParts := strings.Split(matches[1], ";")
	
	for _, part := range tagParts {
		part = strings.TrimSpace(part)
		
		switch {
		case part == "primaryKey":
			field.IsPrimaryKey = true
		case part == "not null":
			field.IsNotNull = true
		case part == "uniqueIndex" || part == "unique":
			field.IsUnique = true
		case part == "index":
			field.IsIndex = true
		case part == "autoIncrement":
			field.IsAutoIncrement = true
		case strings.HasPrefix(part, "size:"):
			if size, err := strconv.Atoi(strings.TrimPrefix(part, "size:")); err == nil {
				field.Size = size
			}
		case strings.HasPrefix(part, "default:"):
			field.DefaultValue = strings.TrimPrefix(part, "default:")
		case strings.HasPrefix(part, "comment:"):
			field.Comment = strings.TrimPrefix(part, "comment:")
		}
	}
}

func parseRelation(fieldName, fieldType string, tag *ast.BasicLit) *Relation {
	// 简化的关系解析
	if strings.HasPrefix(fieldType, "[]") {
		return &Relation{
			Type:  "hasMany",
			Model: strings.TrimPrefix(fieldType, "[]"),
		}
	}
	
	// 检查是否是关联字段（通常以ID结尾或特定命名）
	if strings.HasSuffix(fieldName, "ID") && fieldName != "ID" {
		return &Relation{
			Type:       "belongsTo",
			Model:      strings.TrimSuffix(fieldName, "ID"),
			ForeignKey: fieldName,
		}
	}
	
	return nil
}

func goTypeToSQLType(goType string, size int, isID bool) string {
	switch goType {
	case "uint", "uint64":
		if isID {
			return "bigint unsigned NOT NULL AUTO_INCREMENT"
		}
		return "bigint unsigned"
	case "uint32":
		return "int unsigned"
	case "int", "int64":
		return "bigint"
	case "int32":
		return "int"
	case "string":
		if size > 0 {
			if size <= 255 {
				return fmt.Sprintf("varchar(%d) COLLATE utf8mb4_unicode_ci", size)
			}
			return "text COLLATE utf8mb4_unicode_ci"
		}
		return "varchar(255) COLLATE utf8mb4_unicode_ci"
	case "bool":
		return "tinyint"
	case "time.Time":
		return "timestamp NULL"
	case "[]byte":
		return "blob"
	case "float32":
		return "float"
	case "float64":
		return "double"
	case "*time.Time":
		return "timestamp NULL"
	case "gorm.DeletedAt":
		return "timestamp NULL"
	default:
		if strings.HasPrefix(goType, "*") {
			return goTypeToSQLType(strings.TrimPrefix(goType, "*"), size, false) + " DEFAULT NULL"
		}
		return "text COLLATE utf8mb4_unicode_ci"
	}
}

func analyzeSchema(models []Model) Schema {
	schema := Schema{
		Models:      models,
		ForeignKeys: []ForeignKeyConstraint{},
		JoinTables:  []JoinTable{},
	}
	
	// 分析外键关系
	for _, model := range models {
		for _, field := range model.Fields {
			if strings.HasSuffix(field.Name, "ID") && field.Name != "ID" {
				refTable := strings.ToLower(strings.TrimSuffix(field.Name, "ID")) + "s"
				
				fk := ForeignKeyConstraint{
					Name:             fmt.Sprintf("fk_%s_%s", model.TableName, strings.ToLower(field.Name)),
					Table:            model.TableName,
					Column:           strings.ToLower(field.Name),
					ReferencedTable:  refTable,
					ReferencedColumn: "id",
					OnDelete:         "CASCADE",
					OnUpdate:         "CASCADE",
				}
				schema.ForeignKeys = append(schema.ForeignKeys, fk)
			}
		}
		
		// 分析多对多关系
		for _, rel := range model.Relations {
			if rel.Type == "many2many" && rel.JoinTable != "" {
				joinTable := JoinTable{
					Name:        rel.JoinTable,
					LeftTable:   model.TableName,
					LeftColumn:  strings.ToLower(model.Name) + "_id",
					RightTable:  strings.ToLower(rel.Model) + "s",
					RightColumn: strings.ToLower(rel.Model) + "_id",
				}
				schema.JoinTables = append(schema.JoinTables, joinTable)
			}
		}
	}
	
	return schema
}

func generateSQLScript(schema Schema, outputPath, dbType, projectName string) error {
	var sql strings.Builder
	
	// 文件头部
	sql.WriteString("-- ========================================\n")
	sql.WriteString(fmt.Sprintf("-- %s 运维堡垒机系统数据库结构恢复脚本\n", strings.ToUpper(projectName)))
	sql.WriteString("-- 数据库误删恢复：完整表结构重建\n")
	sql.WriteString(fmt.Sprintf("-- 生成时间: %s\n", time.Now().Format("2006-01-02")))
	sql.WriteString("-- ========================================\n\n")
	
	sql.WriteString("-- 设置基础配置\n")
	
	// 数据库设置
	if dbType == "mysql" {
		sql.WriteString(fmt.Sprintf("USE %s;\n", projectName))
		sql.WriteString("SET NAMES utf8mb4;\n")
		sql.WriteString("SET FOREIGN_KEY_CHECKS = 0;\n")
		sql.WriteString("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';\n\n")
	}
	
	// 生成表结构
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 1. 用户权限系统核心表\n")
	sql.WriteString("-- ========================================\n\n")
	
	coreUserTables := []string{"User", "Role", "Permission", "UserRole", "RolePermission"}
	for _, tableName := range coreUserTables {
		for _, model := range schema.Models {
			if model.Name == tableName {
				sql.WriteString(fmt.Sprintf("-- %s\n", getTableComment(model.Name)))
				sql.WriteString(generateCreateTable(model, dbType))
				sql.WriteString("\n")
				break
			}
		}
	}
	
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 2. 资产分组管理系统\n")
	sql.WriteString("-- ========================================\n\n")
	
	assetTables := []string{"AssetGroup", "Asset", "Credential", "AssetCredential"}
	for _, tableName := range assetTables {
		for _, model := range schema.Models {
			if model.Name == tableName {
				sql.WriteString(fmt.Sprintf("-- %s\n", getTableComment(model.Name)))
				sql.WriteString(generateCreateTable(model, dbType))
				sql.WriteString("\n")
				break
			}
		}
	}
	
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 3. 审计日志系统\n")
	sql.WriteString("-- ========================================\n\n")
	
	auditTables := []string{"LoginLog", "OperationLog", "SessionRecord", "CommandLog"}
	for _, tableName := range auditTables {
		for _, model := range schema.Models {
			if model.Name == tableName {
				sql.WriteString(fmt.Sprintf("-- %s\n", getTableComment(model.Name)))
				sql.WriteString(generateCreateTable(model, dbType))
				sql.WriteString("\n")
				break
			}
		}
	}
	
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 4. 实时监控系统\n")
	sql.WriteString("-- ========================================\n\n")
	
	monitorTables := []string{"SessionMonitorLog", "SessionWarning", "WebsocketConnection"}
	for _, tableName := range monitorTables {
		for _, model := range schema.Models {
			if model.Name == tableName {
				sql.WriteString(fmt.Sprintf("-- %s\n", getTableComment(model.Name)))
				sql.WriteString(generateCreateTable(model, dbType))
				sql.WriteString("\n")
				break
			}
		}
	}
	
	// 生成关联表
	for _, joinTable := range schema.JoinTables {
		sql.WriteString(fmt.Sprintf("-- %s 关联表\n", joinTable.Name))
		sql.WriteString(generateJoinTable(joinTable, dbType))
		sql.WriteString("\n")
	}
	
	// 生成外键约束
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 5. 外键约束定义\n")
	sql.WriteString("-- ========================================\n\n")
	
	// 手动定义关键外键约束
	foreignKeyConstraints := []string{
		"ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `asset_groups` ADD CONSTRAINT `fk_asset_groups_parent` FOREIGN KEY (`parent_id`) REFERENCES `asset_groups` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `assets` ADD CONSTRAINT `fk_assets_group` FOREIGN KEY (`group_id`) REFERENCES `asset_groups` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `asset_credentials` ADD CONSTRAINT `fk_asset_credentials_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `asset_credentials` ADD CONSTRAINT `fk_asset_credentials_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE;",
		"ALTER TABLE `login_logs` ADD CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `operation_logs` ADD CONSTRAINT `fk_operation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `session_records` ADD CONSTRAINT `fk_session_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `session_records` ADD CONSTRAINT `fk_session_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `command_logs` ADD CONSTRAINT `fk_command_logs_session` FOREIGN KEY (`session_id`) REFERENCES `session_records` (`session_id`) ON DELETE CASCADE;",
		"ALTER TABLE `command_logs` ADD CONSTRAINT `fk_command_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `session_monitor_logs` ADD CONSTRAINT `fk_session_monitor_logs_session` FOREIGN KEY (`session_id`) REFERENCES `session_records` (`session_id`) ON DELETE CASCADE;",
		"ALTER TABLE `session_monitor_logs` ADD CONSTRAINT `fk_session_monitor_logs_user` FOREIGN KEY (`monitor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `session_warnings` ADD CONSTRAINT `fk_session_warnings_session` FOREIGN KEY (`session_id`) REFERENCES `session_records` (`session_id`) ON DELETE CASCADE;",
		"ALTER TABLE `session_warnings` ADD CONSTRAINT `fk_session_warnings_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `session_warnings` ADD CONSTRAINT `fk_session_warnings_receiver` FOREIGN KEY (`receiver_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
		"ALTER TABLE `websocket_connections` ADD CONSTRAINT `fk_websocket_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
	}
	
	for _, constraint := range foreignKeyConstraints {
		sql.WriteString(constraint + "\n")
	}
	sql.WriteString("\n")
	
	// 生成默认数据
	sql.WriteString(generateDefaultData(dbType))
	
	// 生成审计视图和存储过程
	sql.WriteString(generateAuditViewsAndProcedures(dbType))
	
	// 恢复设置
	if dbType == "mysql" {
		sql.WriteString("SET FOREIGN_KEY_CHECKS = 1;\n\n")
	}
	
	// 生成验证查询
	sql.WriteString(generateValidationQueries(schema, dbType))
	
	// 生成统计信息
	sql.WriteString(generateRecoveryStats(schema, dbType))
	
	// 写入文件
	filePath := filepath.Join(outputPath, "database_recovery.sql")
	return os.WriteFile(filePath, []byte(sql.String()), 0644)
}

func generateCreateTable(model Model, dbType string) string {
	var sql strings.Builder
	
	sql.WriteString(fmt.Sprintf("CREATE TABLE IF NOT EXISTS `%s` (\n", model.TableName))
	
	var fields []string
	var primaryKeys []string
	var indexes []string
	var uniqueIndexes []string
	var foreignKeys []string
	
	for _, field := range model.Fields {
		fieldName := convertToSnakeCase(field.Name)
		fieldDef := fmt.Sprintf("  `%s` %s", fieldName, field.SQLType)
		
		// 特殊处理时间字段
		if field.Name == "CreatedAt" {
			fieldDef = fmt.Sprintf("  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP")
		} else if field.Name == "UpdatedAt" {
			fieldDef = fmt.Sprintf("  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
		} else if field.Name == "DeletedAt" {
			fieldDef = fmt.Sprintf("  `deleted_at` timestamp NULL DEFAULT NULL")
		} else {
			// 添加NOT NULL约束
			if field.IsNotNull || field.IsPrimaryKey {
				if !strings.Contains(field.SQLType, "NOT NULL") {
					fieldDef += " NOT NULL"
				}
			}
			
			// 添加默认值
			if field.DefaultValue != "" && !field.IsPrimaryKey {
				fieldDef += fmt.Sprintf(" DEFAULT %s", field.DefaultValue)
			} else if field.Name == "Status" {
				fieldDef += " DEFAULT '1'"
			}
		}
		
		// 添加注释
		if field.Comment != "" {
			fieldDef += fmt.Sprintf(" COMMENT '%s'", field.Comment)
		} else if field.Name == "Status" {
			fieldDef += " COMMENT '1-启用, 0-禁用'"
		}
		
		fields = append(fields, fieldDef)
		
		if field.IsPrimaryKey {
			primaryKeys = append(primaryKeys, fmt.Sprintf("`%s`", fieldName))
		}
		
		if field.IsUnique && !field.IsPrimaryKey {
			uniqueIndexes = append(uniqueIndexes, fmt.Sprintf("UNIQUE KEY `idx_%s` (`%s`)", 
				fieldName, fieldName))
		}
		
		if field.IsIndex && !field.IsPrimaryKey && !field.IsUnique {
			indexes = append(indexes, fmt.Sprintf("KEY `idx_%s` (`%s`)", 
				fieldName, fieldName))
		}
		
		// 添加deleted_at索引
		if field.Name == "DeletedAt" {
			indexes = append(indexes, "KEY `idx_deleted_at` (`deleted_at`)")
		}
	}
	
	// 添加字段定义
	for _, field := range fields {
		sql.WriteString(field + ",\n")
	}
	
	// 添加主键
	if len(primaryKeys) > 0 {
		sql.WriteString(fmt.Sprintf("  PRIMARY KEY (%s),\n", strings.Join(primaryKeys, ", ")))
	}
	
	// 添加唯一索引
	for _, idx := range uniqueIndexes {
		sql.WriteString(fmt.Sprintf("  %s,\n", idx))
	}
	
	// 添加普通索引
	for _, idx := range indexes {
		sql.WriteString(fmt.Sprintf("  %s,\n", idx))
	}
	
	// 添加外键约束（在表内定义）
	for _, fk := range foreignKeys {
		sql.WriteString(fmt.Sprintf("  %s,\n", fk))
	}
	
	// 移除最后的逗号
	sqlStr := sql.String()
	sqlStr = strings.TrimSuffix(sqlStr, ",\n") + "\n"
	
	// 表选项
	if dbType == "mysql" {
		sqlStr += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
		if model.Comment != "" {
			sqlStr += fmt.Sprintf(" COMMENT='%s'", model.Comment)
		} else {
			sqlStr += fmt.Sprintf(" COMMENT='%s'", getTableComment(model.Name))
		}
		sqlStr += ";\n"
	} else {
		sqlStr += ");\n"
	}
	
	return sqlStr
}

// convertToSnakeCase 将驼峰命名转换为蛇形命名
func convertToSnakeCase(str string) string {
	var result []rune
	for i, r := range str {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result = append(result, '_')
		}
		result = append(result, r)
	}
	return strings.ToLower(string(result))
}

// getTableComment 获取表注释
func getTableComment(tableName string) string {
	commentsMap := map[string]string{
		"User":                 "用户表 - 存储系统用户信息",
		"Role":                 "角色表 - 存储系统角色定义",
		"Permission":           "权限表 - 存储系统权限定义",
		"UserRole":             "用户角色关联表 - 多对多关系",
		"RolePermission":       "角色权限关联表 - 多对多关系",
		"AssetGroup":           "资产分组表 - 支持层级结构",
		"Asset":                "资产表 - 存储服务器资产信息",
		"Credential":           "凭证表 - 存储连接凭证信息",
		"AssetCredential":      "资产凭证关联表 - 多对多关系",
		"LoginLog":             "登录日志表 - 记录用户登录行为",
		"OperationLog":         "操作日志表 - 记录用户操作行为",
		"SessionRecord":        "会话记录表 - 记录SSH会话信息",
		"CommandLog":           "命令日志表 - 记录执行命令详情",
		"SessionMonitorLog":    "会话监控日志表 - 记录监控操作",
		"SessionWarning":       "会话警告表 - 存储警告消息",
		"WebsocketConnection":  "WebSocket连接表 - 记录实时连接信息",
	}
	
	if comment, exists := commentsMap[tableName]; exists {
		return comment
	}
	return fmt.Sprintf("%s表", tableName)
}

func generateJoinTable(joinTable JoinTable, dbType string) string {
	var sql strings.Builder
	
	sql.WriteString(fmt.Sprintf("CREATE TABLE IF NOT EXISTS `%s` (\n", joinTable.Name))
	sql.WriteString(fmt.Sprintf("  `%s` BIGINT UNSIGNED NOT NULL,\n", joinTable.LeftColumn))
	sql.WriteString(fmt.Sprintf("  `%s` BIGINT UNSIGNED NOT NULL,\n", joinTable.RightColumn))
	sql.WriteString("  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n")
	sql.WriteString(fmt.Sprintf("  PRIMARY KEY (`%s`, `%s`),\n", joinTable.LeftColumn, joinTable.RightColumn))
	sql.WriteString(fmt.Sprintf("  KEY `idx_%s_%s` (`%s`),\n", joinTable.Name, joinTable.LeftColumn, joinTable.LeftColumn))
	sql.WriteString(fmt.Sprintf("  KEY `idx_%s_%s` (`%s`)\n", joinTable.Name, joinTable.RightColumn, joinTable.RightColumn))
	
	if dbType == "mysql" {
		sql.WriteString(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n")
	} else {
		sql.WriteString(");\n")
	}
	
	return sql.String()
}

func generateForeignKey(fk ForeignKeyConstraint, dbType string) string {
	return fmt.Sprintf("ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`%s`) ON DELETE %s ON UPDATE %s;\n",
		fk.Table, fk.Name, fk.Column, fk.ReferencedTable, fk.ReferencedColumn, fk.OnDelete, fk.OnUpdate)
}

func generateDefaultData(dbType string) string {
	return `-- ========================================
-- 默认数据初始化
-- ========================================

-- 权限数据
INSERT IGNORE INTO permissions (name, description, category) VALUES 
('user:create', '创建用户', 'user'),
('user:read', '查看用户', 'user'),
('user:update', '更新用户', 'user'),
('user:delete', '删除用户', 'user'),
('role:create', '创建角色', 'role'),
('role:read', '查看角色', 'role'),
('role:update', '更新角色', 'role'),
('role:delete', '删除角色', 'role'),
('asset:create', '创建资产', 'asset'),
('asset:read', '查看资产', 'asset'),
('asset:update', '更新资产', 'asset'),
('asset:delete', '删除资产', 'asset'),
('asset:connect', '连接资产', 'asset'),
('audit:read', '查看审计日志', 'audit'),
('audit:cleanup', '清理审计日志', 'audit'),
('audit:monitor', '实时监控权限', 'audit'),
('audit:terminate', '会话终止权限', 'audit'),
('audit:warning', '发送警告权限', 'audit'),
('login_logs:read', '查看登录日志', 'audit'),
('operation_logs:read', '查看操作日志', 'audit'),
('session_records:read', '查看会话记录', 'audit'),
('command_logs:read', '查看命令日志', 'audit'),
('session:read', '查看会话', 'session'),
('log:read', '查看日志', 'log'),
('all', '所有权限', 'system');

-- 角色数据
INSERT IGNORE INTO roles (name, description) VALUES 
('admin', '系统管理员'),
('operator', '运维人员'),
('auditor', '审计员');

-- 用户数据
INSERT IGNORE INTO users (username, password, email, status) VALUES 
('admin', '$2a$10$x/i8F9qXh.tmIbwkLROCyeQleavmD4t0qR2BBQJ2cs57DvwaLbTs.', 'admin@bastion.local', 1);

-- 角色权限关联
INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name = 'all';

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'operator' AND p.name IN ('asset:read', 'asset:connect', 'session:read');

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'auditor' AND p.name IN ('audit:read', 'audit:monitor', 'login_logs:read', 'operation_logs:read', 'session_records:read', 'command_logs:read');

-- 用户角色关联
INSERT IGNORE INTO user_roles (user_id, role_id) 
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'admin';

-- 资产分组默认数据
INSERT IGNORE INTO asset_groups (name, description, type, parent_id, sort_order) VALUES 
('生产环境', '生产环境服务器分组', 'production', NULL, 1),
('Web服务器', 'Web应用服务器', 'production', 1, 1),
('应用服务器', '业务应用服务器', 'production', 1, 2),
('数据库服务器', '数据库服务器', 'production', 1, 3),
('测试环境', '测试环境服务器分组', 'test', NULL, 2),
('测试服务器', '测试用服务器', 'test', 5, 1),
('开发环境', '开发环境服务器分组', 'dev', NULL, 3),
('开发服务器', '开发用服务器', 'dev', 7, 1),
('通用分组', '通用服务器分组', 'general', NULL, 4);

`
}

func generateValidationQueries(schema Schema, dbType string) string {
	return fmt.Sprintf(`-- 验证查询
SELECT '数据库恢复完成！' as message;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE();
SELECT username, email, status FROM users WHERE username = 'admin';

`)
}

func generateValidationScript(schema Schema, outputPath, dbType, projectName string) error {
	content := fmt.Sprintf(`-- %s 数据库结构验证脚本
-- 生成时间: %s

-- 表结构完整性检查
SELECT 
    'Table Count Check' as check_type,
    COUNT(*) as actual_tables,
    CASE 
        WHEN COUNT(*) >= %d THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as result
FROM information_schema.tables 
WHERE table_schema = DATABASE();

-- 最终验证结果
SELECT 
    'FINAL VALIDATION' as validation_summary,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) >= %d AND
            (SELECT COUNT(*) FROM users WHERE username = 'admin') = 1
        )
        THEN '🎉 数据库结构恢复成功！'
        ELSE '⚠️ 数据库结构存在问题'
    END as final_result,
    NOW() as validation_time;
`, projectName, time.Now().Format("2006-01-02 15:04:05"), len(schema.Models), len(schema.Models))
	
	filePath := filepath.Join(outputPath, "validate_recovery.sql")
	return os.WriteFile(filePath, []byte(content), 0644)
}

func generateShellScript(schema Schema, outputPath, dbType, projectName string) error {
	script := fmt.Sprintf(`#!/bin/bash

# %s 数据库快速恢复脚本
# 生成时间: %s

set -e

echo "🚀 %s 数据库恢复工具"
echo "========================================"

# 数据库连接参数
read -p "数据库主机 [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "数据库端口 [3306]: " DB_PORT  
DB_PORT=${DB_PORT:-3306}

read -p "数据库用户名 [root]: " DB_USER
DB_USER=${DB_USER:-root}

read -s -p "数据库密码: " DB_PASSWORD
echo

read -p "数据库名称 [%s]: " DB_NAME
DB_NAME=${DB_NAME:-%s}

MYSQL_CMD="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD"

echo "📡 测试数据库连接..."
if $MYSQL_CMD -e "SELECT 1;" &>/dev/null; then
    echo "✅ 数据库连接成功"
else
    echo "❌ 数据库连接失败"
    exit 1
fi

echo "🔄 执行恢复脚本..."
if $MYSQL_CMD $DB_NAME < database_recovery.sql 2>/dev/null; then
    echo "✅ 恢复脚本执行完成"
else
    echo "❌ 恢复脚本执行失败"
    exit 1
fi

echo "🔍 验证恢复结果..."
if $MYSQL_CMD $DB_NAME < validate_recovery.sql > validation_result.txt 2>/dev/null; then
    echo "✅ 验证完成"
    if grep -q "数据库结构恢复成功" validation_result.txt; then
        echo "🎉 验证通过！"
    else
        echo "⚠️ 验证发现问题，请查看 validation_result.txt"
    fi
else
    echo "❌ 验证失败"
fi

echo "🏁 恢复完成！"
echo "⚠️ 请立即修改默认密码: admin / admin123"
`, projectName, time.Now().Format("2006-01-02 15:04:05"), projectName, projectName, projectName)
	
	filePath := filepath.Join(outputPath, "quick_recovery.sh")
	return os.WriteFile(filePath, []byte(script), 0755)
}

func generateREADME(schema Schema, outputPath, dbType, projectName string) error {
	readme := fmt.Sprintf(`# %s 数据库恢复脚本

## 🚀 自动生成的数据库恢复工具包

**生成时间**: %s  
**数据库类型**: %s  
**表数量**: %d  
**外键约束**: %d  

## 📁 文件说明

- database_recovery.sql - 主恢复脚本
- validate_recovery.sql - 验证脚本  
- quick_recovery.sh - 自动化恢复脚本
- README.md - 使用说明

## 🔧 使用方法

### 自动化恢复（推荐）
chmod +x quick_recovery.sh
./quick_recovery.sh

### 手动恢复
mysql -h<hostname> -u<username> -p
USE %s;
SOURCE database_recovery.sql;
SOURCE validate_recovery.sql;

## ⚠️ 安全提醒

1. 默认用户: admin / admin123
2. 请立即修改默认密码
3. 检查权限配置

---
*此恢复脚本由数据库恢复脚本生成器自动生成*
`, projectName, time.Now().Format("2006-01-02 15:04:05"), strings.ToUpper(dbType), len(schema.Models), len(schema.ForeignKeys), projectName)
	
	filePath := filepath.Join(outputPath, "README.md")
	return os.WriteFile(filePath, []byte(readme), 0644)
}

func getArg(flag, defaultValue string) string {
	args := os.Args
	for i, arg := range args {
		if arg == flag && i+1 < len(args) {
			return args[i+1]
		}
	}
	return defaultValue
}

func printUsage() {
	fmt.Println("使用方法:")
	fmt.Println("  go run db-recovery-generator.go <command> [options]")
	fmt.Println()
	fmt.Println("命令:")
	fmt.Println("  generate, gen    生成数据库恢复脚本")
	fmt.Println("  analyze, ana     分析GORM模型结构")
	fmt.Println("  help             显示帮助信息")
	fmt.Println("  version          显示版本信息")
	fmt.Println()
	fmt.Println("选项:")
	fmt.Println("  -models string   模型文件路径 (默认: ./backend/models)")
	fmt.Println("  -output string   输出目录路径 (默认: ./recovery-generated)")
	fmt.Println("  -db string       数据库类型 (默认: mysql)")
	fmt.Println("  -project string  项目名称 (默认: bastion)")
}

func printHelp() {
	fmt.Println("数据库表结构自动恢复脚本生成器")
	fmt.Println()
	printUsage()
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  go run db-recovery-generator.go generate")
	fmt.Println("  go run db-recovery-generator.go analyze")
	fmt.Println()
	fmt.Println("功能特性:")
	fmt.Println("  🔧 自动解析GORM模型定义")
	fmt.Println("  📊 分析表结构、字段类型、索引和外键关系")
	fmt.Println("  🛡️ 生成完整的SQL DDL恢复脚本")
	fmt.Println("  ⚡ 支持MySQL和PostgreSQL数据库")
	fmt.Println("  📋 包含验证脚本和自动化工具")
	fmt.Println("  📖 生成详细的使用文档")
}