package config

import (
	"fmt"

	"github.com/spf13/viper"
)

// Config 应用程序配置结构
type Config struct {
	App       AppConfig         `mapstructure:"app"`
	Database  DatabaseConfig    `mapstructure:"database"`
	Redis     RedisConfig       `mapstructure:"redis"`
	JWT       JWTConfig         `mapstructure:"jwt"`
	Log       LogConfig         `mapstructure:"log"`
	SSH       SSHConfig         `mapstructure:"ssh"`
	Session   SessionConfig     `mapstructure:"session"`
	Security  SecurityConfig    `mapstructure:"security"`
	Upload    UploadConfig      `mapstructure:"upload"`
	Monitoring MonitoringConfig `mapstructure:"monitoring"`
	Audit     AuditConfig       `mapstructure:"audit"`
	WebSocket WebSocketConfig   `mapstructure:"websocket"`
	Monitor   MonitorConfig     `mapstructure:"monitor"`
}

// AppConfig 应用程序配置
type AppConfig struct {
	Name    string `mapstructure:"name"`
	Version string `mapstructure:"version"`
	Mode    string `mapstructure:"mode"`
	Port    int    `mapstructure:"port"`
	Host    string `mapstructure:"host"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Type            string `mapstructure:"type"`
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	Username        string `mapstructure:"username"`
	Password        string `mapstructure:"password"`
	DBName          string `mapstructure:"dbname"`
	Charset         string `mapstructure:"charset"`
	ParseTime       bool   `mapstructure:"parseTime"`
	Loc             string `mapstructure:"loc"`
	MaxIdleConns    int    `mapstructure:"maxIdleConns"`
	MaxOpenConns    int    `mapstructure:"maxOpenConns"`
	ConnMaxLifetime int    `mapstructure:"connMaxLifetime"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Password     string `mapstructure:"password"`
	DB           int    `mapstructure:"db"`
	PoolSize     int    `mapstructure:"poolSize"`
	MinIdleConns int    `mapstructure:"minIdleConns"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret string `mapstructure:"secret"`
	Expire int    `mapstructure:"expire"`
	Issuer string `mapstructure:"issuer"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level  string  `mapstructure:"level"`
	Format string  `mapstructure:"format"`
	Output string  `mapstructure:"output"`
	File   LogFile `mapstructure:"file"`
}

// LogFile 日志文件配置
type LogFile struct {
	Path       string `mapstructure:"path"`
	MaxSize    int    `mapstructure:"maxSize"`
	MaxBackups int    `mapstructure:"maxBackups"`
	MaxAge     int    `mapstructure:"maxAge"`
	Compress   bool   `mapstructure:"compress"`
}

// SSHConfig SSH配置
type SSHConfig struct {
	Timeout     int `mapstructure:"timeout"`
	Keepalive   int `mapstructure:"keepalive"`
	MaxSessions int `mapstructure:"maxSessions"`
}

// SessionConfig 会话配置
type SessionConfig struct {
	Timeout      int    `mapstructure:"timeout"`
	RecordPath   string `mapstructure:"recordPath"`
	EnableRecord bool   `mapstructure:"enableRecord"`
}

// SecurityConfig 安全配置
type SecurityConfig struct {
	EnableRateLimit bool      `mapstructure:"enableRateLimit"`
	RateLimit       RateLimit `mapstructure:"rateLimit"`
	CORS            CORS      `mapstructure:"cors"`
}

// RateLimit 限流配置
type RateLimit struct {
	Requests int `mapstructure:"requests"`
	Burst    int `mapstructure:"burst"`
}

// CORS 跨域配置
type CORS struct {
	AllowOrigins     []string `mapstructure:"allowOrigins"`
	AllowMethods     []string `mapstructure:"allowMethods"`
	AllowHeaders     []string `mapstructure:"allowHeaders"`
	ExposeHeaders    []string `mapstructure:"exposeHeaders"`
	AllowCredentials bool     `mapstructure:"allowCredentials"`
	MaxAge           int      `mapstructure:"maxAge"`
}

// UploadConfig 上传配置
type UploadConfig struct {
	MaxSize    int      `mapstructure:"maxSize"`
	AllowTypes []string `mapstructure:"allowTypes"`
	SavePath   string   `mapstructure:"savePath"`
}

// MonitoringConfig 监控配置
type MonitoringConfig struct {
	EnableMetrics bool   `mapstructure:"enableMetrics"`
	MetricsPath   string `mapstructure:"metricsPath"`
	EnableHealth  bool   `mapstructure:"enableHealth"`
	HealthPath    string `mapstructure:"healthPath"`
}

// AuditConfig 审计配置
type AuditConfig struct {
	EnableOperationLog  bool     `mapstructure:"enableOperationLog"`
	EnableSessionRecord bool     `mapstructure:"enableSessionRecord"`
	RetentionDays       int      `mapstructure:"retentionDays"`
	DangerousCommands   []string `mapstructure:"dangerousCommands"`
}

// WebSocketConfig WebSocket配置
type WebSocketConfig struct {
	Enable            bool `mapstructure:"enable"`
	Port              int  `mapstructure:"port"`
	Path              string `mapstructure:"path"`
	HeartbeatInterval int  `mapstructure:"heartbeatInterval"`
	MaxConnections    int  `mapstructure:"maxConnections"`
	MessageBufferSize int  `mapstructure:"messageBufferSize"`
	ReadTimeout       int  `mapstructure:"readTimeout"`
	WriteTimeout      int  `mapstructure:"writeTimeout"`
}

// MonitorConfig 实时监控配置
type MonitorConfig struct {
	EnableRealtime   bool `mapstructure:"enableRealtime"`
	UpdateInterval   int  `mapstructure:"updateInterval"`
	SessionTimeout   int  `mapstructure:"sessionTimeout"`
	MaxInactiveTime  int  `mapstructure:"maxInactiveTime"`
}

var GlobalConfig *Config

// LoadConfig 加载配置文件
func LoadConfig(configPath string) error {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	// 设置环境变量前缀
	viper.SetEnvPrefix("BASTION")
	viper.AutomaticEnv()

	// 读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	// 解析配置到结构体
	if err := viper.Unmarshal(&GlobalConfig); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return nil
}

// GetDSN 获取数据库连接字符串
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=%t&loc=%s",
		c.Username, c.Password, c.Host, c.Port, c.DBName, c.Charset, c.ParseTime, c.Loc)
}

// GetRedisAddr 获取Redis地址
func (c *RedisConfig) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// GetServerAddr 获取服务器监听地址
func (c *AppConfig) GetServerAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
