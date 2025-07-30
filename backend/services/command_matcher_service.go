package services

import (
	"bastion/models"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
	"gorm.io/gorm"
)

// CommandMatcherService 命令匹配服务
type CommandMatcherService struct {
	db                    *gorm.DB
	filterService         *CommandFilterService
	regexCache           *regexCache
	filterCache          *filterCache
	commandGroupCache    *commandGroupCache
	userAssetFilterCache *userAssetFilterCache
	performanceStats     *performanceStats
}

// regexCache 正则表达式缓存
type regexCache struct {
	mu       sync.RWMutex
	cache    map[string]*compiledRegex
	tl       time.Duration
	maxSize  int
	hitCount int64
	missCount int64
}

// compiledRegex 编译后的正则表达式
type compiledRegex struct {
	regex      *regexp.Regexp
	ignoreCase bool
	cachedAt   time.Time
	lastUsed   time.Time
	useCount   int64
}

// filterCache 过滤规则缓存
type filterCache struct {
	mu        sync.RWMutex
	cache     map[string]*cachedFilter
	tl        time.Duration
	maxSize   int
	hitCount  int64
	missCount int64
}

// cachedFilter 缓存的过滤规则
type cachedFilter struct {
	filters   []models.CommandFilter
	cachedAt  time.Time
	lastUsed  time.Time
	useCount  int64
}

// commandGroupCache 命令组缓存
type commandGroupCache struct {
	mu        sync.RWMutex
	cache     map[uint]*cachedCommandGroup
	tl        time.Duration
	maxSize   int
	hitCount  int64
	missCount int64
}

// cachedCommandGroup 缓存的命令组
type cachedCommandGroup struct {
	group     *models.CommandGroup
	cachedAt  time.Time
	lastUsed  time.Time
	useCount  int64
}

// userAssetFilterCache 用户资产过滤规则缓存
type userAssetFilterCache struct {
	mu        sync.RWMutex
	cache     map[string]*cachedUserAssetFilter
	tl        time.Duration
	maxSize   int
	hitCount  int64
	missCount int64
}

// cachedUserAssetFilter 缓存的用户资产过滤规则
type cachedUserAssetFilter struct {
	filters   []models.CommandFilter
	cachedAt  time.Time
	lastUsed  time.Time
	useCount  int64
}

// performanceStats 性能统计
type performanceStats struct {
	mu                    sync.RWMutex
	totalMatches         int64
	totalMatchTime       time.Duration
	regexCacheHits       int64
	regexCacheMisses     int64
	filterCacheHits      int64
	filterCacheMisses    int64
	commandGroupCacheHits int64
	commandGroupCacheMisses int64
	userAssetCacheHits   int64
	userAssetCacheMisses int64
	lastStatsReset       time.Time
}

// NewCommandMatcherService 创建命令匹配服务实例
func NewCommandMatcherService(db *gorm.DB, filterService *CommandFilterService) *CommandMatcherService {
	service := &CommandMatcherService{
		db:            db,
		filterService: filterService,
		regexCache: &regexCache{
			cache:   make(map[string]*compiledRegex),
			tl:      30 * time.Minute, // 正则表达式缓存30分钟
			maxSize: 1000,
		},
		filterCache: &filterCache{
			cache:   make(map[string]*cachedFilter),
			tl:      10 * time.Minute, // 过滤规则缓存10分钟
			maxSize: 500,
		},
		commandGroupCache: &commandGroupCache{
			cache:   make(map[uint]*cachedCommandGroup),
			tl:      15 * time.Minute, // 命令组缓存15分钟
			maxSize: 200,
		},
		userAssetFilterCache: &userAssetFilterCache{
			cache:   make(map[string]*cachedUserAssetFilter),
			tl:      5 * time.Minute, // 用户资产过滤规则缓存5分钟
			maxSize: 1000,
		},
		performanceStats: &performanceStats{
			lastStatsReset: time.Now(),
		},
	}
	
	// 设置双向依赖，用于缓存失效通知
	if filterService != nil {
		filterService.SetMatcherService(service)
	}
	
	return service
}

// MatchCommand 匹配命令
func (s *CommandMatcherService) MatchCommand(req *models.CommandMatchRequest) (*models.CommandMatchResponse, error) {
	start := time.Now()
	defer func() {
		// 更新性能统计
		s.updatePerformanceStats(time.Since(start))
	}()

	// 获取适用的过滤规则（使用缓存优化）
	filters, err := s.getApplicableFiltersWithCache(req.UserID, req.AssetID, req.Account)
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
		matched, err := s.matchAgainstFilterWithCache(req.Command, &filter)
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

// getOrCompileRegex 获取或编译正则表达式（增强版）
func (s *CommandMatcherService) getOrCompileRegex(item *models.CommandGroupItem) (*regexp.Regexp, error) {
	// 生成缓存键（使用哈希优化）
	cacheKey := s.generateRegexCacheKey(item)
	
	// 尝试从缓存获取
	s.regexCache.mu.RLock()
	cached, exists := s.regexCache.cache[cacheKey]
	if exists && time.Since(cached.cachedAt) < s.regexCache.tl {
		// 更新使用统计
		cached.lastUsed = time.Now()
		cached.useCount++
		s.regexCache.hitCount++
		s.regexCache.mu.RUnlock()
		return cached.regex, nil
	}
	s.regexCache.mu.RUnlock()
	
	// 缓存未命中
	s.regexCache.mu.Lock()
	defer s.regexCache.mu.Unlock()
	s.regexCache.missCount++
	
	// 双重检查
	if cached, exists := s.regexCache.cache[cacheKey]; exists && time.Since(cached.cachedAt) < s.regexCache.tl {
		cached.lastUsed = time.Now()
		cached.useCount++
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
	
	// 检查缓存大小并清理过期项
	if len(s.regexCache.cache) >= s.regexCache.maxSize {
		s.cleanupRegexCache()
	}
	
	// 存入缓存
	now := time.Now()
	s.regexCache.cache[cacheKey] = &compiledRegex{
		regex:      regex,
		ignoreCase: item.IgnoreCase,
		cachedAt:   now,
		lastUsed:   now,
		useCount:   1,
	}
	
	return regex, nil
}

// logFilterMatch 记录过滤匹配日志（优化版）
func (s *CommandMatcherService) logFilterMatch(req *models.CommandMatchRequest, filter *models.CommandFilter) error {
	// 优化：使用子查询获取用户名和资产名，避免单独查询
	var result struct {
		Username string
		AssetName string
	}
	
	if err := s.db.Raw(`
		SELECT u.username, a.name as asset_name 
		FROM users u, assets a 
		WHERE u.id = ? AND a.id = ?
	`, req.UserID, req.AssetID).Scan(&result).Error; err != nil {
		return fmt.Errorf("get user and asset info failed: %w", err)
	}
	
	// 创建日志记录
	log := &models.CommandFilterLog{
		SessionID:  fmt.Sprintf("session_%d_%d_%s", req.UserID, req.AssetID, time.Now().Format("20060102150405")),
		UserID:     req.UserID,
		Username:   result.Username,
		AssetID:    req.AssetID,
		AssetName:  result.AssetName,
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
	s.regexCache.hitCount = 0
	s.regexCache.missCount = 0
}

// GetCacheStats 获取缓存统计信息
func (s *CommandMatcherService) GetCacheStats() map[string]interface{} {
	s.regexCache.mu.RLock()
	regexStats := map[string]interface{}{
		"size":      len(s.regexCache.cache),
		"max_size":  s.regexCache.maxSize,
		"hit_count": s.regexCache.hitCount,
		"miss_count": s.regexCache.missCount,
		"hit_rate":   s.calculateHitRate(s.regexCache.hitCount, s.regexCache.missCount),
	}
	s.regexCache.mu.RUnlock()

	s.filterCache.mu.RLock()
	filterStats := map[string]interface{}{
		"size":      len(s.filterCache.cache),
		"max_size":  s.filterCache.maxSize,
		"hit_count": s.filterCache.hitCount,
		"miss_count": s.filterCache.missCount,
		"hit_rate":   s.calculateHitRate(s.filterCache.hitCount, s.filterCache.missCount),
	}
	s.filterCache.mu.RUnlock()

	s.commandGroupCache.mu.RLock()
	commandGroupStats := map[string]interface{}{
		"size":      len(s.commandGroupCache.cache),
		"max_size":  s.commandGroupCache.maxSize,
		"hit_count": s.commandGroupCache.hitCount,
		"miss_count": s.commandGroupCache.missCount,
		"hit_rate":   s.calculateHitRate(s.commandGroupCache.hitCount, s.commandGroupCache.missCount),
	}
	s.commandGroupCache.mu.RUnlock()

	s.userAssetFilterCache.mu.RLock()
	userAssetStats := map[string]interface{}{
		"size":      len(s.userAssetFilterCache.cache),
		"max_size":  s.userAssetFilterCache.maxSize,
		"hit_count": s.userAssetFilterCache.hitCount,
		"miss_count": s.userAssetFilterCache.missCount,
		"hit_rate":   s.calculateHitRate(s.userAssetFilterCache.hitCount, s.userAssetFilterCache.missCount),
	}
	s.userAssetFilterCache.mu.RUnlock()

	s.performanceStats.mu.RLock()
	perfStats := map[string]interface{}{
		"total_matches":    s.performanceStats.totalMatches,
		"avg_match_time":   s.calculateAverageMatchTime(),
		"stats_duration":   time.Since(s.performanceStats.lastStatsReset).String(),
	}
	s.performanceStats.mu.RUnlock()

	return map[string]interface{}{
		"regex_cache":        regexStats,
		"filter_cache":       filterStats,
		"command_group_cache": commandGroupStats,
		"user_asset_cache":   userAssetStats,
		"performance":        perfStats,
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

// matchAgainstFilterWithCache 针对单个过滤规则匹配命令（带缓存优化）
func (s *CommandMatcherService) matchAgainstFilterWithCache(command string, filter *models.CommandFilter) (bool, error) {
	// 获取命令组（使用缓存）
	commandGroup, err := s.getCommandGroupWithCache(filter.CommandGroupID)
	if err != nil {
		return false, fmt.Errorf("get command group failed: %w", err)
	}
	
	// 检查命令组是否存在命令项
	if commandGroup == nil || len(commandGroup.Items) == 0 {
		return false, nil
	}
	
	// 遍历命令组中的所有命令项
	for _, item := range commandGroup.Items {
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

// getCommandGroupWithCache 获取命令组（带缓存）
func (s *CommandMatcherService) getCommandGroupWithCache(groupID uint) (*models.CommandGroup, error) {
	// 尝试从缓存获取
	s.commandGroupCache.mu.RLock()
	cached, exists := s.commandGroupCache.cache[groupID]
	if exists && time.Since(cached.cachedAt) < s.commandGroupCache.tl {
		// 更新使用统计
		cached.lastUsed = time.Now()
		cached.useCount++
		s.commandGroupCache.hitCount++
		s.commandGroupCache.mu.RUnlock()
		return cached.group, nil
	}
	s.commandGroupCache.mu.RUnlock()
	
	// 缓存未命中
	s.commandGroupCache.mu.Lock()
	defer s.commandGroupCache.mu.Unlock()
	s.commandGroupCache.missCount++
	
	// 双重检查
	if cached, exists := s.commandGroupCache.cache[groupID]; exists && time.Since(cached.cachedAt) < s.commandGroupCache.tl {
		cached.lastUsed = time.Now()
		cached.useCount++
		return cached.group, nil
	}
	
	// 从数据库查询
	var group models.CommandGroup
	if err := s.db.Preload("Items").First(&group, groupID).Error; err != nil {
		return nil, fmt.Errorf("query command group failed: %w", err)
	}
	
	// 检查缓存大小并清理
	if len(s.commandGroupCache.cache) >= s.commandGroupCache.maxSize {
		s.cleanupCommandGroupCache()
	}
	
	// 存入缓存
	now := time.Now()
	s.commandGroupCache.cache[groupID] = &cachedCommandGroup{
		group:    &group,
		cachedAt: now,
		lastUsed: now,
		useCount: 1,
	}
	
	return &group, nil
}

// cleanupCommandGroupCache 清理命令组缓存
func (s *CommandMatcherService) cleanupCommandGroupCache() {
	now := time.Now()
	for key, cached := range s.commandGroupCache.cache {
		if now.Sub(cached.cachedAt) > s.commandGroupCache.tl {
			delete(s.commandGroupCache.cache, key)
		}
	}
	
	// 如果缓存仍然过大，按LRU策略删除
	if len(s.commandGroupCache.cache) >= s.commandGroupCache.maxSize {
		var oldestKey uint
		var oldestTime time.Time = now
		for key, cached := range s.commandGroupCache.cache {
			if cached.lastUsed.Before(oldestTime) {
				oldestTime = cached.lastUsed
				oldestKey = key
			}
		}
		if oldestKey != 0 {
			delete(s.commandGroupCache.cache, oldestKey)
		}
	}
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

// generateRegexCacheKey 生成正则表达式缓存键
func (s *CommandMatcherService) generateRegexCacheKey(item *models.CommandGroupItem) string {
	// 使用MD5哈希优化缓存键
	hasher := md5.New()
	hasher.Write([]byte(fmt.Sprintf("%d_%s_%t", item.ID, item.Content, item.IgnoreCase)))
	return hex.EncodeToString(hasher.Sum(nil))
}

// generateUserAssetCacheKey 生成用户资产缓存键
func (s *CommandMatcherService) generateUserAssetCacheKey(userID, assetID uint, account string) string {
	hasher := md5.New()
	hasher.Write([]byte(fmt.Sprintf("%d_%d_%s", userID, assetID, account)))
	return hex.EncodeToString(hasher.Sum(nil))
}

// cleanupRegexCache 清理过期的正则表达式缓存
func (s *CommandMatcherService) cleanupRegexCache() {
	now := time.Now()
	for key, cached := range s.regexCache.cache {
		if now.Sub(cached.cachedAt) > s.regexCache.tl {
			delete(s.regexCache.cache, key)
		}
	}
	
	// 如果缓存仍然过大，按LRU策略删除
	if len(s.regexCache.cache) >= s.regexCache.maxSize {
		// 找到最少使用的缓存项
		var oldestKey string
		var oldestTime time.Time = now
		for key, cached := range s.regexCache.cache {
			if cached.lastUsed.Before(oldestTime) {
				oldestTime = cached.lastUsed
				oldestKey = key
			}
		}
		if oldestKey != "" {
			delete(s.regexCache.cache, oldestKey)
		}
	}
}

// getApplicableFiltersWithCache 获取适用的过滤规则（带缓存）
func (s *CommandMatcherService) getApplicableFiltersWithCache(userID, assetID uint, account string) ([]models.CommandFilter, error) {
	cacheKey := s.generateUserAssetCacheKey(userID, assetID, account)
	
	// 尝试从缓存获取
	s.userAssetFilterCache.mu.RLock()
	cached, exists := s.userAssetFilterCache.cache[cacheKey]
	if exists && time.Since(cached.cachedAt) < s.userAssetFilterCache.tl {
		// 更新使用统计
		cached.lastUsed = time.Now()
		cached.useCount++
		s.userAssetFilterCache.hitCount++
		s.userAssetFilterCache.mu.RUnlock()
		return cached.filters, nil
	}
	s.userAssetFilterCache.mu.RUnlock()
	
	// 缓存未命中，从数据库查询
	s.userAssetFilterCache.mu.Lock()
	defer s.userAssetFilterCache.mu.Unlock()
	s.userAssetFilterCache.missCount++
	
	// 双重检查
	if cached, exists := s.userAssetFilterCache.cache[cacheKey]; exists && time.Since(cached.cachedAt) < s.userAssetFilterCache.tl {
		cached.lastUsed = time.Now()
		cached.useCount++
		return cached.filters, nil
	}
	
	// 从FilterService获取数据
	filters, err := s.filterService.GetApplicableFilters(userID, assetID, account)
	if err != nil {
		return nil, err
	}
	
	// 检查缓存大小并清理
	if len(s.userAssetFilterCache.cache) >= s.userAssetFilterCache.maxSize {
		s.cleanupUserAssetFilterCache()
	}
	
	// 存入缓存
	now := time.Now()
	s.userAssetFilterCache.cache[cacheKey] = &cachedUserAssetFilter{
		filters:  filters,
		cachedAt: now,
		lastUsed: now,
		useCount: 1,
	}
	
	return filters, nil
}

// cleanupUserAssetFilterCache 清理用户资产过滤规则缓存
func (s *CommandMatcherService) cleanupUserAssetFilterCache() {
	now := time.Now()
	for key, cached := range s.userAssetFilterCache.cache {
		if now.Sub(cached.cachedAt) > s.userAssetFilterCache.tl {
			delete(s.userAssetFilterCache.cache, key)
		}
	}
	
	// 如果缓存仍然过大，按LRU策略删除
	if len(s.userAssetFilterCache.cache) >= s.userAssetFilterCache.maxSize {
		var oldestKey string
		var oldestTime time.Time = now
		for key, cached := range s.userAssetFilterCache.cache {
			if cached.lastUsed.Before(oldestTime) {
				oldestTime = cached.lastUsed
				oldestKey = key
			}
		}
		if oldestKey != "" {
			delete(s.userAssetFilterCache.cache, oldestKey)
		}
	}
}

// updatePerformanceStats 更新性能统计
func (s *CommandMatcherService) updatePerformanceStats(duration time.Duration) {
	s.performanceStats.mu.Lock()
	defer s.performanceStats.mu.Unlock()
	
	s.performanceStats.totalMatches++
	s.performanceStats.totalMatchTime += duration
}

// calculateHitRate 计算缓存命中率
func (s *CommandMatcherService) calculateHitRate(hits, misses int64) float64 {
	total := hits + misses
	if total == 0 {
		return 0
	}
	return float64(hits) / float64(total) * 100
}

// calculateAverageMatchTime 计算平均匹配时间
func (s *CommandMatcherService) calculateAverageMatchTime() time.Duration {
	if s.performanceStats.totalMatches == 0 {
		return 0
	}
	return s.performanceStats.totalMatchTime / time.Duration(s.performanceStats.totalMatches)
}

// ResetPerformanceStats 重置性能统计
func (s *CommandMatcherService) ResetPerformanceStats() {
	s.performanceStats.mu.Lock()
	defer s.performanceStats.mu.Unlock()
	
	s.performanceStats.totalMatches = 0
	s.performanceStats.totalMatchTime = 0
	s.performanceStats.regexCacheHits = 0
	s.performanceStats.regexCacheMisses = 0
	s.performanceStats.filterCacheHits = 0
	s.performanceStats.filterCacheMisses = 0
	s.performanceStats.commandGroupCacheHits = 0
	s.performanceStats.commandGroupCacheMisses = 0
	s.performanceStats.userAssetCacheHits = 0
	s.performanceStats.userAssetCacheMisses = 0
	s.performanceStats.lastStatsReset = time.Now()
}

// InvalidateUserAssetCache 使指定用户资产的缓存失效
func (s *CommandMatcherService) InvalidateUserAssetCache(userID, assetID uint, account string) {
	cacheKey := s.generateUserAssetCacheKey(userID, assetID, account)
	
	s.userAssetFilterCache.mu.Lock()
	defer s.userAssetFilterCache.mu.Unlock()
	
	delete(s.userAssetFilterCache.cache, cacheKey)
}

// InvalidateFilterCacheByFilterID 使指定过滤规则相关缓存失效
func (s *CommandMatcherService) InvalidateFilterCacheByFilterID(filterID uint) {
	// 清除用户资产过滤规则缓存（简单策略：全部清除）
	s.ClearUserAssetFilterCache()
	// 在实际场景中，可以根据filterID更精确地清除相关缓存
}

// InvalidateCommandGroupCache 使指定命令组缓存失效
func (s *CommandMatcherService) InvalidateCommandGroupCache(groupID uint) {
	s.commandGroupCache.mu.Lock()
	defer s.commandGroupCache.mu.Unlock()
	
	delete(s.commandGroupCache.cache, groupID)
}

// ClearAllCaches 清除所有缓存
func (s *CommandMatcherService) ClearAllCaches() {
	s.ClearRegexCache()
	s.ClearFilterCache()
	s.ClearCommandGroupCache()
	s.ClearUserAssetFilterCache()
}

// ClearFilterCache 清除过滤规则缓存
func (s *CommandMatcherService) ClearFilterCache() {
	s.filterCache.mu.Lock()
	defer s.filterCache.mu.Unlock()
	
	s.filterCache.cache = make(map[string]*cachedFilter)
	s.filterCache.hitCount = 0
	s.filterCache.missCount = 0
}

// ClearCommandGroupCache 清除命令组缓存
func (s *CommandMatcherService) ClearCommandGroupCache() {
	s.commandGroupCache.mu.Lock()
	defer s.commandGroupCache.mu.Unlock()
	
	s.commandGroupCache.cache = make(map[uint]*cachedCommandGroup)
	s.commandGroupCache.hitCount = 0
	s.commandGroupCache.missCount = 0
}

// ClearUserAssetFilterCache 清除用户资产过滤规则缓存
func (s *CommandMatcherService) ClearUserAssetFilterCache() {
	s.userAssetFilterCache.mu.Lock()
	defer s.userAssetFilterCache.mu.Unlock()
	
	s.userAssetFilterCache.cache = make(map[string]*cachedUserAssetFilter)
	s.userAssetFilterCache.hitCount = 0
	s.userAssetFilterCache.missCount = 0
}