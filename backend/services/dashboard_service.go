package services

import (
	"bastion/models"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// DashboardService 仪表盘服务
type DashboardService struct {
	db              *gorm.DB
	assetService    *AssetService
	userService     *UserService
	auditService    *AuditService
	monitorService  *MonitorService
}

// NewDashboardService 创建仪表盘服务实例
func NewDashboardService(db *gorm.DB, assetService *AssetService, userService *UserService, 
	auditService *AuditService, monitorService *MonitorService) *DashboardService {
	return &DashboardService{
		db:             db,
		assetService:   assetService,
		userService:    userService,
		auditService:   auditService,
		monitorService: monitorService,
	}
}

// GetDashboardStats 获取仪表盘统计数据
func (s *DashboardService) GetDashboardStats(userID uint, isAdmin bool) (*models.DashboardStats, error) {
	stats := &models.DashboardStats{}

	// 获取主机统计
	if err := s.getHostStats(stats, userID, isAdmin); err != nil {
		logrus.WithError(err).Error("Failed to get host stats")
		return nil, err
	}

	// 获取会话统计
	if err := s.getSessionStats(stats); err != nil {
		logrus.WithError(err).Error("Failed to get session stats")
		return nil, err
	}

	// 获取用户统计（仅管理员）
	if isAdmin {
		if err := s.getUserStats(stats); err != nil {
			logrus.WithError(err).Error("Failed to get user stats")
			return nil, err
		}
	}

	// 获取凭证统计
	if err := s.getCredentialStats(stats, userID, isAdmin); err != nil {
		logrus.WithError(err).Error("Failed to get credential stats")
		return nil, err
	}

	return stats, nil
}

// getHostStats 获取主机统计信息
func (s *DashboardService) getHostStats(stats *models.DashboardStats, userID uint, isAdmin bool) error {
	query := s.db.Model(&models.Asset{})
	
	// 非管理员只统计有权限的主机
	if !isAdmin {
		// TODO: 添加权限过滤逻辑
		query = query.Where("id IN (SELECT asset_id FROM user_asset_permissions WHERE user_id = ?)", userID)
	}

	// 总数
	if err := query.Count(int64Ptr(&stats.Hosts.Total)).Error; err != nil {
		return err
	}

	// 在线数（假设有状态字段）
	// stats.Hosts.Online = stats.Hosts.Total * 9 / 10 // 临时模拟数据

	// 分组数
	var groupCount int64
	if err := s.db.Model(&models.AssetGroup{}).Count(&groupCount).Error; err != nil {
		return err
	}
	stats.Hosts.Groups = int(groupCount)

	return nil
}

// getSessionStats 获取会话统计信息
func (s *DashboardService) getSessionStats(stats *models.DashboardStats) error {
	// 活跃会话数
	var activeCount int64
	if err := s.db.Model(&models.SessionRecord{}).
		Where("status = ?", "active").
		Count(&activeCount).Error; err != nil {
		return err
	}
	stats.Sessions.Active = int(activeCount)

	// 总会话数
	var totalCount int64
	if err := s.db.Model(&models.SessionRecord{}).Count(&totalCount).Error; err != nil {
		return err
	}
	stats.Sessions.Total = int(totalCount)

	return nil
}

// getUserStats 获取用户统计信息
func (s *DashboardService) getUserStats(stats *models.DashboardStats) error {
	// 总用户数
	var totalUsers int64
	if err := s.db.Model(&models.User{}).Count(&totalUsers).Error; err != nil {
		return err
	}
	stats.Users.Total = int(totalUsers)

	// 在线用户数（根据最近登录记录判断）
	var onlineUsers int64
	thirtyMinutesAgo := time.Now().Add(-30 * time.Minute)
	if err := s.db.Model(&models.LoginLog{}).
		Where("created_at > ? AND status = ?", thirtyMinutesAgo, "success").
		Group("user_id").
		Count(&onlineUsers).Error; err != nil {
		return err
	}
	stats.Users.Online = int(onlineUsers)

	// 今日登录数
	today := time.Now().Format("2006-01-02")
	var todayLogins int64
	if err := s.db.Model(&models.LoginLog{}).
		Where("DATE(created_at) = ? AND status = ?", today, "success").
		Group("user_id").
		Count(&todayLogins).Error; err != nil {
		return err
	}
	stats.Users.TodayLogins = int(todayLogins)

	return nil
}

// getCredentialStats 获取凭证统计信息
func (s *DashboardService) getCredentialStats(stats *models.DashboardStats, userID uint, isAdmin bool) error {
	query := s.db.Model(&models.Credential{})
	
	// 非管理员只统计有权限的凭证
	if !isAdmin {
		// TODO: 添加权限过滤逻辑
		query = query.Where("id IN (SELECT credential_id FROM user_credential_permissions WHERE user_id = ?)", userID)
	}

	// 密码凭证数
	var passwordCount int64
	if err := query.Where("type = ?", "password").Count(&passwordCount).Error; err != nil {
		return err
	}
	stats.Credentials.Passwords = int(passwordCount)

	// SSH密钥凭证数
	var sshKeyCount int64
	if err := s.db.Model(&models.Credential{}).
		Where("type = ?", "ssh_key").
		Count(&sshKeyCount).Error; err != nil {
		return err
	}
	stats.Credentials.SSHKeys = int(sshKeyCount)

	return nil
}

// GetRecentLogins 获取最近登录记录
func (s *DashboardService) GetRecentLogins(userID uint, isAdmin bool, limit int) ([]models.RecentLogin, error) {
	var sessions []models.SessionRecord
	query := s.db.Model(&models.SessionRecord{}).
		Preload("User").
		Preload("Asset").
		Order("created_at DESC").
		Limit(limit)

	// 非管理员只查看自己的记录
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.Find(&sessions).Error; err != nil {
		return nil, err
	}

	// 转换为RecentLogin格式
	recentLogins := make([]models.RecentLogin, 0, len(sessions))
	for _, session := range sessions {
		login := models.RecentLogin{
			ID:           session.ID,
			Username:     session.Username,
			AssetName:    session.AssetName,
			AssetAddress: session.AssetAddress,
			LoginTime:    session.StartTime,
			SessionID:    session.SessionID,
			Status:       string(session.Status),
		}

		// 计算执行时长
		if session.EndTime != nil {
			duration := session.EndTime.Sub(session.StartTime).Minutes()
			login.Duration = int(duration)
		} else if session.Status == "active" {
			duration := time.Since(session.StartTime).Minutes()
			login.Duration = int(duration)
		}

		// 获取凭证信息
		var credential models.Credential
		if err := s.db.First(&credential, session.CredentialID).Error; err == nil {
			login.CredentialName = fmt.Sprintf("%s@%s", credential.Username, session.AssetAddress)
		}

		recentLogins = append(recentLogins, login)
	}

	return recentLogins, nil
}

// GetHostDistribution 获取主机分组分布
func (s *DashboardService) GetHostDistribution(userID uint, isAdmin bool) ([]models.HostDistribution, error) {
	type groupCount struct {
		GroupID   uint
		GroupName string
		Count     int
	}

	var results []groupCount
	query := s.db.Table("assets").
		Select("asset_groups.id as group_id, asset_groups.name as group_name, COUNT(assets.id) as count").
		Joins("LEFT JOIN asset_groups ON assets.group_id = asset_groups.id").
		Where("assets.deleted_at IS NULL").
		Group("asset_groups.id, asset_groups.name")

	// 非管理员只统计有权限的主机
	if !isAdmin {
		// TODO: 添加权限过滤
	}

	if err := query.Scan(&results).Error; err != nil {
		return nil, err
	}

	// 计算总数和百分比
	total := 0
	for _, r := range results {
		total += r.Count
	}

	distribution := make([]models.HostDistribution, 0, len(results))
	for _, r := range results {
		groupName := r.GroupName
		if groupName == "" {
			groupName = "未分组"
		}
		
		dist := models.HostDistribution{
			GroupName: groupName,
			Count:     r.Count,
		}
		
		if total > 0 {
			dist.Percent = float64(r.Count) * 100 / float64(total)
		}
		
		distribution = append(distribution, dist)
	}

	return distribution, nil
}

// GetActivityTrends 获取活跃趋势数据
func (s *DashboardService) GetActivityTrends(days int) ([]models.ActivityTrend, error) {
	trends := make([]models.ActivityTrend, 0, days)
	
	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		
		trend := models.ActivityTrend{
			Date: dateStr,
		}

		// 统计当天会话数
		var sessionCount int64
		s.db.Model(&models.SessionRecord{}).
			Where("DATE(created_at) = ?", dateStr).
			Count(&sessionCount)
		trend.Sessions = int(sessionCount)

		// 统计当天登录数
		var loginCount int64
		s.db.Model(&models.LoginLog{}).
			Where("DATE(created_at) = ? AND status = ?", dateStr, "success").
			Count(&loginCount)
		trend.Logins = int(loginCount)

		// 统计当天命令数
		var commandCount int64
		s.db.Model(&models.CommandLog{}).
			Where("DATE(created_at) = ?", dateStr).
			Count(&commandCount)
		trend.Commands = int(commandCount)

		trends = append(trends, trend)
	}

	return trends, nil
}

// GetAuditSummary 获取审计统计摘要
func (s *DashboardService) GetAuditSummary() (*models.AuditSummary, error) {
	summary := &models.AuditSummary{}

	// 登录日志数
	var loginLogCount int64
	s.db.Model(&models.LoginLog{}).Count(&loginLogCount)
	summary.LoginLogs = int(loginLogCount)

	// 操作日志数
	var operationLogCount int64
	s.db.Model(&models.OperationLog{}).Count(&operationLogCount)
	summary.OperationLogs = int(operationLogCount)

	// 命令记录数
	var commandLogCount int64
	s.db.Model(&models.CommandLog{}).Count(&commandLogCount)
	summary.CommandRecords = int(commandLogCount)

	// 高危命令数
	var dangerCommandCount int64
	s.db.Model(&models.CommandLog{}).
		Where("risk = ?", "high").
		Count(&dangerCommandCount)
	summary.DangerCommands = int(dangerCommandCount)

	return summary, nil
}

// GetQuickAccessHosts 获取快速访问主机列表
func (s *DashboardService) GetQuickAccessHosts(userID uint, limit int) ([]models.QuickAccessHost, error) {
	// 获取用户最常访问的主机
	type hostAccess struct {
		AssetID     uint
		AccessCount int
		LastAccess  time.Time
	}

	var accessStats []hostAccess
	err := s.db.Table("session_records").
		Select("asset_id, COUNT(*) as access_count, MAX(created_at) as last_access").
		Where("user_id = ? AND created_at > ?", userID, time.Now().AddDate(0, -1, 0)).
		Group("asset_id").
		Order("access_count DESC").
		Limit(limit).
		Scan(&accessStats).Error

	if err != nil {
		return nil, err
	}

	// 获取主机详情
	hosts := make([]models.QuickAccessHost, 0, len(accessStats))
	for _, stat := range accessStats {
		var asset models.Asset
		if err := s.db.First(&asset, stat.AssetID).Error; err != nil {
			continue
		}

		// 获取默认凭证
		var credential models.Credential
		s.db.Where("asset_id = ? AND is_default = ?", asset.ID, true).First(&credential)

		host := models.QuickAccessHost{
			ID:          asset.ID,
			Name:        asset.Name,
			Address:     asset.Address,
			OS:          asset.OsType,
			AccessCount: stat.AccessCount,
			LastAccess:  &stat.LastAccess,
		}

		if credential.ID > 0 {
			host.CredentialID = credential.ID
			host.Username = credential.Username
		}

		hosts = append(hosts, host)
	}

	return hosts, nil
}

// GetCompleteDashboard 获取完整的仪表盘数据
func (s *DashboardService) GetCompleteDashboard(userID uint, isAdmin bool) (*models.DashboardResponse, error) {
	response := &models.DashboardResponse{
		LastUpdated: time.Now(),
	}

	// 获取统计数据
	stats, err := s.GetDashboardStats(userID, isAdmin)
	if err != nil {
		return nil, err
	}
	response.Stats = stats

	// 获取最近登录
	recentLogins, err := s.GetRecentLogins(userID, isAdmin, 10)
	if err != nil {
		logrus.WithError(err).Error("Failed to get recent logins")
		recentLogins = []models.RecentLogin{} // 失败时返回空数组
	}
	response.RecentLogins = recentLogins

	// 获取主机分布
	if isAdmin {
		distribution, err := s.GetHostDistribution(userID, isAdmin)
		if err != nil {
			logrus.WithError(err).Error("Failed to get host distribution")
			distribution = []models.HostDistribution{}
		}
		response.HostDistribution = distribution
	}

	// 获取活跃趋势
	trends, err := s.GetActivityTrends(7)
	if err != nil {
		logrus.WithError(err).Error("Failed to get activity trends")
		trends = []models.ActivityTrend{}
	}
	response.ActivityTrends = trends

	// 获取审计摘要
	if isAdmin {
		summary, err := s.GetAuditSummary()
		if err != nil {
			logrus.WithError(err).Error("Failed to get audit summary")
		} else {
			response.AuditSummary = summary
		}
	}

	// 获取快速访问
	quickAccess, err := s.GetQuickAccessHosts(userID, 5)
	if err != nil {
		logrus.WithError(err).Error("Failed to get quick access hosts")
		quickAccess = []models.QuickAccessHost{}
	}
	response.QuickAccess = quickAccess

	return response, nil
}

// 辅助函数：将int64指针转换
func int64Ptr(n *int) *int64 {
	val := int64(*n)
	return &val
}