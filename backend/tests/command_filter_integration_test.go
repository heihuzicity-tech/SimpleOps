package tests

import (
	"bastion/config"
	"bastion/models"
	"bastion/services"
	"bastion/utils"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"
)

// CommandFilterIntegrationTestSuite 命令过滤集成测试套件
type CommandFilterIntegrationTestSuite struct {
	suite.Suite
	db                    *gorm.DB
	tx                    *gorm.DB
	commandGroupService   *services.CommandGroupService
	commandFilterService  *services.CommandFilterService
	commandMatcherService *services.CommandMatcherService
	
	// 测试数据
	testUser1  *models.User
	testUser2  *models.User
	testAsset1 *models.Asset
	testAsset2 *models.Asset
	testGroup1 *models.CommandGroup
	testGroup2 *models.CommandGroup
}

// SetupSuite 设置测试套件
func (suite *CommandFilterIntegrationTestSuite) SetupSuite() {
	// 加载测试配置
	config.LoadConfig("../config")
	
	// 初始化数据库
	err := utils.InitDatabase()
	suite.Require().NoError(err)
	
	// 获取数据库连接
	suite.db = utils.DB
	
	// 自动迁移模型
	err = suite.db.AutoMigrate(
		&models.User{},
		&models.Asset{},
		&models.CommandGroup{},
		&models.CommandGroupItem{},
		&models.CommandFilter{},
		&models.FilterAttribute{},
		&models.CommandFilterLog{},
	)
	suite.Require().NoError(err)
}

// SetupTest 设置每个测试用例
func (suite *CommandFilterIntegrationTestSuite) SetupTest() {
	// 开启事务
	suite.tx = suite.db.Begin()
	
	// 初始化服务
	suite.commandGroupService = services.NewCommandGroupService(suite.tx)
	suite.commandFilterService = services.NewCommandFilterService(suite.tx)
	suite.commandMatcherService = services.NewCommandMatcherService(suite.tx, suite.commandFilterService)
	
	// 创建测试数据
	suite.createTestData()
}

// TearDownTest 清理每个测试用例
func (suite *CommandFilterIntegrationTestSuite) TearDownTest() {
	// 回滚事务
	suite.tx.Rollback()
}

// createTestData 创建测试数据
func (suite *CommandFilterIntegrationTestSuite) createTestData() {
	// 创建测试用户
	suite.testUser1 = &models.User{
		Username: "testuser1",
		Email:    "testuser1@example.com",
		Password: "password123",
		Status:   1,
	}
	suite.Require().NoError(suite.tx.Create(suite.testUser1).Error)
	
	suite.testUser2 = &models.User{
		Username: "testuser2",
		Email:    "testuser2@example.com",
		Password: "password123",
		Status:   1,
	}
	suite.Require().NoError(suite.tx.Create(suite.testUser2).Error)
	
	// 创建测试资产
	suite.testAsset1 = &models.Asset{
		Name:     "web-server-01",
		Address:  "192.168.1.10",
		Port:     22,
		Type:     "server",
		Status:   1,
	}
	suite.Require().NoError(suite.tx.Create(suite.testAsset1).Error)
	
	suite.testAsset2 = &models.Asset{
		Name:     "db-server-01",
		Address:  "192.168.1.20",
		Port:     22,
		Type:     "database",
		Status:   1,
	}
	suite.Require().NoError(suite.tx.Create(suite.testAsset2).Error)
}

// TestCommandGroupCRUD 测试命令组的创建、读取、更新、删除
func (suite *CommandFilterIntegrationTestSuite) TestCommandGroupCRUD() {
	// 创建命令组
	createReq := &models.CommandGroupCreateRequest{
		Name:   "危险命令组",
		Remark: "包含系统危险命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "rm -rf /",
				IgnoreCase: false,
				SortOrder:  1,
			},
			{
				Type:       models.CommandTypeRegex,
				Content:    "^shutdown.*",
				IgnoreCase: true,
				SortOrder:  2,
			},
			{
				Type:       models.CommandTypeExact,
				Content:    "dd if=/dev/zero of=/dev/sda",
				IgnoreCase: false,
				SortOrder:  3,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(createReq)
	suite.NoError(err)
	suite.NotNil(group)
	suite.Equal("危险命令组", group.Name)
	suite.Equal(3, group.ItemCount)
	
	// 获取命令组详情
	fetchedGroup, err := suite.commandGroupService.Get(group.ID)
	suite.NoError(err)
	suite.NotNil(fetchedGroup)
	suite.Equal(group.ID, fetchedGroup.ID)
	suite.Len(fetchedGroup.Items, 3)
	
	// 更新命令组
	updateReq := &models.CommandGroupUpdateRequest{
		Name:   "高危命令组",
		Remark: "包含系统高危命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "rm -rf /*",
				IgnoreCase: false,
				SortOrder:  1,
			},
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(shutdown|reboot|halt).*",
				IgnoreCase: true,
				SortOrder:  2,
			},
		},
	}
	
	updatedGroup, err := suite.commandGroupService.Update(group.ID, updateReq)
	suite.NoError(err)
	suite.Equal("高危命令组", updatedGroup.Name)
	suite.Equal(2, updatedGroup.ItemCount)
	
	// 删除命令组
	err = suite.commandGroupService.Delete(group.ID)
	suite.NoError(err)
	
	// 验证删除
	_, err = suite.commandGroupService.Get(group.ID)
	suite.Error(err)
	suite.Equal(utils.ErrNotFound, err)
}

// TestCommandFilterCRUD 测试命令过滤规则的创建、读取、更新、删除
func (suite *CommandFilterIntegrationTestSuite) TestCommandFilterCRUD() {
	// 先创建一个命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "数据库危险命令",
		Remark: "数据库相关的危险命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "drop database",
				IgnoreCase: true,
				SortOrder:  1,
			},
			{
				Type:       models.CommandTypeRegex,
				Content:    "^delete\\s+from.*where\\s+1\\s*=\\s*1",
				IgnoreCase: true,
				SortOrder:  2,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	suite.testGroup1 = &models.CommandGroup{ID: group.ID}
	
	// 创建过滤规则
	createReq := &models.CommandFilterCreateRequest{
		Name:           "禁止数据库危险操作",
		Priority:       10,
		Enabled:        true,
		UserType:       models.FilterTargetSpecific,
		UserIDs:        []uint{suite.testUser1.ID},
		AssetType:      models.FilterTargetAttribute,
		AssetAttributes: []models.FilterAttributeRequest{
			{
				TargetType:     models.AttributeTargetAsset,
				AttributeName:  "type",
				AttributeValue: "database",
			},
		},
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
		Remark:         "防止误操作删除数据库",
	}
	
	filter, err := suite.commandFilterService.Create(createReq)
	suite.NoError(err)
	suite.NotNil(filter)
	suite.Equal("禁止数据库危险操作", filter.Name)
	suite.Equal(10, filter.Priority)
	suite.True(filter.Enabled)
	
	// 获取过滤规则详情
	fetchedFilter, err := suite.commandFilterService.Get(filter.ID)
	suite.NoError(err)
	suite.NotNil(fetchedFilter)
	suite.Equal(filter.ID, fetchedFilter.ID)
	suite.Len(fetchedFilter.UserIDs, 1)
	suite.Equal(suite.testUser1.ID, fetchedFilter.UserIDs[0])
	
	// 更新过滤规则
	enabled := false
	updateReq := &models.CommandFilterUpdateRequest{
		Name:     "暂停数据库危险操作限制",
		Priority: 20,
		Enabled:  &enabled,
	}
	
	updatedFilter, err := suite.commandFilterService.Update(filter.ID, updateReq)
	suite.NoError(err)
	suite.Equal("暂停数据库危险操作限制", updatedFilter.Name)
	suite.Equal(20, updatedFilter.Priority)
	suite.False(updatedFilter.Enabled)
	
	// 删除过滤规则
	err = suite.commandFilterService.Delete(filter.ID)
	suite.NoError(err)
	
	// 验证删除
	_, err = suite.commandFilterService.Get(filter.ID)
	suite.Error(err)
	suite.Equal(utils.ErrNotFound, err)
}

// TestCommandMatchingExact 测试精确匹配命令
func (suite *CommandFilterIntegrationTestSuite) TestCommandMatchingExact() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "系统管理命令",
		Remark: "系统管理相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "rm -rf /",
				IgnoreCase: false,
				SortOrder:  1,
			},
			{
				Type:       models.CommandTypeExact,
				Content:    "FORMAT C:",
				IgnoreCase: true,
				SortOrder:  2,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建过滤规则 - 拒绝执行
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "禁止危险系统命令",
		Priority:       1,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
		Remark:         "禁止执行危险的系统命令",
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 测试匹配 - 精确匹配（大小写敏感）
	matchReq := &models.CommandMatchRequest{
		Command: "rm -rf /",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "root",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	suite.Equal("禁止危险系统命令", result.FilterName)
	
	// 测试不匹配 - 大小写不同
	matchReq.Command = "RM -RF /"
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched)
	
	// 测试匹配 - 忽略大小写
	matchReq.Command = "format c:"
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
}

// TestCommandMatchingRegex 测试正则表达式匹配
func (suite *CommandFilterIntegrationTestSuite) TestCommandMatchingRegex() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "数据操作命令",
		Remark: "数据库操作相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^drop\\s+(database|table)\\s+",
				IgnoreCase: true,
				SortOrder:  1,
			},
			{
				Type:       models.CommandTypeRegex,
				Content:    "delete\\s+from\\s+\\w+\\s+where\\s+1\\s*=\\s*1",
				IgnoreCase: true,
				SortOrder:  2,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建过滤规则 - 告警
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "数据库危险操作告警",
		Priority:       5,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionAlert,
		Remark:         "对危险的数据库操作进行告警",
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 测试正则匹配
	testCases := []struct {
		command string
		matched bool
	}{
		{"drop database testdb", true},
		{"DROP TABLE users", true},
		{"drop view myview", false}, // 不匹配 view
		{"delete from users where 1=1", true},
		{"delete from users where id=1", false}, // 不是 where 1=1
		{"select * from users", false},
	}
	
	for _, tc := range testCases {
		matchReq := &models.CommandMatchRequest{
			Command: tc.command,
			UserID:  suite.testUser1.ID,
			AssetID: suite.testAsset2.ID,
			Account: "dbadmin",
		}
		
		result, err := suite.commandMatcherService.MatchCommand(matchReq)
		suite.NoError(err)
		suite.Equal(tc.matched, result.Matched, "Command: %s", tc.command)
		if tc.matched {
			suite.Equal(models.FilterActionAlert, result.Action)
		}
	}
}

// TestFilterPriority 测试过滤规则优先级
func (suite *CommandFilterIntegrationTestSuite) TestFilterPriority() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "通用命令组",
		Remark: "包含各种命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "shutdown -h now",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建多个优先级不同的规则
	// 规则1：优先级10，拒绝
	filter1Req := &models.CommandFilterCreateRequest{
		Name:           "拒绝关机命令",
		Priority:       10,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
	}
	_, err = suite.commandFilterService.Create(filter1Req)
	suite.NoError(err)
	
	// 规则2：优先级5，允许（优先级更高）
	filter2Req := &models.CommandFilterCreateRequest{
		Name:           "允许特定用户关机",
		Priority:       5, // 数字越小优先级越高
		Enabled:        true,
		UserType:       models.FilterTargetSpecific,
		UserIDs:        []uint{suite.testUser1.ID},
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionAllow,
	}
	_, err = suite.commandFilterService.Create(filter2Req)
	suite.NoError(err)
	
	// 测试用户1 - 应该匹配到优先级更高的允许规则
	matchReq := &models.CommandMatchRequest{
		Command: "shutdown -h now",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "root",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionAllow, result.Action)
	suite.Equal("允许特定用户关机", result.FilterName)
	suite.Equal(5, result.Priority)
	
	// 测试用户2 - 应该匹配到拒绝规则
	matchReq.UserID = suite.testUser2.ID
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	suite.Equal("拒绝关机命令", result.FilterName)
	suite.Equal(10, result.Priority)
}

// TestFilterByUserAttribute 测试基于用户属性的过滤（简化版本）
func (suite *CommandFilterIntegrationTestSuite) TestFilterByUserAttribute() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "生产环境命令",
		Remark: "生产环境相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(rm|mv|cp)\\s+.*production.*",
				IgnoreCase: true,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建基于特定用户的过滤规则（简化为特定用户而非属性）
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "限制特定用户操作生产环境",
		Priority:       15,
		Enabled:        true,
		UserType:       models.FilterTargetSpecific,
		UserIDs:        []uint{suite.testUser2.ID},
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionPromptAlert,
		Remark:         "特定用户操作生产环境文件时提示并告警",
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 测试特定用户（user2）- 应该匹配
	matchReq := &models.CommandMatchRequest{
		Command: "rm -f /data/production/oldfile.txt",
		UserID:  suite.testUser2.ID,
		AssetID: suite.testAsset1.ID,
		Account: "deploy",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionPromptAlert, result.Action)
	
	// 测试其他用户（user1）- 不应该匹配
	matchReq.UserID = suite.testUser1.ID
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched)
}

// TestFilterByAssetAttribute 测试基于资产属性的过滤（简化版本）
func (suite *CommandFilterIntegrationTestSuite) TestFilterByAssetAttribute() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "开发调试命令",
		Remark: "开发调试相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(gdb|strace|tcpdump)\\s+",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建基于特定资产的过滤规则（简化为特定资产而非属性）
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "禁止在特定服务器调试",
		Priority:       8,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetSpecific,
		AssetIDs:       []uint{suite.testAsset1.ID},
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
		Remark:         "禁止在特定服务器使用调试工具",
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 测试特定资产 - 应该匹配
	matchReq := &models.CommandMatchRequest{
		Command: "tcpdump -i eth0",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "root",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	
	// 测试其他资产 - 不应该匹配
	matchReq.AssetID = suite.testAsset2.ID
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched)
}

// TestFilterBySpecificAccount 测试基于特定账号的过滤
func (suite *CommandFilterIntegrationTestSuite) TestFilterBySpecificAccount() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "账号管理命令",
		Remark: "用户账号管理相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(useradd|userdel|passwd)\\s+",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建基于特定账号的过滤规则
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "限制非root账号管理用户",
		Priority:       12,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetSpecific,
		AccountNames:   "deploy,webapp,dbuser",
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
		Remark:         "只有root账号可以管理系统用户",
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 测试非root账号 - 应该匹配
	matchReq := &models.CommandMatchRequest{
		Command: "useradd newuser",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "deploy",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	
	// 测试root账号 - 不应该匹配
	matchReq.Account = "root"
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched)
}

// TestEnableDisableFilter 测试启用/禁用过滤规则
func (suite *CommandFilterIntegrationTestSuite) TestEnableDisableFilter() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "测试命令组",
		Remark: "用于测试启用禁用",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "test command",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建启用的过滤规则
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "测试过滤规则",
		Priority:       50,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
	}
	
	filter, err := suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	suite.True(filter.Enabled)
	
	// 测试启用状态 - 应该匹配
	matchReq := &models.CommandMatchRequest{
		Command: "test command",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "testuser",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	
	// 禁用过滤规则
	enabled := false
	updateReq := &models.CommandFilterUpdateRequest{
		Enabled: &enabled,
	}
	
	updatedFilter, err := suite.commandFilterService.Update(filter.ID, updateReq)
	suite.NoError(err)
	suite.False(updatedFilter.Enabled)
	
	// 测试禁用状态 - 不应该匹配
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched)
}

// TestCommandFilterLogging 测试命令过滤日志记录
func (suite *CommandFilterIntegrationTestSuite) TestCommandFilterLogging() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "监控命令组",
		Remark: "需要记录的命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "sudo su -",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建过滤规则 - 告警动作会记录日志
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "监控切换root用户",
		Priority:       20,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionAlert,
		Remark:         "记录切换到root用户的操作",
	}
	
	filter, err := suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 执行命令匹配
	matchReq := &models.CommandMatchRequest{
		Command: "sudo su -",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "developer",
	}
	
	// 设置会话ID（模拟真实场景）
	sessionID := fmt.Sprintf("test-session-%d", time.Now().Unix())
	suite.tx.Set("session_id", sessionID)
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionAlert, result.Action)
	
	// 验证日志是否被记录
	var logs []models.CommandFilterLog
	err = suite.tx.Where("filter_id = ?", filter.ID).Find(&logs).Error
	suite.NoError(err)
	suite.Len(logs, 1)
	
	log := logs[0]
	suite.Equal(suite.testUser1.ID, log.UserID)
	suite.Equal(suite.testUser1.Username, log.Username)
	suite.Equal(suite.testAsset1.ID, log.AssetID)
	suite.Equal(suite.testAsset1.Name, log.AssetName)
	suite.Equal("developer", log.Account)
	suite.Equal("sudo su -", log.Command)
	suite.Equal(filter.ID, log.FilterID)
	suite.Equal(filter.Name, log.FilterName)
	suite.Equal(models.FilterActionAlert, log.Action)
}

// TestComplexScenario 测试复杂场景 - 多规则、多条件组合（简化版本）
func (suite *CommandFilterIntegrationTestSuite) TestComplexScenario() {
	// 创建多个命令组
	// 命令组1：数据库命令
	dbGroupReq := &models.CommandGroupCreateRequest{
		Name:   "数据库管理命令",
		Remark: "数据库相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(mysql|psql|mongo)\\s+",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	dbGroup, err := suite.commandGroupService.Create(dbGroupReq)
	suite.NoError(err)
	
	// 命令组2：系统命令
	sysGroupReq := &models.CommandGroupCreateRequest{
		Name:   "系统维护命令",
		Remark: "系统维护相关命令",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeRegex,
				Content:    "^(systemctl|service)\\s+(stop|restart)\\s+",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	sysGroup, err := suite.commandGroupService.Create(sysGroupReq)
	suite.NoError(err)
	
	// 创建多个过滤规则
	// 规则1：特定用户可以访问数据库服务器
	filter1Req := &models.CommandFilterCreateRequest{
		Name:           "特定用户数据库访问",
		Priority:       10,
		Enabled:        true,
		UserType:       models.FilterTargetSpecific,
		UserIDs:        []uint{suite.testUser1.ID},
		AssetType:      models.FilterTargetSpecific,
		AssetIDs:       []uint{suite.testAsset2.ID},
		AccountType:    models.FilterTargetAll,
		CommandGroupID: dbGroup.ID,
		Action:         models.FilterActionAllow,
	}
	_, err = suite.commandFilterService.Create(filter1Req)
	suite.NoError(err)
	
	// 规则2：禁止其他用户访问数据库
	filter2Req := &models.CommandFilterCreateRequest{
		Name:           "禁止其他用户数据库访问",
		Priority:       20,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetSpecific,
		AssetIDs:       []uint{suite.testAsset2.ID},
		AccountType:    models.FilterTargetAll,
		CommandGroupID: dbGroup.ID,
		Action:         models.FilterActionDeny,
	}
	_, err = suite.commandFilterService.Create(filter2Req)
	suite.NoError(err)
	
	// 规则3：禁止在特定服务器重启服务
	filter3Req := &models.CommandFilterCreateRequest{
		Name:           "禁止在特定服务器重启服务",
		Priority:       5,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetSpecific,
		AssetIDs:       []uint{suite.testAsset1.ID},
		AccountType:    models.FilterTargetAll,
		CommandGroupID: sysGroup.ID,
		Action:         models.FilterActionDeny,
	}
	_, err = suite.commandFilterService.Create(filter3Req)
	suite.NoError(err)
	
	// 测试场景1：授权用户访问数据库服务器
	matchReq := &models.CommandMatchRequest{
		Command: "mysql -u root -p",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset2.ID,
		Account: "dbadmin",
	}
	
	result, err := suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionAllow, result.Action)
	suite.Equal("特定用户数据库访问", result.FilterName)
	
	// 测试场景2：其他用户访问数据库服务器
	matchReq.UserID = suite.testUser2.ID
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	suite.Equal("禁止其他用户数据库访问", result.FilterName)
	
	// 测试场景3：在受限服务器重启服务
	matchReq = &models.CommandMatchRequest{
		Command: "systemctl restart nginx",
		UserID:  suite.testUser1.ID,
		AssetID: suite.testAsset1.ID,
		Account: "root",
	}
	
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.True(result.Matched)
	suite.Equal(models.FilterActionDeny, result.Action)
	suite.Equal("禁止在特定服务器重启服务", result.FilterName)
	
	// 测试场景4：在其他服务器重启服务（应该不匹配）
	matchReq.AssetID = suite.testAsset2.ID
	result, err = suite.commandMatcherService.MatchCommand(matchReq)
	suite.NoError(err)
	suite.False(result.Matched) // 不匹配任何规则
}

// TestCommandGroupInUse 测试删除正在使用的命令组
func (suite *CommandFilterIntegrationTestSuite) TestCommandGroupInUse() {
	// 创建命令组
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "使用中的命令组",
		Remark: "这个命令组被过滤规则使用",
		Items: []models.CommandGroupItemRequest{
			{
				Type:       models.CommandTypeExact,
				Content:    "test",
				IgnoreCase: false,
				SortOrder:  1,
			},
		},
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建使用该命令组的过滤规则
	filterReq := &models.CommandFilterCreateRequest{
		Name:           "使用命令组的规则",
		Priority:       50,
		Enabled:        true,
		UserType:       models.FilterTargetAll,
		AssetType:      models.FilterTargetAll,
		AccountType:    models.FilterTargetAll,
		CommandGroupID: group.ID,
		Action:         models.FilterActionDeny,
	}
	
	_, err = suite.commandFilterService.Create(filterReq)
	suite.NoError(err)
	
	// 尝试删除命令组 - 应该失败
	err = suite.commandGroupService.Delete(group.ID)
	suite.Error(err)
	suite.Equal(utils.ErrInUse, err)
}

// TestBatchOperations 测试批量操作
func (suite *CommandFilterIntegrationTestSuite) TestBatchOperations() {
	// 创建多个命令组
	var groupIDs []uint
	for i := 1; i <= 3; i++ {
		groupReq := &models.CommandGroupCreateRequest{
			Name:   fmt.Sprintf("批量测试命令组%d", i),
			Remark: fmt.Sprintf("批量测试备注%d", i),
			Items: []models.CommandGroupItemRequest{
				{
					Type:       models.CommandTypeExact,
					Content:    fmt.Sprintf("command%d", i),
					IgnoreCase: false,
					SortOrder:  1,
				},
			},
		}
		
		group, err := suite.commandGroupService.Create(groupReq)
		suite.NoError(err)
		groupIDs = append(groupIDs, group.ID)
	}
	
	// 批量删除命令组
	err := suite.commandGroupService.BatchDelete(groupIDs)
	suite.NoError(err)
	
	// 验证删除
	for _, id := range groupIDs {
		_, err := suite.commandGroupService.Get(id)
		suite.Error(err)
		suite.Equal(utils.ErrNotFound, err)
	}
	
	// 创建命令组用于过滤规则测试
	group, err := suite.commandGroupService.Create(&models.CommandGroupCreateRequest{
		Name:   "批量操作测试组",
		Remark: "用于测试批量启用禁用",
		Items: []models.CommandGroupItemRequest{
			{Type: models.CommandTypeExact, Content: "test", IgnoreCase: false, SortOrder: 1},
		},
	})
	suite.NoError(err)
	
	// 创建多个过滤规则
	var filterIDs []uint
	for i := 1; i <= 3; i++ {
		filterReq := &models.CommandFilterCreateRequest{
			Name:           fmt.Sprintf("批量测试规则%d", i),
			Priority:       i * 10,
			Enabled:        true,
			UserType:       models.FilterTargetAll,
			AssetType:      models.FilterTargetAll,
			AccountType:    models.FilterTargetAll,
			CommandGroupID: group.ID,
			Action:         models.FilterActionDeny,
		}
		
		filter, err := suite.commandFilterService.Create(filterReq)
		suite.NoError(err)
		filterIDs = append(filterIDs, filter.ID)
	}
	
	// 单独禁用过滤规则进行测试
	for _, id := range filterIDs {
		enabled := false
		updateReq := &models.CommandFilterUpdateRequest{
			Enabled: &enabled,
		}
		_, err := suite.commandFilterService.Update(id, updateReq)
		suite.NoError(err)
		
		// 验证禁用状态
		filter, err := suite.commandFilterService.Get(id)
		suite.NoError(err)
		suite.False(filter.Enabled)
	}
	
	// 单独启用过滤规则进行测试
	for _, id := range filterIDs {
		enabled := true
		updateReq := &models.CommandFilterUpdateRequest{
			Enabled: &enabled,
		}
		_, err := suite.commandFilterService.Update(id, updateReq)
		suite.NoError(err)
		
		// 验证启用状态
		filter, err := suite.commandFilterService.Get(id)
		suite.NoError(err)
		suite.True(filter.Enabled)
	}
}

// TestPerformance 测试性能 - 大量规则和命令的匹配性能
func (suite *CommandFilterIntegrationTestSuite) TestPerformance() {
	// 创建一个包含多个命令的命令组
	items := make([]models.CommandGroupItemRequest, 50)
	for i := 0; i < 50; i++ {
		items[i] = models.CommandGroupItemRequest{
			Type:       models.CommandTypeRegex,
			Content:    fmt.Sprintf("^command%d\\s+", i),
			IgnoreCase: false,
			SortOrder:  i,
		}
	}
	
	groupReq := &models.CommandGroupCreateRequest{
		Name:   "性能测试命令组",
		Remark: "包含大量命令用于性能测试",
		Items:  items,
	}
	
	group, err := suite.commandGroupService.Create(groupReq)
	suite.NoError(err)
	
	// 创建多个过滤规则
	for i := 0; i < 10; i++ {
		filterReq := &models.CommandFilterCreateRequest{
			Name:           fmt.Sprintf("性能测试规则%d", i),
			Priority:       i + 1,
			Enabled:        true,
			UserType:       models.FilterTargetAll,
			AssetType:      models.FilterTargetAll,
			AccountType:    models.FilterTargetAll,
			CommandGroupID: group.ID,
			Action:         models.FilterActionDeny,
		}
		
		_, err := suite.commandFilterService.Create(filterReq)
		suite.NoError(err)
	}
	
	// 测试匹配性能
	start := time.Now()
	matchCount := 100
	
	for i := 0; i < matchCount; i++ {
		matchReq := &models.CommandMatchRequest{
			Command: fmt.Sprintf("command%d --test", i%50),
			UserID:  suite.testUser1.ID,
			AssetID: suite.testAsset1.ID,
			Account: "testuser",
		}
		
		result, err := suite.commandMatcherService.MatchCommand(matchReq)
		suite.NoError(err)
		suite.NotNil(result)
	}
	
	elapsed := time.Since(start)
	avgTime := elapsed / time.Duration(matchCount)
	
	// 性能要求：平均每次匹配应该在10ms以内
	suite.Less(avgTime, 10*time.Millisecond,
		"Average match time %v exceeds 10ms threshold", avgTime)
	
	fmt.Printf("Performance test: %d matches in %v, avg: %v/match\n",
		matchCount, elapsed, avgTime)
}

// TestCommandFilterIntegration 运行集成测试套件
func TestCommandFilterIntegration(t *testing.T) {
	suite.Run(t, new(CommandFilterIntegrationTestSuite))
}