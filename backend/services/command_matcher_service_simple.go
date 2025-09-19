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

// CommandMatcherServiceSimple 简化版命令匹配服务
type CommandMatcherServiceSimple struct {
	db            *gorm.DB
	filterService *CommandFilterService
	regexCache    *simpleRegexCache
}

// simpleRegexCache 简单的正则表达式缓存
type simpleRegexCache struct {
	mu    sync.RWMutex
	cache map[string]*regexp.Regexp
}

// NewCommandMatcherServiceSimple 创建简化版命令匹配服务实例
func NewCommandMatcherServiceSimple(db *gorm.DB, filterService *CommandFilterService) *CommandMatcherServiceSimple {
	return &CommandMatcherServiceSimple{
		db:            db,
		filterService: filterService,
		regexCache: &simpleRegexCache{
			cache: make(map[string]*regexp.Regexp),
		},
	}
}

// MatchCommand 匹配命令（简化版）
func (s *CommandMatcherServiceSimple) MatchCommand(req *models.CommandMatchRequest) (*models.CommandMatchResponse, error) {
	// 获取适用的过滤规则（优化的单次查询）
	filters, err := s.getApplicableFiltersOptimized(req.UserID, req.AssetID, req.Account)
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
			// 记录日志（异步）
			go s.logFilterMatchAsync(req, &filter)
			
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
	
	return &models.CommandMatchResponse{
		Matched: false,
		Reason:  "Command not matched by any filter",
	}, nil
}

// getApplicableFiltersOptimized 优化的获取适用过滤规则（单次查询）
func (s *CommandMatcherServiceSimple) getApplicableFiltersOptimized(userID, assetID uint, account string) ([]models.CommandFilter, error) {
	var filters []models.CommandFilter
	
	// 使用优化的SQL查询，一次性获取所有数据
	query := `
		SELECT DISTINCT cf.*, cg.name as command_group_name
		FROM command_filters cf
		LEFT JOIN command_groups cg ON cf.command_group_id = cg.id
		LEFT JOIN filter_users fu ON cf.id = fu.filter_id
		LEFT JOIN filter_assets fa ON cf.id = fa.filter_id
		WHERE cf.enabled = true
		AND (
			-- 用户条件
			cf.user_type = 'all' 
			OR (cf.user_type = 'specific' AND fu.user_id = ?)
		)
		AND (
			-- 资产条件  
			cf.asset_type = 'all'
			OR (cf.asset_type = 'specific' AND fa.asset_id = ?)
		)
		AND (
			-- 账号条件
			cf.account_type = 'all'
			OR (cf.account_type = 'specific' AND (
				cf.account_names = ? 
				OR cf.account_names LIKE ?
				OR cf.account_names LIKE ?
				OR cf.account_names LIKE ?
			))
		)
		ORDER BY cf.priority ASC, cf.id ASC
	`
	
	accountLike1 := account + ",%"
	accountLike2 := "%," + account
	accountLike3 := "%," + account + ",%"
	
	if err := s.db.Raw(query, userID, assetID, account, accountLike1, accountLike2, accountLike3).Scan(&filters).Error; err != nil {
		return nil, fmt.Errorf("query applicable filters failed: %w", err)
	}
	
	// 为每个过滤规则加载命令组项（批量查询）
	if len(filters) > 0 {
		filterIDs := make([]uint, len(filters))
		for i, filter := range filters {
			filterIDs[i] = filter.CommandGroupID
		}
		
		var commandGroups []models.CommandGroup
		if err := s.db.Where("id IN ?", filterIDs).Preload("Items").Find(&commandGroups).Error; err != nil {
			return nil, fmt.Errorf("query command groups failed: %w", err)
		}
		
		// 建立映射关系
		groupMap := make(map[uint]*models.CommandGroup)
		for i := range commandGroups {
			groupMap[commandGroups[i].ID] = &commandGroups[i]
		}
		
		// 关联到过滤规则
		for i := range filters {
			if group, exists := groupMap[filters[i].CommandGroupID]; exists {
				filters[i].CommandGroup = group
			}
		}
	}
	
	return filters, nil
}

// matchAgainstFilter 针对单个过滤规则匹配命令
func (s *CommandMatcherServiceSimple) matchAgainstFilter(command string, filter *models.CommandFilter) (bool, error) {
	if filter.CommandGroup == nil || len(filter.CommandGroup.Items) == 0 {
		return false, nil
	}
	
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
func (s *CommandMatcherServiceSimple) matchCommandItem(command string, item *models.CommandGroupItem) (bool, error) {
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
func (s *CommandMatcherServiceSimple) matchExact(command string, item *models.CommandGroupItem) bool {
	if item.IgnoreCase {
		return strings.EqualFold(command, item.Content)
	}
	return command == item.Content
}

// matchRegex 正则表达式匹配（带缓存）
func (s *CommandMatcherServiceSimple) matchRegex(command string, item *models.CommandGroupItem) (bool, error) {
	regex, err := s.getOrCompileRegex(item)
	if err != nil {
		return false, fmt.Errorf("compile regex failed: %w", err)
	}
	
	return regex.MatchString(command), nil
}

// getOrCompileRegex 获取或编译正则表达式（简化版缓存）
func (s *CommandMatcherServiceSimple) getOrCompileRegex(item *models.CommandGroupItem) (*regexp.Regexp, error) {
	// 生成简单的缓存键
	cacheKey := fmt.Sprintf("%d_%s_%t", item.ID, item.Content, item.IgnoreCase)
	
	// 尝试从缓存获取
	s.regexCache.mu.RLock()
	if cached, exists := s.regexCache.cache[cacheKey]; exists {
		s.regexCache.mu.RUnlock()
		return cached, nil
	}
	s.regexCache.mu.RUnlock()
	
	// 编译正则表达式
	pattern := item.Content
	if item.IgnoreCase {
		pattern = "(?i)" + pattern
	}
	
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, fmt.Errorf("invalid regex pattern: %w", err)
	}
	
	// 存入缓存（简单策略：无TTL，无大小限制）
	s.regexCache.mu.Lock()
	s.regexCache.cache[cacheKey] = regex
	s.regexCache.mu.Unlock()
	
	return regex, nil
}

// logFilterMatchAsync 异步记录过滤匹配日志
func (s *CommandMatcherServiceSimple) logFilterMatchAsync(req *models.CommandMatchRequest, filter *models.CommandFilter) {
	// 优化：使用单次查询获取用户名和资产名
	var result struct {
		Username  string
		AssetName string
	}
	
	if err := s.db.Raw(`
		SELECT u.username, a.name as asset_name 
		FROM users u, assets a 
		WHERE u.id = ? AND a.id = ?
	`, req.UserID, req.AssetID).Scan(&result).Error; err != nil {
		// 日志记录失败不影响主流程，只记录错误
		fmt.Printf("Failed to get user/asset info for logging: %v\n", err)
		return
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
		fmt.Printf("Failed to create filter log: %v\n", err)
	}
}

// ClearRegexCache 清除正则表达式缓存
func (s *CommandMatcherServiceSimple) ClearRegexCache() {
	s.regexCache.mu.Lock()
	defer s.regexCache.mu.Unlock()
	
	s.regexCache.cache = make(map[string]*regexp.Regexp)
}

// GetCacheStats 获取简单的缓存统计
func (s *CommandMatcherServiceSimple) GetCacheStats() map[string]interface{} {
	s.regexCache.mu.RLock()
	defer s.regexCache.mu.RUnlock()
	
	return map[string]interface{}{
		"regex_cache_size": len(s.regexCache.cache),
	}
}