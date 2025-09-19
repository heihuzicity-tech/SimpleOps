// 优化后的查询方法
// 解决N+1查询问题，提升性能

// GetCommands 获取命令列表 - 优化版本
func (s *CommandPolicyService) GetCommandsOptimized(req *models.CommandListRequest) ([]*models.Command, int64, error) {
	var commands []*models.Command
	var total int64

	query := s.db.Model(&models.Command{})

	// 使用索引优化的查询条件
	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}

	// 优化：使用单独的计数查询，避免复杂的join
	countQuery := s.db.Model(&models.Command{})
	if req.Name != "" {
		countQuery = countQuery.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Type != "" {
		countQuery = countQuery.Where("type = ?", req.Type)
	}
	
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询 - 移除Preload，减少查询复杂度
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Order("created_at DESC").
		Find(&commands).Error; err != nil {
		return nil, 0, err
	}

	// 如果需要Groups信息，使用批量查询而不是Preload
	if len(commands) > 0 {
		commandIDs := make([]uint, len(commands))
		for i, cmd := range commands {
			commandIDs[i] = cmd.ID
		}

		// 批量查询命令组关联
		var commandGroups []struct {
			CommandID uint `gorm:"column:command_id"`
			GroupID   uint `gorm:"column:command_group_id"`
			GroupName string `gorm:"column:name"`
		}

		err := s.db.Table("command_group_commands").
			Select("command_group_commands.command_id, command_group_commands.command_group_id, command_groups.name").
			Joins("LEFT JOIN command_groups ON command_groups.id = command_group_commands.command_group_id").
			Where("command_group_commands.command_id IN ?", commandIDs).
			Scan(&commandGroups).Error

		if err == nil {
			// 将组信息映射到命令
			groupMap := make(map[uint][]models.CommandGroup)
			for _, cg := range commandGroups {
				groupMap[cg.CommandID] = append(groupMap[cg.CommandID], models.CommandGroup{
					ID:   cg.GroupID,
					Name: cg.GroupName,
				})
			}

			for _, cmd := range commands {
				if groups, exists := groupMap[cmd.ID]; exists {
					cmd.Groups = groups
				}
			}
		}
	}

	return commands, total, nil
}

// GetPolicies 获取策略列表 - 优化版本
func (s *CommandPolicyService) GetPoliciesOptimized(req *models.PolicyListRequest) ([]*models.CommandPolicy, int64, error) {
	var policies []*models.CommandPolicy
	var total int64

	query := s.db.Model(&models.CommandPolicy{})

	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Enabled != nil {
		query = query.Where("enabled = ?", *req.Enabled)
	}

	// 使用优化的计数查询
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 基础分页查询，不使用Preload
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).
		Order("created_at DESC").
		Find(&policies).Error; err != nil {
		return nil, 0, err
	}

	// 批量加载关联数据
	if len(policies) > 0 {
		policyIDs := make([]uint, len(policies))
		for i, policy := range policies {
			policyIDs[i] = policy.ID
		}

		// 批量查询用户关联
		var policyUsers []struct {
			PolicyID uint   `gorm:"column:policy_id"`
			UserID   uint   `gorm:"column:user_id"`
			Username string `gorm:"column:username"`
		}

		err := s.db.Table("policy_users").
			Select("policy_users.policy_id, policy_users.user_id, users.username").
			Joins("LEFT JOIN users ON users.id = policy_users.user_id").
			Where("policy_users.policy_id IN ?", policyIDs).
			Scan(&policyUsers).Error

		if err == nil {
			userMap := make(map[uint][]models.User)
			for _, pu := range policyUsers {
				userMap[pu.PolicyID] = append(userMap[pu.PolicyID], models.User{
					ID:       pu.UserID,
					Username: pu.Username,
				})
			}

			for _, policy := range policies {
				if users, exists := userMap[policy.ID]; exists {
					policy.Users = users
				}
			}
		}

		// 批量查询命令关联（简化版本，只获取必要信息）
		var policyCommands []struct {
			PolicyID  uint   `gorm:"column:policy_id"`
			CommandID *uint  `gorm:"column:command_id"`
			GroupID   *uint  `gorm:"column:command_group_id"`
			Name      string `gorm:"column:name"`
			Type      string `gorm:"column:type"`
		}

		// 简化的关联查询，避免深层嵌套
		err = s.db.Table("policy_commands").
			Select(`policy_commands.policy_id, 
			        policy_commands.command_id, 
			        policy_commands.command_group_id,
			        COALESCE(commands.name, command_groups.name) as name,
			        COALESCE(commands.type, 'group') as type`).
			Joins("LEFT JOIN commands ON commands.id = policy_commands.command_id").
			Joins("LEFT JOIN command_groups ON command_groups.id = policy_commands.command_group_id").
			Where("policy_commands.policy_id IN ?", policyIDs).
			Scan(&policyCommands).Error

		if err == nil {
			commandMap := make(map[uint][]models.PolicyCommand)
			for _, pc := range policyCommands {
				commandMap[pc.PolicyID] = append(commandMap[pc.PolicyID], models.PolicyCommand{
					PolicyID:       pc.PolicyID,
					CommandID:      pc.CommandID,
					CommandGroupID: pc.GroupID,
				})
			}

			for _, policy := range policies {
				if commands, exists := commandMap[policy.ID]; exists {
					policy.Commands = commands
				}
			}
		}
	}

	return policies, total, nil
}

// 添加查询缓存支持
type QueryCache struct {
	cache map[string]interface{}
	mutex sync.RWMutex
	ttl   time.Duration
}

func NewQueryCache(ttl time.Duration) *QueryCache {
	return &QueryCache{
		cache: make(map[string]interface{}),
		ttl:   ttl,
	}
}

func (c *QueryCache) Get(key string) (interface{}, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	
	value, exists := c.cache[key]
	return value, exists
}

func (c *QueryCache) Set(key string, value interface{}) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	c.cache[key] = value
	
	// 简单的TTL实现
	go func() {
		time.Sleep(c.ttl)
		c.mutex.Lock()
		delete(c.cache, key)
		c.mutex.Unlock()
	}()
}