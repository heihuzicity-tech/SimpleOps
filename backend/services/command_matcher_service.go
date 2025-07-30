package services

import (
	"bastion/models"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
	"gorm.io/gorm"
)

// CommandMatcherService 命令匹配服务
type CommandMatcherService struct {
	db            *gorm.DB
	filterService *CommandFilterService
	regexCache    *regexCache
}

// regexCache 正则表达式缓存
type regexCache struct {
	mu    sync.RWMutex
	cache map[string]*compiledRegex
}

// compiledRegex 编译后的正则表达式
type compiledRegex struct {
	regex      *regexp.Regexp
	ignoreCase bool
	compiledAt time.Time
}

// NewCommandMatcherService 创建命令匹配服务实例
func NewCommandMatcherService(db *gorm.DB, filterService *CommandFilterService) *CommandMatcherService {
	return &CommandMatcherService{
		db:            db,
		filterService: filterService,
		regexCache: &regexCache{
			cache: make(map[string]*compiledRegex),
		},
	}
}

// MatchCommand 匹配命令
func (s *CommandMatcherService) MatchCommand(req *models.CommandMatchRequest) (*models.CommandMatchResponse, error) {
	// 获取适用的过滤规则
	filters, err := s.filterService.GetApplicableFilters(req.UserID, req.AssetID, req.Account)
	if err != nil {
		return nil, fmt.Errorf("get applicable filters failed: %w", err)
	}
	
	// 如果没有适用的规则，默认允许
	if len(filters) == 0 {
		return &models.CommandMatchResponse{
			Matched: false,
			Reason:  "No applicable filter rules",
		}, nil
	}
	
	// 按优先级依次匹配
	for _, filter := range filters {
		matched, err := s.matchAgainstFilter(req.Command, &filter)
		if err != nil {
			return nil, fmt.Errorf("match against filter failed: %w", err)
		}
		
		if matched {
			// 记录日志
			if err := s.logFilterMatch(req, &filter); err != nil {
				// 日志记录失败不影响匹配结果
				fmt.Printf("log filter match failed: %v\n", err)
			}
			
			return &models.CommandMatchResponse{
				Matched:    true,
				Action:     filter.Action,
				FilterID:   filter.ID,
				FilterName: filter.Name,
				Priority:   filter.Priority,
				Reason:     fmt.Sprintf("Matched by filter: %s", filter.Name),
			}, nil
		}
	}
	
	// 没有匹配到任何规则
	return &models.CommandMatchResponse{
		Matched: false,
		Reason:  "Command not matched by any filter",
	}, nil
}

// matchAgainstFilter 针对单个过滤规则匹配命令
func (s *CommandMatcherService) matchAgainstFilter(command string, filter *models.CommandFilter) (bool, error) {
	// 检查命令组是否存在命令项
	if filter.CommandGroup == nil || len(filter.CommandGroup.Items) == 0 {
		return false, nil
	}
	
	// 遍历命令组中的所有命令项
	for _, item := range filter.CommandGroup.Items {
		matched, err := s.matchCommandItem(command, &item)
		if err != nil {
			return false, fmt.Errorf("match command item failed: %w", err)
		}
		
		if matched {
			return true, nil
		}
	}
	
	return false, nil
}

// matchCommandItem 匹配单个命令项
func (s *CommandMatcherService) matchCommandItem(command string, item *models.CommandGroupItem) (bool, error) {
	switch item.Type {
	case models.CommandTypeExact:
		return s.matchExact(command, item), nil
	case models.CommandTypeRegex:
		return s.matchRegex(command, item)
	default:
		return false, fmt.Errorf("unknown command type: %s", item.Type)
	}
}

// matchExact 精确匹配
func (s *CommandMatcherService) matchExact(command string, item *models.CommandGroupItem) bool {
	if item.IgnoreCase {
		return strings.EqualFold(command, item.Content)
	}
	return command == item.Content
}

// matchRegex 正则表达式匹配
func (s *CommandMatcherService) matchRegex(command string, item *models.CommandGroupItem) (bool, error) {
	// 获取或编译正则表达式
	regex, err := s.getOrCompileRegex(item)
	if err != nil {
		return false, fmt.Errorf("compile regex failed: %w", err)
	}
	
	return regex.MatchString(command), nil
}

// getOrCompileRegex 获取或编译正则表达式
func (s *CommandMatcherService) getOrCompileRegex(item *models.CommandGroupItem) (*regexp.Regexp, error) {
	// 生成缓存键
	cacheKey := fmt.Sprintf("%d_%s_%t", item.ID, item.Content, item.IgnoreCase)
	
	// 尝试从缓存获取
	s.regexCache.mu.RLock()
	cached, exists := s.regexCache.cache[cacheKey]
	s.regexCache.mu.RUnlock()
	
	if exists {
		return cached.regex, nil
	}
	
	// 编译正则表达式
	pattern := item.Content
	if item.IgnoreCase {
		pattern = "(?i)" + pattern
	}
	
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %w", err)
	}
	
	// 存入缓存
	s.regexCache.mu.Lock()
	s.regexCache.cache[cacheKey] = &compiledRegex{
		regex:      regex,
		ignoreCase: item.IgnoreCase,
		compiledAt: time.Now(),
	}
	s.regexCache.mu.Unlock()
	
	return regex, nil
}

// logFilterMatch 记录过滤匹配日志
func (s *CommandMatcherService) logFilterMatch(req *models.CommandMatchRequest, filter *models.CommandFilter) error {
	// 查询用户和资产信息
	var user models.User
	var asset models.Asset
	
	if err := s.db.Select("id, username").First(&user, req.UserID).Error; err != nil {
		return fmt.Errorf("get user failed: %w", err)
	}
	
	if err := s.db.Select("id, name").First(&asset, req.AssetID).Error; err != nil {
		return fmt.Errorf("get asset failed: %w", err)
	}
	
	// 创建日志记录
	log := &models.CommandFilterLog{
		SessionID:  fmt.Sprintf("session_%d_%d_%s", req.UserID, req.AssetID, time.Now().Format("20060102150405")),
		UserID:     req.UserID,
		Username:   user.Username,
		AssetID:    req.AssetID,
		AssetName:  asset.Name,
		Account:    req.Account,
		Command:    req.Command,
		FilterID:   filter.ID,
		FilterName: filter.Name,
		Action:     filter.Action,
		CreatedAt:  time.Now(),
	}
	
	if err := s.db.Create(log).Error; err != nil {
		return fmt.Errorf("create filter log failed: %w", err)
	}
	
	return nil
}

// ClearRegexCache 清除正则表达式缓存
func (s *CommandMatcherService) ClearRegexCache() {
	s.regexCache.mu.Lock()
	defer s.regexCache.mu.Unlock()
	
	s.regexCache.cache = make(map[string]*compiledRegex)
}

// GetCacheStats 获取缓存统计信息
func (s *CommandMatcherService) GetCacheStats() map[string]interface{} {
	s.regexCache.mu.RLock()
	defer s.regexCache.mu.RUnlock()
	
	return map[string]interface{}{
		"cache_size": len(s.regexCache.cache),
		"items":      len(s.regexCache.cache),
	}
}

// TestCommandMatch 测试命令匹配（用于调试）
func (s *CommandMatcherService) TestCommandMatch(command string, groupID uint) ([]models.CommandGroupItem, error) {
	var matchedItems []models.CommandGroupItem
	
	// 获取命令组的所有项
	var items []models.CommandGroupItem
	if err := s.db.Where("command_group_id = ?", groupID).
		Order("sort_order, id").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("get command group items failed: %w", err)
	}
	
	// 测试每个命令项
	for _, item := range items {
		matched, err := s.matchCommandItem(command, &item)
		if err != nil {
			continue
		}
		
		if matched {
			matchedItems = append(matchedItems, item)
		}
	}
	
	return matchedItems, nil
}

// BatchMatchCommands 批量匹配命令
func (s *CommandMatcherService) BatchMatchCommands(commands []string, userID uint, assetID uint, account string) (map[string]*models.CommandMatchResponse, error) {
	results := make(map[string]*models.CommandMatchResponse)
	
	for _, cmd := range commands {
		req := &models.CommandMatchRequest{
			Command: cmd,
			UserID:  userID,
			AssetID: assetID,
			Account: account,
		}
		
		resp, err := s.MatchCommand(req)
		if err != nil {
			return nil, fmt.Errorf("match command %s failed: %w", cmd, err)
		}
		
		results[cmd] = resp
	}
	
	return results, nil
}

// GetFilterLogs 获取过滤日志
func (s *CommandMatcherService) GetFilterLogs(req *models.CommandFilterLogListRequest) (*models.PageResponse, error) {
	var total int64
	var logs []models.CommandFilterLog
	
	query := s.db.Model(&models.CommandFilterLog{})
	
	// 搜索条件
	if req.UserID != 0 {
		query = query.Where("user_id = ?", req.UserID)
	}
	if req.AssetID != 0 {
		query = query.Where("asset_id = ?", req.AssetID)
	}
	if req.FilterID != 0 {
		query = query.Where("filter_id = ?", req.FilterID)
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	if req.StartTime != "" {
		query = query.Where("created_at >= ?", req.StartTime)
	}
	if req.EndTime != "" {
		query = query.Where("created_at <= ?", req.EndTime)
	}
	
	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("count filter logs failed: %w", err)
	}
	
	// 分页查询
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Order("created_at DESC").
		Find(&logs).Error; err != nil {
		return nil, fmt.Errorf("query filter logs failed: %w", err)
	}
	
	// 构建响应
	responses := make([]models.CommandFilterLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = models.CommandFilterLogResponse{
			ID:         log.ID,
			SessionID:  log.SessionID,
			UserID:     log.UserID,
			Username:   log.Username,
			AssetID:    log.AssetID,
			AssetName:  log.AssetName,
			Account:    log.Account,
			Command:    log.Command,
			FilterID:   log.FilterID,
			FilterName: log.FilterName,
			Action:     log.Action,
			CreatedAt:  log.CreatedAt,
		}
	}
	
	return &models.PageResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     responses,
	}, nil
}

// GetLogStatistics 获取日志统计信息
func (s *CommandMatcherService) GetLogStatistics(req *models.CommandFilterLogStatsRequest) (*models.CommandFilterLogStatsResponse, error) {
	query := s.db.Model(&models.CommandFilterLog{})
	
	// 时间范围
	if req.StartTime != nil {
		query = query.Where("created_at >= ?", *req.StartTime)
	}
	if req.EndTime != nil {
		query = query.Where("created_at <= ?", *req.EndTime)
	}
	
	// 总数统计
	var totalCount int64
	if err := query.Count(&totalCount).Error; err != nil {
		return nil, fmt.Errorf("count total logs failed: %w", err)
	}
	
	// 按动作分组统计
	var actionStats []struct {
		Action string
		Count  int64
	}
	if err := s.db.Model(&models.CommandFilterLog{}).
		Select("action, COUNT(*) as count").
		Group("action").
		Scan(&actionStats).Error; err != nil {
		return nil, fmt.Errorf("get action stats failed: %w", err)
	}
	
	// 构建动作统计映射
	actionCounts := make(map[string]int64)
	for _, stat := range actionStats {
		actionCounts[stat.Action] = stat.Count
	}
	
	// 最活跃用户
	var topUsers []struct {
		UserID   uint
		Username string
		Count    int64
	}
	if err := s.db.Model(&models.CommandFilterLog{}).
		Select("user_id, username, COUNT(*) as count").
		Group("user_id, username").
		Order("count DESC").
		Limit(10).
		Scan(&topUsers).Error; err != nil {
		return nil, fmt.Errorf("get top users failed: %w", err)
	}
	
	// 最常触发的规则
	var topFilters []struct {
		FilterID   uint
		FilterName string
		Count      int64
	}
	if err := s.db.Model(&models.CommandFilterLog{}).
		Select("filter_id, filter_name, COUNT(*) as count").
		Group("filter_id, filter_name").
		Order("count DESC").
		Limit(10).
		Scan(&topFilters).Error; err != nil {
		return nil, fmt.Errorf("get top filters failed: %w", err)
	}
	
	// 构建响应
	response := &models.CommandFilterLogStatsResponse{
		TotalCount:   totalCount,
		ActionCounts: actionCounts,
		TopUsers:     make([]models.TopUser, len(topUsers)),
		TopFilters:   make([]models.TopFilter, len(topFilters)),
	}
	
	for i, user := range topUsers {
		response.TopUsers[i] = models.TopUser{
			UserID:   user.UserID,
			Username: user.Username,
			Count:    user.Count,
		}
	}
	
	for i, filter := range topFilters {
		response.TopFilters[i] = models.TopFilter{
			FilterID:   filter.FilterID,
			FilterName: filter.FilterName,
			Count:      filter.Count,
		}
	}
	
	return response, nil
}