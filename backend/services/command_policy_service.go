package services

import (
	"bastion/models"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CommandPolicyService 命令策略服务
type CommandPolicyService struct {
	db              *gorm.DB
	cache           *policyCache
	auditService    *AuditService
}

// policyCache 策略缓存
type policyCache struct {
	mu            sync.RWMutex
	userPolicies  map[uint][]*cachedPolicy // userID -> policies
	lastUpdated   time.Time
	cacheDuration time.Duration
}

// cachedPolicy 缓存的策略信息
type cachedPolicy struct {
	PolicyID      uint
	PolicyName    string
	Commands      []cachedCommand
	CommandGroups []cachedCommandGroup
}

// cachedCommand 缓存的命令信息
type cachedCommand struct {
	ID      uint
	Name    string
	Type    string
	Regex   *regexp.Regexp // 预编译的正则表达式
}

// cachedCommandGroup 缓存的命令组信息
type cachedCommandGroup struct {
	ID       uint
	Name     string
	Commands []cachedCommand
}

// NewCommandPolicyService 创建命令策略服务实例
func NewCommandPolicyService(db *gorm.DB) *CommandPolicyService {
	return &CommandPolicyService{
		db: db,
		cache: &policyCache{
			userPolicies:  make(map[uint][]*cachedPolicy),
			cacheDuration: 5 * time.Minute,
		},
		auditService: NewAuditService(db),
	}
}

// ValidateService 验证服务配置和数据库连接
func (s *CommandPolicyService) ValidateService() error {
	// 检查数据库连接
	if s.db == nil {
		return fmt.Errorf("数据库连接未初始化")
	}

	// 检查必要的表是否存在
	requiredTables := []string{
		"commands", 
		"command_groups", 
		"command_policies",
		"command_intercept_logs",
	}

	for _, table := range requiredTables {
		var count int64
		if err := s.db.Table(table).Count(&count).Error; err != nil {
			return fmt.Errorf("表 %s 不存在或无法访问: %w", table, err)
		}
	}

	// 检查预设数据
	var commandCount int64
	if err := s.db.Model(&models.Command{}).Count(&commandCount).Error; err != nil {
		return fmt.Errorf("无法查询命令数据: %w", err)
	}

	if commandCount == 0 {
		logrus.Warn("未发现预设命令数据，命令过滤功能可能无法正常工作")
	} else {
		logrus.Infof("发现 %d 条预设命令配置", commandCount)
	}

	return nil
}

// CheckCommand 检查命令是否被允许
func (s *CommandPolicyService) CheckCommand(userID uint, sessionID string, command string) (allowed bool, violation *models.CommandInterceptLog) {
	// 获取用户策略
	policies := s.getUserPolicies(userID)
	if len(policies) == 0 {
		return true, nil // 没有策略，允许执行
	}

	// 提取命令主体（去除参数）
	cmdMain := extractCommandMain(command)

	// 检查每个策略
	for _, policy := range policies {
		// 检查独立命令
		for _, cmd := range policy.Commands {
			if s.matchCommand(cmdMain, command, &cmd) {
				// 命令被禁止
				violation = &models.CommandInterceptLog{
					SessionID:     sessionID,
					UserID:        userID,
					Command:       command,
					PolicyID:      policy.PolicyID,
					PolicyName:    policy.PolicyName,
					PolicyType:    "command",
					InterceptTime: time.Now(),
				}
				return false, violation
			}
		}

		// 检查命令组
		for _, group := range policy.CommandGroups {
			for _, cmd := range group.Commands {
				if s.matchCommand(cmdMain, command, &cmd) {
					// 命令被禁止
					violation = &models.CommandInterceptLog{
						SessionID:     sessionID,
						UserID:        userID,
						Command:       command,
						PolicyID:      policy.PolicyID,
						PolicyName:    policy.PolicyName,
						PolicyType:    "command_group",
						InterceptTime: time.Now(),
					}
					return false, violation
				}
			}
		}
	}

	return true, nil
}

// matchCommand 匹配命令
func (s *CommandPolicyService) matchCommand(cmdMain, fullCommand string, cmd *cachedCommand) bool {
	switch cmd.Type {
	case "exact":
		return cmd.Name == cmdMain
	case "regex":
		if cmd.Regex != nil {
			return cmd.Regex.MatchString(fullCommand)
		}
	}
	return false
}

// extractCommandMain 提取命令主体
func extractCommandMain(command string) string {
	// 去除前后空格
	command = strings.TrimSpace(command)
	
	// 处理特殊情况：反斜杠转义
	if strings.HasPrefix(command, "\\") {
		command = command[1:]
	}
	
	// 按空格分割，取第一部分
	parts := strings.Fields(command)
	if len(parts) > 0 {
		// 提取命令的基本名称（处理路径）
		cmdPart := parts[0]
		if idx := strings.LastIndex(cmdPart, "/"); idx >= 0 {
			cmdPart = cmdPart[idx+1:]
		}
		return cmdPart
	}
	return command
}

// getUserPolicies 获取用户策略（带缓存）
func (s *CommandPolicyService) getUserPolicies(userID uint) []*cachedPolicy {
	s.cache.mu.RLock()
	// 检查缓存是否过期
	if time.Since(s.cache.lastUpdated) > s.cache.cacheDuration {
		s.cache.mu.RUnlock()
		s.refreshCache(userID)
		s.cache.mu.RLock()
	}
	policies := s.cache.userPolicies[userID]
	s.cache.mu.RUnlock()

	if policies == nil {
		// 缓存未命中，从数据库加载
		s.refreshCache(userID)
		s.cache.mu.RLock()
		policies = s.cache.userPolicies[userID]
		s.cache.mu.RUnlock()
	}

	return policies
}

// refreshCache 刷新用户策略缓存
func (s *CommandPolicyService) refreshCache(userID uint) {
	var policies []models.CommandPolicy
	
	// 查询用户的所有启用策略
	err := s.db.Model(&models.CommandPolicy{}).
		Joins("JOIN policy_users ON policy_users.policy_id = command_policies.id").
		Where("policy_users.user_id = ? AND command_policies.enabled = ? AND command_policies.deleted_at IS NULL", userID, true).
		Preload("Commands.Command").
		Preload("Commands.CommandGroup.Commands").
		Find(&policies).Error

	if err != nil {
		logrus.WithError(err).Error("Failed to load user policies")
		return
	}

	// 构建缓存数据
	cachedPolicies := make([]*cachedPolicy, 0, len(policies))
	for _, policy := range policies {
		cp := &cachedPolicy{
			PolicyID:      policy.ID,
			PolicyName:    policy.Name,
			Commands:      make([]cachedCommand, 0),
			CommandGroups: make([]cachedCommandGroup, 0),
		}

		// 处理策略中的命令和命令组
		for _, pc := range policy.Commands {
			if pc.Command != nil {
				cc := cachedCommand{
					ID:   pc.Command.ID,
					Name: pc.Command.Name,
					Type: pc.Command.Type,
				}
				// 预编译正则表达式
				if cc.Type == "regex" {
					if re, err := regexp.Compile(cc.Name); err == nil {
						cc.Regex = re
					} else {
						logrus.WithError(err).Errorf("Failed to compile regex: %s", cc.Name)
					}
				}
				cp.Commands = append(cp.Commands, cc)
			}

			if pc.CommandGroup != nil {
				cg := cachedCommandGroup{
					ID:       pc.CommandGroup.ID,
					Name:     pc.CommandGroup.Name,
					Commands: make([]cachedCommand, 0),
				}
				for _, cmd := range pc.CommandGroup.Commands {
					cc := cachedCommand{
						ID:   cmd.ID,
						Name: cmd.Name,
						Type: cmd.Type,
					}
					// 预编译正则表达式
					if cc.Type == "regex" {
						if re, err := regexp.Compile(cc.Name); err == nil {
							cc.Regex = re
						}
					}
					cg.Commands = append(cg.Commands, cc)
				}
				cp.CommandGroups = append(cp.CommandGroups, cg)
			}
		}

		cachedPolicies = append(cachedPolicies, cp)
	}

	// 更新缓存
	s.cache.mu.Lock()
	s.cache.userPolicies[userID] = cachedPolicies
	s.cache.lastUpdated = time.Now()
	s.cache.mu.Unlock()
}

// ClearCache 清除缓存
func (s *CommandPolicyService) ClearCache() {
	s.cache.mu.Lock()
	s.cache.userPolicies = make(map[uint][]*cachedPolicy)
	s.cache.lastUpdated = time.Time{}
	s.cache.mu.Unlock()
}

// ClearUserCache 清除特定用户的缓存
func (s *CommandPolicyService) ClearUserCache(userID uint) {
	s.cache.mu.Lock()
	delete(s.cache.userPolicies, userID)
	s.cache.mu.Unlock()
}

// RecordInterceptLog 记录拦截日志
func (s *CommandPolicyService) RecordInterceptLog(log *models.CommandInterceptLog, username string, assetID uint) error {
	log.Username = username
	log.AssetID = assetID
	
	if err := s.db.Create(log).Error; err != nil {
		return fmt.Errorf("failed to record intercept log: %w", err)
	}

	// 记录到操作审计日志
	if s.auditService != nil {
		err := s.auditService.RecordOperationLog(
			log.UserID,
			username,
			"", // IP地址，这里可以从session中获取
			"POST",
			"/command/intercept",
			"命令拦截",
			"command",
			0, // resourceID
			log.SessionID,
			200, // status
			fmt.Sprintf("命令 %s 被策略 %s 拦截", log.Command, log.PolicyName),
			map[string]interface{}{
				"command":     log.Command,
				"policy_name": log.PolicyName,
			},
			nil, // responseData
			0,   // duration
			true, // isSystemOperation
		)
		if err != nil {
			logrus.WithError(err).Error("记录命令拦截审计日志失败")
		}
	}

	return nil
}

// 命令管理相关方法

// GetCommands 获取命令列表
func (s *CommandPolicyService) GetCommands(req *models.CommandListRequest) ([]*models.Command, int64, error) {
	var commands []*models.Command
	var total int64

	query := s.db.Model(&models.Command{})

	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Preload("Groups").
		Order("created_at DESC").
		Find(&commands).Error; err != nil {
		return nil, 0, err
	}

	return commands, total, nil
}

// CreateCommand 创建命令
func (s *CommandPolicyService) CreateCommand(req *models.CommandCreateRequest) (*models.Command, error) {
	// 验证正则表达式
	if req.Type == "regex" {
		if _, err := regexp.Compile(req.Name); err != nil {
			return nil, fmt.Errorf("invalid regex pattern: %w", err)
		}
	}

	command := &models.Command{
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
	}

	if command.Type == "" {
		command.Type = "exact"
	}

	if err := s.db.Create(command).Error; err != nil {
		return nil, err
	}

	// 清除缓存
	s.ClearCache()

	return command, nil
}

// UpdateCommand 更新命令
func (s *CommandPolicyService) UpdateCommand(id uint, req *models.CommandUpdateRequest) (*models.Command, error) {
	var command models.Command
	if err := s.db.First(&command, id).Error; err != nil {
		return nil, err
	}

	// 验证正则表达式
	if req.Type == "regex" || (req.Type == "" && command.Type == "regex" && req.Name != "") {
		nameToCheck := req.Name
		if nameToCheck == "" {
			nameToCheck = command.Name
		}
		if _, err := regexp.Compile(nameToCheck); err != nil {
			return nil, fmt.Errorf("invalid regex pattern: %w", err)
		}
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}

	if err := s.db.Model(&command).Updates(updates).Error; err != nil {
		return nil, err
	}

	// 清除缓存
	s.ClearCache()

	return &command, nil
}

// DeleteCommand 删除命令
func (s *CommandPolicyService) DeleteCommand(id uint) error {
	if err := s.db.Delete(&models.Command{}, id).Error; err != nil {
		return err
	}

	// 清除缓存
	s.ClearCache()

	return nil
}

// 命令组管理相关方法

// GetCommandGroups 获取命令组列表
func (s *CommandPolicyService) GetCommandGroups(req *models.CommandGroupListRequest) ([]*models.CommandGroup, int64, error) {
	var groups []*models.CommandGroup
	var total int64

	query := s.db.Model(&models.CommandGroup{})

	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.IsPreset != nil {
		query = query.Where("is_preset = ?", *req.IsPreset)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Preload("Commands").
		Order("created_at DESC").
		Find(&groups).Error; err != nil {
		return nil, 0, err
	}

	return groups, total, nil
}

// CreateCommandGroup 创建命令组
func (s *CommandPolicyService) CreateCommandGroup(req *models.CommandGroupCreateRequest) (*models.CommandGroup, error) {
	group := &models.CommandGroup{
		Name:        req.Name,
		Description: req.Description,
		IsPreset:    false,
	}

	// 开启事务
	tx := s.db.Begin()

	if err := tx.Create(group).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 关联命令
	if len(req.CommandIDs) > 0 {
		var commands []models.Command
		if err := tx.Find(&commands, req.CommandIDs).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Model(group).Association("Commands").Append(&commands); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	tx.Commit()

	// 清除缓存
	s.ClearCache()

	// 重新加载完整数据
	s.db.Preload("Commands").First(group, group.ID)

	return group, nil
}

// UpdateCommandGroup 更新命令组
func (s *CommandPolicyService) UpdateCommandGroup(id uint, req *models.CommandGroupUpdateRequest) (*models.CommandGroup, error) {
	var group models.CommandGroup
	if err := s.db.First(&group, id).Error; err != nil {
		return nil, err
	}

	// 预设组不能修改
	if group.IsPreset {
		return nil, fmt.Errorf("preset command group cannot be modified")
	}

	tx := s.db.Begin()

	// 更新基本信息
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}

	if len(updates) > 0 {
		if err := tx.Model(&group).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	// 更新命令关联
	if req.CommandIDs != nil {
		// 清除现有关联
		if err := tx.Model(&group).Association("Commands").Clear(); err != nil {
			tx.Rollback()
			return nil, err
		}

		// 添加新关联
		if len(req.CommandIDs) > 0 {
			var commands []models.Command
			if err := tx.Find(&commands, req.CommandIDs).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			if err := tx.Model(&group).Association("Commands").Append(&commands); err != nil {
				tx.Rollback()
				return nil, err
			}
		}
	}

	tx.Commit()

	// 清除缓存
	s.ClearCache()

	// 重新加载完整数据
	s.db.Preload("Commands").First(&group, id)

	return &group, nil
}

// DeleteCommandGroup 删除命令组
func (s *CommandPolicyService) DeleteCommandGroup(id uint) error {
	var group models.CommandGroup
	if err := s.db.First(&group, id).Error; err != nil {
		return err
	}

	// 预设组不能删除
	if group.IsPreset {
		return fmt.Errorf("preset command group cannot be deleted")
	}

	if err := s.db.Delete(&group).Error; err != nil {
		return err
	}

	// 清除缓存
	s.ClearCache()

	return nil
}

// 策略管理相关方法

// GetPolicies 获取策略列表
func (s *CommandPolicyService) GetPolicies(req *models.PolicyListRequest) ([]*models.CommandPolicy, int64, error) {
	var policies []*models.CommandPolicy
	var total int64

	query := s.db.Model(&models.CommandPolicy{})

	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Enabled != nil {
		query = query.Where("enabled = ?", *req.Enabled)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Preload("Users").
		Preload("Commands.Command").
		Preload("Commands.CommandGroup").
		Order("created_at DESC").
		Find(&policies).Error; err != nil {
		return nil, 0, err
	}

	return policies, total, nil
}

// CreatePolicy 创建策略
func (s *CommandPolicyService) CreatePolicy(req *models.PolicyCreateRequest) (*models.CommandPolicy, error) {
	policy := &models.CommandPolicy{
		Name:        req.Name,
		Description: req.Description,
		Enabled:     req.Enabled,
	}

	if err := s.db.Create(policy).Error; err != nil {
		return nil, err
	}

	return policy, nil
}

// UpdatePolicy 更新策略
func (s *CommandPolicyService) UpdatePolicy(id uint, req *models.PolicyUpdateRequest) (*models.CommandPolicy, error) {
	var policy models.CommandPolicy
	if err := s.db.First(&policy, id).Error; err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := s.db.Model(&policy).Updates(updates).Error; err != nil {
		return nil, err
	}

	// 清除相关用户的缓存
	var userIDs []uint
	s.db.Model(&models.User{}).
		Joins("JOIN policy_users ON policy_users.user_id = users.id").
		Where("policy_users.policy_id = ?", id).
		Pluck("users.id", &userIDs)

	for _, userID := range userIDs {
		s.ClearUserCache(userID)
	}

	return &policy, nil
}

// DeletePolicy 删除策略
func (s *CommandPolicyService) DeletePolicy(id uint) error {
	// 获取关联用户
	var userIDs []uint
	s.db.Model(&models.User{}).
		Joins("JOIN policy_users ON policy_users.user_id = users.id").
		Where("policy_users.policy_id = ?", id).
		Pluck("users.id", &userIDs)

	if err := s.db.Delete(&models.CommandPolicy{}, id).Error; err != nil {
		return err
	}

	// 清除相关用户的缓存
	for _, userID := range userIDs {
		s.ClearUserCache(userID)
	}

	return nil
}

// BindPolicyUsers 绑定用户到策略
func (s *CommandPolicyService) BindPolicyUsers(policyID uint, userIDs []uint) error {
	var policy models.CommandPolicy
	if err := s.db.First(&policy, policyID).Error; err != nil {
		return err
	}

	tx := s.db.Begin()

	// 清除现有用户
	if err := tx.Model(&policy).Association("Users").Clear(); err != nil {
		tx.Rollback()
		return err
	}

	// 绑定新用户
	if len(userIDs) > 0 {
		var users []models.User
		if err := tx.Find(&users, userIDs).Error; err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Model(&policy).Association("Users").Append(&users); err != nil {
			tx.Rollback()
			return err
		}
	}

	tx.Commit()

	// 清除相关用户的缓存
	for _, userID := range userIDs {
		s.ClearUserCache(userID)
	}

	return nil
}

// BindPolicyCommands 绑定命令/命令组到策略
func (s *CommandPolicyService) BindPolicyCommands(policyID uint, commandIDs, commandGroupIDs []uint) error {
	var policy models.CommandPolicy
	if err := s.db.First(&policy, policyID).Error; err != nil {
		return err
	}

	tx := s.db.Begin()

	// 删除现有的命令关联
	if err := tx.Where("policy_id = ?", policyID).Delete(&models.PolicyCommand{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 添加命令关联
	for _, cmdID := range commandIDs {
		pc := &models.PolicyCommand{
			PolicyID:  policyID,
			CommandID: &cmdID,
		}
		if err := tx.Create(pc).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// 添加命令组关联
	for _, groupID := range commandGroupIDs {
		pc := &models.PolicyCommand{
			PolicyID:       policyID,
			CommandGroupID: &groupID,
		}
		if err := tx.Create(pc).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	tx.Commit()

	// 清除相关用户的缓存
	var userIDs []uint
	s.db.Model(&models.User{}).
		Joins("JOIN policy_users ON policy_users.user_id = users.id").
		Where("policy_users.policy_id = ?", policyID).
		Pluck("users.id", &userIDs)

	for _, userID := range userIDs {
		s.ClearUserCache(userID)
	}

	return nil
}

// GetInterceptLogs 获取拦截日志
func (s *CommandPolicyService) GetInterceptLogs(req *models.InterceptLogListRequest) ([]*models.CommandInterceptLog, int64, error) {
	var logs []*models.CommandInterceptLog
	var total int64

	query := s.db.Model(&models.CommandInterceptLog{})

	if req.SessionID != "" {
		query = query.Where("session_id = ?", req.SessionID)
	}
	if req.UserID != 0 {
		query = query.Where("user_id = ?", req.UserID)
	}
	if req.AssetID != 0 {
		query = query.Where("asset_id = ?", req.AssetID)
	}
	if req.PolicyID != 0 {
		query = query.Where("policy_id = ?", req.PolicyID)
	}

	// 时间范围
	if req.StartTime != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", req.StartTime); err == nil {
			query = query.Where("intercept_time >= ?", t)
		} else if t, err := time.Parse("2006-01-02", req.StartTime); err == nil {
			query = query.Where("intercept_time >= ?", t)
		}
	}
	if req.EndTime != "" {
		if t, err := time.Parse("2006-01-02 15:04:05", req.EndTime); err == nil {
			query = query.Where("intercept_time <= ?", t)
		} else if t, err := time.Parse("2006-01-02", req.EndTime); err == nil {
			// 如果只有日期，设置为当天的最后一秒
			t = t.Add(24*time.Hour - time.Second)
			query = query.Where("intercept_time <= ?", t)
		}
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Preload("User").
		Preload("Asset").
		Preload("Policy").
		Order("intercept_time DESC").
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// 全局实例
