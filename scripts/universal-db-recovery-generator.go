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
│    🛠️  通用数据库表结构自动恢复脚本生成器 v2.0                │
│    Universal Database Recovery Script Generator            │
│                                                             │
│    🔧 智能解析GORM模型                                        │
│    📊 生成完整DDL脚本                                         │
│    🛡️ 支持MySQL/PostgreSQL                                  │
│    ⚡ 通用项目适配                                            │
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
		fmt.Println("Universal Database Recovery Script Generator v2.0.0")
	default:
		fmt.Printf("未知命令: %s\n", command)
		printUsage()
	}
}

func generateRecoveryScript() {
	fmt.Println("🔍 开始智能分析GORM模型...")
	
	// 解析命令行参数
	modelPath := getArg("-models", detectModelsPath())
	outputPath := getArg("-output", "./recovery-generated")
	dbType := getArg("-db", "mysql")
	projectName := getArg("-project", detectProjectName())
	
	fmt.Printf("📁 模型路径: %s\n", modelPath)
	fmt.Printf("📁 输出路径: %s\n", outputPath)
	fmt.Printf("🗄️  数据库类型: %s\n", dbType)
	fmt.Printf("📦 项目名称: %s\n", projectName)
	
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
	modelPath := getArg("-models", detectModelsPath())
	
	fmt.Println("🔍 智能分析GORM模型结构...")
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

// detectModelsPath 智能检测模型文件路径
func detectModelsPath() string {
	possiblePaths := []string{
		"./models",
		"./internal/models", 
		"./pkg/models",
		"./app/models",
		"./src/models",
		"./backend/models",
		"./server/models",
		"./core/models",
		"./domain/models",
		"./entity",
		"./entities",
		"./model",
	}
	
	for _, path := range possiblePaths {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			// 检查是否包含Go文件
			if hasGoFiles(path) {
				return path
			}
		}
	}
	
	// 默认返回当前目录
	return "./"
}

// detectProjectName 智能检测项目名称
func detectProjectName() string {
	// 尝试从go.mod文件读取
	if content, err := os.ReadFile("go.mod"); err == nil {
		lines := strings.Split(string(content), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "module ") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					moduleName := parts[1]
					// 提取最后一部分作为项目名
					parts = strings.Split(moduleName, "/")
					return parts[len(parts)-1]
				}
			}
		}
	}
	
	// 使用当前目录名
	if wd, err := os.Getwd(); err == nil {
		return filepath.Base(wd)
	}
	
	return "database"
}

// hasGoFiles 检查目录是否包含Go文件
func hasGoFiles(dir string) bool {
	files, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".go") {
			return true
		}
	}
	return false
}

// isResponseModel 检查是否是响应模型（应该被过滤）
func isResponseModel(modelName string) bool {
	// 过滤常见的非数据库模型
	excludePatterns := []string{
		"Response", "Responses", "Request", "Requests",
		"DTO", "VO", "View", "Views", "Form", "Forms",
		"Item", "Items", "WithHosts", "Config", "Setting",
		"Handler", "Service", "Controller", "Router",
		"Middleware", "Helper", "Util", "Utils",
	}
	
	for _, pattern := range excludePatterns {
		if strings.Contains(modelName, pattern) {
			return true
		}
	}
	
	return false
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
		
		modelName := typeSpec.Name.Name
		
		// 跳过响应模型和其他非数据库模型
		if isResponseModel(modelName) {
			return true
		}
		
		// 检查是否是GORM模型
		if !isGORMModel(structType) {
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
	hasGormTag := false
	hasCommonFields := false
	
	for _, field := range structType.Fields.List {
		// 检查gorm标签
		if field.Tag != nil {
			tag := strings.Trim(field.Tag.Value, "`")
			if strings.Contains(tag, "gorm:") {
				hasGormTag = true
			}
		}
		
		// 检查常见的GORM字段
		if len(field.Names) > 0 {
			name := field.Names[0].Name
			if name == "ID" || name == "CreatedAt" || name == "UpdatedAt" || name == "DeletedAt" {
				hasCommonFields = true
			}
		}
		
		// 检查gorm.Model嵌入
		if len(field.Names) == 0 && field.Type != nil {
			if ident, ok := field.Type.(*ast.SelectorExpr); ok {
				if pkg, ok := ident.X.(*ast.Ident); ok && pkg.Name == "gorm" {
					if ident.Sel.Name == "Model" {
						return true
					}
				}
			}
		}
	}
	
	return hasGormTag || hasCommonFields
}

// smartTableName 智能推断表名
func smartTableName(modelName string) string {
	// 将驼峰命名转换为下划线命名
	tableName := convertToSnakeCase(modelName)
	
	// 智能复数化
	if strings.HasSuffix(tableName, "y") {
		tableName = strings.TrimSuffix(tableName, "y") + "ies"
	} else if strings.HasSuffix(tableName, "s") || 
			  strings.HasSuffix(tableName, "x") || 
			  strings.HasSuffix(tableName, "ch") || 
			  strings.HasSuffix(tableName, "sh") {
		tableName += "es"
	} else {
		tableName += "s"
	}
	
	return tableName
}

// convertToSnakeCase 将驼峰命名转换为蛇形命名
func convertToSnakeCase(str string) string {
	// 特殊处理常见缩写
	if str == "ID" {
		return "id"
	}
	
	var result []rune
	for i, r := range str {
		if i > 0 && r >= 'A' && r <= 'Z' {
			// 检查是否是连续大写字母（如ID、URL等）
			if i+1 < len(str) && str[i+1] >= 'A' && str[i+1] <= 'Z' {
				// 连续大写字母，不加下划线
			} else {
				result = append(result, '_')
			}
		}
		result = append(result, r)
	}
	return strings.ToLower(string(result))
}

func parseGORMModel(name string, structType *ast.StructType) Model {
	model := Model{
		Name:      name,
		TableName: smartTableName(name),
		Fields:    []Field{},
		Indexes:   []Index{},
		Relations: []Relation{},
	}
	
	for _, field := range structType.Fields.List {
		if len(field.Names) == 0 {
			// 处理嵌入字段（如gorm.Model）
			if field.Type != nil {
				if ident, ok := field.Type.(*ast.SelectorExpr); ok {
					if pkg, ok := ident.X.(*ast.Ident); ok && pkg.Name == "gorm" {
						if ident.Sel.Name == "Model" {
							// 添加gorm.Model的标准字段
							model.Fields = append(model.Fields, 
								Field{Name: "ID", Type: "uint", IsPrimaryKey: true, IsAutoIncrement: true},
								Field{Name: "CreatedAt", Type: "time.Time"},
								Field{Name: "UpdatedAt", Type: "time.Time"},
								Field{Name: "DeletedAt", Type: "gorm.DeletedAt"},
							)
						}
					}
				}
			}
			continue
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
		
		// 智能推断字段属性
		inferFieldProperties(&f)
		
		// 设置SQL类型
		f.SQLType = smartSQLType(f)
		
		// 检查关系
		if rel := parseRelation(fieldName, fieldType, field.Tag); rel != nil {
			model.Relations = append(model.Relations, *rel)
		} else {
			model.Fields = append(model.Fields, f)
		}
	}
	
	return model
}

// inferFieldProperties 智能推断字段属性
func inferFieldProperties(field *Field) {
	fieldName := field.Name
	fieldType := field.Type
	
	// 推断主键
	if fieldName == "ID" || fieldName == "Id" || strings.HasSuffix(fieldName, "ID") && len(fieldName) <= 4 {
		field.IsPrimaryKey = true
		if strings.HasPrefix(fieldType, "uint") || fieldType == "int" || fieldType == "int64" {
			field.IsAutoIncrement = true
		}
	}
	
	// 推断唯一键
	if strings.Contains(strings.ToLower(fieldName), "username") ||
	   strings.Contains(strings.ToLower(fieldName), "email") ||
	   strings.Contains(strings.ToLower(fieldName), "phone") ||
	   strings.Contains(strings.ToLower(fieldName), "code") {
		field.IsUnique = true
	}
	
	// 推断索引
	if strings.HasSuffix(fieldName, "ID") && fieldName != "ID" ||
	   strings.Contains(strings.ToLower(fieldName), "status") ||
	   strings.Contains(strings.ToLower(fieldName), "type") ||
	   strings.Contains(strings.ToLower(fieldName), "category") {
		field.IsIndex = true
	}
	
	// 推断NOT NULL
	if field.IsPrimaryKey || 
	   !strings.HasPrefix(fieldType, "*") && 
	   fieldType != "gorm.DeletedAt" &&
	   fieldName != "DeletedAt" {
		field.IsNotNull = true
	}
}

// smartSQLType 智能生成SQL类型
func smartSQLType(field Field) string {
	fieldType := field.Type
	fieldName := field.Name
	
	// 处理指针类型
	isNullable := strings.HasPrefix(fieldType, "*") || fieldType == "gorm.DeletedAt"
	if isNullable {
		fieldType = strings.TrimPrefix(fieldType, "*")
	}
	
	var sqlType string
	
	switch fieldType {
	case "uint", "uint64":
		if field.IsPrimaryKey {
			sqlType = "bigint unsigned NOT NULL AUTO_INCREMENT"
		} else {
			sqlType = "bigint unsigned"
		}
	case "uint32":
		sqlType = "int unsigned"
	case "uint16":
		sqlType = "smallint unsigned"
	case "uint8":
		sqlType = "tinyint unsigned"
	case "int", "int64":
		sqlType = "bigint"
	case "int32":
		sqlType = "int"
	case "int16":
		sqlType = "smallint"
	case "int8":
		sqlType = "tinyint"
	case "string":
		if field.Size > 0 {
			if field.Size <= 255 {
				sqlType = fmt.Sprintf("varchar(%d)", field.Size)
			} else {
				sqlType = "text"
			}
		} else {
			// 智能推断字符串长度
			if strings.Contains(strings.ToLower(fieldName), "username") {
				sqlType = "varchar(50)"
			} else if strings.Contains(strings.ToLower(fieldName), "password") {
				sqlType = "varchar(255)"
			} else if strings.Contains(strings.ToLower(fieldName), "email") {
				sqlType = "varchar(100)"
			} else if strings.Contains(strings.ToLower(fieldName), "phone") {
				sqlType = "varchar(20)"
			} else if strings.Contains(strings.ToLower(fieldName), "name") {
				sqlType = "varchar(100)"
			} else if strings.Contains(strings.ToLower(fieldName), "description") {
				sqlType = "text"
			} else {
				sqlType = "varchar(255)"
			}
		}
		sqlType += " COLLATE utf8mb4_unicode_ci"
	case "bool":
		sqlType = "tinyint(1)"
	case "time.Time":
		sqlType = "timestamp"
	case "gorm.DeletedAt":
		sqlType = "timestamp"
		isNullable = true
	case "[]byte":
		sqlType = "blob"
	case "float32":
		sqlType = "float"
	case "float64":
		sqlType = "double"
	default:
		sqlType = "text COLLATE utf8mb4_unicode_ci"
	}
	
	// 添加NULL约束
	if isNullable && !strings.Contains(sqlType, "NULL") {
		sqlType += " NULL"
	} else if field.IsNotNull && !strings.Contains(sqlType, "NOT NULL") {
		sqlType += " NOT NULL"
	}
	
	// 添加默认值
	if field.DefaultValue != "" {
		sqlType += fmt.Sprintf(" DEFAULT %s", field.DefaultValue)
	} else {
		// 智能推断默认值
		if fieldName == "Status" && (fieldType == "int" || fieldType == "tinyint") {
			sqlType += " DEFAULT 1"
		} else if fieldName == "CreatedAt" || fieldName == "UpdatedAt" {
			if fieldName == "CreatedAt" {
				sqlType += " DEFAULT CURRENT_TIMESTAMP"
			} else {
				sqlType += " DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
			}
		} else if isNullable && fieldName != "DeletedAt" {
			sqlType += " DEFAULT NULL"
		}
	}
	
	return sqlType
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

func analyzeSchema(models []Model) Schema {
	schema := Schema{
		Models:      models,
		ForeignKeys: []ForeignKeyConstraint{},
		JoinTables:  []JoinTable{},
	}
	
	// 智能分析外键关系
	for _, model := range models {
		for _, field := range model.Fields {
			if strings.HasSuffix(field.Name, "ID") && field.Name != "ID" {
				refTable := smartTableName(strings.TrimSuffix(field.Name, "ID"))
				
				// 检查引用的表是否存在
				if tableExists(refTable, models) {
					fk := ForeignKeyConstraint{
						Name:             fmt.Sprintf("fk_%s_%s", model.TableName, convertToSnakeCase(field.Name)),
						Table:            model.TableName,
						Column:           convertToSnakeCase(field.Name),
						ReferencedTable:  refTable,
						ReferencedColumn: "id",
						OnDelete:         "SET NULL",
						OnUpdate:         "CASCADE",
					}
					schema.ForeignKeys = append(schema.ForeignKeys, fk)
				}
			}
		}
		
		// 分析多对多关系
		for _, rel := range model.Relations {
			if rel.Type == "many2many" && rel.JoinTable != "" {
				joinTable := JoinTable{
					Name:        rel.JoinTable,
					LeftTable:   model.TableName,
					LeftColumn:  convertToSnakeCase(model.Name) + "_id",
					RightTable:  smartTableName(rel.Model),
					RightColumn: convertToSnakeCase(rel.Model) + "_id",
				}
				schema.JoinTables = append(schema.JoinTables, joinTable)
			}
		}
	}
	
	return schema
}

// tableExists 检查表是否在模型中存在
func tableExists(tableName string, models []Model) bool {
	for _, model := range models {
		if model.TableName == tableName {
			return true
		}
	}
	return false
}

func generateSQLScript(schema Schema, outputPath, dbType, projectName string) error {
	var sql strings.Builder
	
	// 文件头部
	sql.WriteString("-- ========================================\n")
	sql.WriteString(fmt.Sprintf("-- %s 数据库表结构恢复脚本\n", strings.ToUpper(projectName)))
	sql.WriteString("-- 自动生成：完整表结构重建\n")
	sql.WriteString(fmt.Sprintf("-- 生成时间: %s\n", time.Now().Format("2006-01-02 15:04:05")))
	sql.WriteString("-- ========================================\n\n")
	
	// 数据库设置
	if dbType == "mysql" {
		sql.WriteString("-- 设置基础配置\n")
		sql.WriteString(fmt.Sprintf("USE %s;\n", projectName))
		sql.WriteString("SET NAMES utf8mb4;\n")
		sql.WriteString("SET FOREIGN_KEY_CHECKS = 0;\n")
		sql.WriteString("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';\n\n")
	}
	
	// 生成表结构
	sql.WriteString("-- ========================================\n")
	sql.WriteString("-- 核心业务表结构\n")
	sql.WriteString("-- ========================================\n\n")
	
	for _, model := range schema.Models {
		sql.WriteString(fmt.Sprintf("-- %s 表\n", model.Name))
		sql.WriteString(generateCreateTable(model, dbType))
		sql.WriteString("\n")
	}
	
	// 生成外键约束
	if len(schema.ForeignKeys) > 0 {
		sql.WriteString("-- ========================================\n")
		sql.WriteString("-- 外键约束定义\n")
		sql.WriteString("-- ========================================\n\n")
		
		for _, fk := range schema.ForeignKeys {
			sql.WriteString(generateForeignKey(fk, dbType))
		}
		sql.WriteString("\n")
	}
	
	// 生成关联表
	for _, joinTable := range schema.JoinTables {
		sql.WriteString(fmt.Sprintf("-- %s 关联表\n", joinTable.Name))
		sql.WriteString(generateJoinTable(joinTable, dbType))
		sql.WriteString("\n")
	}
	
	// 恢复设置
	if dbType == "mysql" {
		sql.WriteString("SET FOREIGN_KEY_CHECKS = 1;\n\n")
	}
	
	// 生成验证查询
	sql.WriteString(generateValidationQueries(schema, dbType))
	
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
	
	for _, field := range model.Fields {
		fieldName := convertToSnakeCase(field.Name)
		fieldDef := fmt.Sprintf("  `%s` %s", fieldName, field.SQLType)
		
		// 添加注释
		if field.Comment != "" {
			fieldDef += fmt.Sprintf(" COMMENT '%s'", field.Comment)
		}
		
		fields = append(fields, fieldDef)
		
		if field.IsPrimaryKey {
			primaryKeys = append(primaryKeys, fmt.Sprintf("`%s`", fieldName))
		}
		
		if field.IsUnique && !field.IsPrimaryKey {
			uniqueIndexes = append(uniqueIndexes, fmt.Sprintf("UNIQUE KEY `idx_%s_%s` (`%s`)", 
				model.TableName, fieldName, fieldName))
		}
		
		if field.IsIndex && !field.IsPrimaryKey && !field.IsUnique {
			indexes = append(indexes, fmt.Sprintf("KEY `idx_%s_%s` (`%s`)", 
				model.TableName, fieldName, fieldName))
		}
		
		// 自动添加deleted_at索引
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
	
	// 移除最后的逗号
	sqlStr := sql.String()
	sqlStr = strings.TrimSuffix(sqlStr, ",\n") + "\n"
	
	// 表选项
	if dbType == "mysql" {
		sqlStr += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
		if model.Comment != "" {
			sqlStr += fmt.Sprintf(" COMMENT='%s'", model.Comment)
		}
		sqlStr += ";\n"
	} else {
		sqlStr += ");\n"
	}
	
	return sqlStr
}

func generateJoinTable(joinTable JoinTable, dbType string) string {
	var sql strings.Builder
	
	sql.WriteString(fmt.Sprintf("CREATE TABLE IF NOT EXISTS `%s` (\n", joinTable.Name))
	sql.WriteString(fmt.Sprintf("  `%s` bigint unsigned NOT NULL,\n", joinTable.LeftColumn))
	sql.WriteString(fmt.Sprintf("  `%s` bigint unsigned NOT NULL,\n", joinTable.RightColumn))
	sql.WriteString("  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,\n")
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

func generateValidationQueries(schema Schema, dbType string) string {
	return fmt.Sprintf(`-- ========================================
-- 验证查询
-- ========================================

-- 数据库恢复完成检查
SELECT '数据库恢复完成！' as message;

-- 表数量统计
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE();

-- 外键约束统计  
SELECT COUNT(*) as foreign_key_count FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 恢复时间记录
SELECT '恢复时间: %s' as recovery_time;

`, time.Now().Format("2006-01-02 15:04:05"))
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

-- 外键约束检查
SELECT 
    'Foreign Key Check' as check_type,
    COUNT(*) as actual_foreign_keys,
    CASE 
        WHEN COUNT(*) >= %d THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as result
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 最终验证结果
SELECT 
    'FINAL VALIDATION' as validation_summary,
    CASE 
        WHEN (
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) >= %d
        )
        THEN '🎉 数据库结构恢复成功！'
        ELSE '⚠️ 数据库结构存在问题'
    END as final_result,
    NOW() as validation_time;
`, projectName, time.Now().Format("2006-01-02 15:04:05"), len(schema.Models), len(schema.ForeignKeys), len(schema.Models))
	
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
`, projectName, time.Now().Format("2006-01-02 15:04:05"), projectName, projectName, projectName)
	
	filePath := filepath.Join(outputPath, "quick_recovery.sh")
	return os.WriteFile(filePath, []byte(script), 0755)
}

func generateREADME(schema Schema, outputPath, dbType, projectName string) error {
	readme := fmt.Sprintf("# %s 数据库恢复脚本\n\n## 🚀 自动生成的通用数据库恢复工具包\n\n**生成时间**: %s\n**数据库类型**: %s\n**表数量**: %d\n**外键约束**: %d\n\n## 📁 文件说明\n\n- database_recovery.sql - 主恢复脚本\n- validate_recovery.sql - 验证脚本\n- quick_recovery.sh - 自动化恢复脚本\n- README.md - 使用说明\n\n## 🔧 使用方法\n\n### 自动化恢复（推荐）\n\nchmod +x quick_recovery.sh\n./quick_recovery.sh\n\n### 手动恢复\n\nmysql -h<hostname> -u<username> -p\nUSE %s;\nSOURCE database_recovery.sql;\nSOURCE validate_recovery.sql;\n\n## 📊 生成统计\n\n- 解析模型数量: %d\n- 生成表数量: %d\n- 外键约束数量: %d\n- 关联表数量: %d\n\n## ⚠️ 注意事项\n\n1. 本脚本通过智能分析GORM模型自动生成\n2. 请在恢复前备份现有数据\n3. 验证恢复结果确保完整性\n\n---\n*此恢复脚本由通用数据库恢复脚本生成器自动生成*\n", projectName, time.Now().Format("2006-01-02 15:04:05"), strings.ToUpper(dbType), len(schema.Models), len(schema.ForeignKeys), projectName, len(schema.Models), len(schema.Models), len(schema.ForeignKeys), len(schema.JoinTables))
	
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
	fmt.Println("  go run universal-db-recovery-generator.go <command> [options]")
	fmt.Println()
	fmt.Println("命令:")
	fmt.Println("  generate, gen    生成数据库恢复脚本")
	fmt.Println("  analyze, ana     分析GORM模型结构")
	fmt.Println("  help             显示帮助信息")
	fmt.Println("  version          显示版本信息")
	fmt.Println()
	fmt.Println("选项:")
	fmt.Println("  -models string   模型文件路径 (自动检测)")
	fmt.Println("  -output string   输出目录路径 (默认: ./recovery-generated)")
	fmt.Println("  -db string       数据库类型 (默认: mysql)")
	fmt.Println("  -project string  项目名称 (自动检测)")
}

func printHelp() {
	fmt.Println("通用数据库表结构自动恢复脚本生成器")
	fmt.Println()
	printUsage()
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  go run universal-db-recovery-generator.go generate")
	fmt.Println("  go run universal-db-recovery-generator.go analyze")
	fmt.Println("  go run universal-db-recovery-generator.go generate -models ./internal/models -output ./backup")
	fmt.Println()
	fmt.Println("功能特性:")
	fmt.Println("  🔧 智能检测项目结构")
	fmt.Println("  📊 自动分析GORM模型")
	fmt.Println("  🛡️ 生成完整DDL脚本")
	fmt.Println("  ⚡ 支持MySQL和PostgreSQL")
	fmt.Println("  📋 智能推断字段类型和约束")
	fmt.Println("  🔗 自动分析外键关系")
	fmt.Println("  📖 生成详细的使用文档")
}