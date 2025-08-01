package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// MetricsCollector 收集性能指标
type MetricsCollector struct {
	StartTime      time.Time
	MemStats      []runtime.MemStats
	GoroutineCount []int
	Timestamps     []time.Time
	mu             sync.Mutex
}

// SessionMessage WebSocket消息格式
type SessionMessage struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
	Cols    int    `json:"cols,omitempty"`
	Rows    int    `json:"rows,omitempty"`
}

func (mc *MetricsCollector) Collect() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	mc.MemStats = append(mc.MemStats, m)
	mc.GoroutineCount = append(mc.GoroutineCount, runtime.NumGoroutine())
	mc.Timestamps = append(mc.Timestamps, time.Now())
}

func (mc *MetricsCollector) Report() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	fmt.Println("\n=== 压力测试报告 ===")
	fmt.Printf("测试时长: %v\n", time.Since(mc.StartTime))
	fmt.Printf("数据点数量: %d\n", len(mc.Timestamps))

	if len(mc.MemStats) > 0 {
		startMem := mc.MemStats[0].Alloc
		endMem := mc.MemStats[len(mc.MemStats)-1].Alloc
		maxMem := startMem
		for _, m := range mc.MemStats {
			if m.Alloc > maxMem {
				maxMem = m.Alloc
			}
		}

		fmt.Printf("\n内存使用:\n")
		fmt.Printf("  初始: %.2f MB\n", float64(startMem)/1024/1024)
		fmt.Printf("  结束: %.2f MB\n", float64(endMem)/1024/1024)
		fmt.Printf("  峰值: %.2f MB\n", float64(maxMem)/1024/1024)
		fmt.Printf("  增长: %.2f MB\n", float64(endMem-startMem)/1024/1024)
	}

	if len(mc.GoroutineCount) > 0 {
		startGoroutines := mc.GoroutineCount[0]
		endGoroutines := mc.GoroutineCount[len(mc.GoroutineCount)-1]
		maxGoroutines := startGoroutines
		for _, g := range mc.GoroutineCount {
			if g > maxGoroutines {
				maxGoroutines = g
			}
		}

		fmt.Printf("\nGoroutine数量:\n")
		fmt.Printf("  初始: %d\n", startGoroutines)
		fmt.Printf("  结束: %d\n", endGoroutines)
		fmt.Printf("  峰值: %d\n", maxGoroutines)
		fmt.Printf("  泄漏: %d\n", endGoroutines-startGoroutines)
	}

	// 保存详细数据到文件
	mc.SaveToFile()
}

func (mc *MetricsCollector) SaveToFile() {
	file, err := os.Create(fmt.Sprintf("stress_test_results_%s.json", time.Now().Format("20060102_150405")))
	if err != nil {
		log.Printf("无法创建结果文件: %v", err)
		return
	}
	defer file.Close()

	data := map[string]interface{}{
		"start_time":      mc.StartTime,
		"duration":        time.Since(mc.StartTime).String(),
		"timestamps":      mc.Timestamps,
		"goroutine_count": mc.GoroutineCount,
		"memory_stats":    mc.MemStats,
	}

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		log.Printf("无法写入结果文件: %v", err)
	}
}

// StressTestClient 压力测试客户端
type StressTestClient struct {
	serverURL string
	token     string
	assetID   int
	duration  time.Duration
}

func (stc *StressTestClient) Run() error {
	// 连接WebSocket
	header := http.Header{}
	header.Add("Authorization", "Bearer "+stc.token)
	
	wsURL := fmt.Sprintf("ws://localhost:8080/api/v1/ws/ssh/%d", stc.assetID)
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return fmt.Errorf("WebSocket连接失败: %v", err)
	}
	defer conn.Close()

	// 发送初始化消息
	initMsg := SessionMessage{
		Type: "resize",
		Cols: 80,
		Rows: 24,
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		return fmt.Errorf("发送初始化消息失败: %v", err)
	}

	// 启动读取协程
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket读取错误: %v", err)
				}
				return
			}
		}
	}()

	// 执行压力测试
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	timeout := time.After(stc.duration)
	commands := []string{
		"ls -la\n",
		"pwd\n",
		"echo 'Testing SSH terminal performance'\n",
		"date\n",
		"ps aux | head -20\n",
		"df -h\n",
		"free -m\n",
		"uptime\n",
	}
	cmdIndex := 0

	for {
		select {
		case <-timeout:
			return nil
		case <-done:
			return fmt.Errorf("连接意外关闭")
		case <-ticker.C:
			// 发送命令
			msg := SessionMessage{
				Type:    "input",
				Content: commands[cmdIndex%len(commands)],
			}
			if err := conn.WriteJSON(msg); err != nil {
				return fmt.Errorf("发送命令失败: %v", err)
			}
			cmdIndex++
		}
	}
}

func main() {
	// 启动pprof服务器
	go func() {
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	// 从环境变量获取配置
	token := os.Getenv("AUTH_TOKEN")
	if token == "" {
		log.Fatal("请设置AUTH_TOKEN环境变量")
	}

	assetID := 1 // 默认测试主机ID
	duration := 30 * time.Minute // 测试时长

	// 创建指标收集器
	collector := &MetricsCollector{
		StartTime: time.Now(),
	}

	// 启动指标收集
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			collector.Collect()
		}
	}()

	// 初始收集
	collector.Collect()

	// 创建并运行压力测试客户端
	client := &StressTestClient{
		serverURL: "http://localhost:8080",
		token:     token,
		assetID:   assetID,
		duration:  duration,
	}

	fmt.Printf("开始压力测试，持续时间: %v\n", duration)
	fmt.Println("pprof服务器运行在: http://localhost:6060/debug/pprof/")

	if err := client.Run(); err != nil {
		log.Printf("压力测试失败: %v", err)
	}

	// 最终收集
	collector.Collect()

	// 生成报告
	collector.Report()
}