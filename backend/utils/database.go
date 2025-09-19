package utils

import (
	"bastion/config"
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	DB    *gorm.DB
	Redis *redis.Client
)

// InitDatabase 初始化数据库连接
func InitDatabase() error {
	// 初始化MySQL连接
	if err := initMySQL(); err != nil {
		return fmt.Errorf("failed to initialize MySQL: %w", err)
	}

	// 初始化Redis连接
	if err := initRedis(); err != nil {
		return fmt.Errorf("failed to initialize Redis: %w", err)
	}

	return nil
}

// initMySQL 初始化MySQL连接
func initMySQL() error {
	dsn := config.GlobalConfig.Database.GetDSN()

	// 设置GORM日志级别
	var logLevel logger.LogLevel
	switch config.GlobalConfig.Log.Level {
	case "debug":
		logLevel = logger.Info
	case "error":
		logLevel = logger.Error
	default:
		logLevel = logger.Warn
	}

	// 连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// 获取底层的sql.DB实例
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB instance: %w", err)
	}

	// 设置连接池参数
	sqlDB.SetMaxIdleConns(config.GlobalConfig.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(config.GlobalConfig.Database.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(config.GlobalConfig.Database.ConnMaxLifetime) * time.Second)

	// 测试连接
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB = db
	logrus.Info("MySQL database connected successfully")
	return nil
}

// initRedis 初始化Redis连接
func initRedis() error {
	rdb := redis.NewClient(&redis.Options{
		Addr:         config.GlobalConfig.Redis.GetRedisAddr(),
		Password:     config.GlobalConfig.Redis.Password,
		DB:           config.GlobalConfig.Redis.DB,
		PoolSize:     config.GlobalConfig.Redis.PoolSize,
		MinIdleConns: config.GlobalConfig.Redis.MinIdleConns,
	})

	// 测试连接
	ctx := context.Background()
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	Redis = rdb
	logrus.Info("Redis connected successfully")
	return nil
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() {
	if DB != nil {
		if sqlDB, err := DB.DB(); err == nil {
			sqlDB.Close()
			logrus.Info("MySQL database connection closed")
		}
	}

	if Redis != nil {
		Redis.Close()
		logrus.Info("Redis connection closed")
	}
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}

// GetRedis 获取Redis实例
func GetRedis() *redis.Client {
	return Redis
}
