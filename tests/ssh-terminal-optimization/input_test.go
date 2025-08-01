package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// InputTestMetrics 输入测试指标
type InputTestMetrics struct {
	TotalInputs      int
	TotalBytes       int
	NetworkRequests  int
	StartTime        time.Time
	EndTime          time.Time
	InputLatencies   []time.Duration
	RequestTimings   []time.Time
	CharactersLost   int
	mu               sync.Mutex
}

func (m *InputTestMetrics) AddInput(bytes int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.TotalInputs++
	m.TotalBytes += bytes
}

func (m *InputTestMetrics) AddRequest() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.NetworkRequests++
	m.RequestTimings = append(m.RequestTimings, time.Now())
}

func (m *InputTestMetrics) AddLatency(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.InputLatencies = append(m.InputLatencies, d)
}

func (m *InputTestMetrics) Report() {
	m.mu.Lock()
	defer m.mu.Unlock()

	duration := m.EndTime.Sub(m.StartTime)
	
	fmt.Println("\n=== 高频输入测试报告 ===")
	fmt.Printf("测试时长: %v\n", duration)
	fmt.Printf("总输入次数: %d\n", m.TotalInputs)
	fmt.Printf("总输入字节: %d\n", m.TotalBytes)
	fmt.Printf("网络请求数: %d\n", m.NetworkRequests)
	
	// 计算聚合率
	aggregationRate := float64(m.TotalInputs-m.NetworkRequests) / float64(m.TotalInputs) * 100
	fmt.Printf("输入聚合率: %.2f%% (减少了%.2f%%的网络请求)\n", aggregationRate, aggregationRate)
	
	// 计算平均延迟
	if len(m.InputLatencies) > 0 {
		var totalLatency time.Duration
		var maxLatency time.Duration
		for _, l := range m.InputLatencies {
			totalLatency += l
			if l > maxLatency {
				maxLatency = l
			}
		}
		avgLatency := totalLatency / time.Duration(len(m.InputLatencies))
		fmt.Printf("\n输入延迟:\n")
		fmt.Printf("  平均: %v\n", avgLatency)
		fmt.Printf("  最大: %v\n", maxLatency)
	}
	
	// 计算请求频率
	if len(m.RequestTimings) > 1 {
		intervals := make([]time.Duration, 0)
		for i := 1; i < len(m.RequestTimings); i++ {
			intervals = append(intervals, m.RequestTimings[i].Sub(m.RequestTimings[i-1]))
		}
		
		var totalInterval time.Duration
		for _, interval := range intervals {
			totalInterval += interval
		}
		avgInterval := totalInterval / time.Duration(len(intervals))
		fmt.Printf("\n请求间隔:\n")
		fmt.Printf("  平均: %v\n", avgInterval)
	}
	
	fmt.Printf("\n字符丢失: %d\n", m.CharactersLost)
}

// InputTestClient 输入测试客户端
type InputTestClient struct {
	conn     *websocket.Conn
	metrics  *InputTestMetrics
	received chan string
}

func (c *InputTestClient) connect(wsURL string, token string) error {
	header := map[string][]string{
		"Authorization": {"Bearer " + token},
	}
	
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return err
	}
	
	c.conn = conn
	c.received = make(chan string, 1000)
	
	// 启动读取协程
	go c.readMessages()
	
	// 发送初始化消息
	initMsg := map[string]interface{}{
		"type": "resize",
		"cols": 80,
		"rows": 24,
	}
	return c.conn.WriteJSON(initMsg)
}

func (c *InputTestClient) readMessages() {
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			close(c.received)
			return
		}
		
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err == nil {
			if msg["type"] == "output" {
				if content, ok := msg["content"].(string); ok {
					c.received <- content
				}
			}
		}
	}
}

func (c *InputTestClient) sendInput(content string) error {
	start := time.Now()
	
	msg := map[string]interface{}{
		"type":    "input",
		"content": content,
	}
	
	// 使用WriteJSON时会触发一次网络请求
	err := c.conn.WriteJSON(msg)
	c.metrics.AddRequest()
	
	latency := time.Since(start)
	c.metrics.AddLatency(latency)
	
	return err
}

// 测试场景1：快速单字符输入
func (c *InputTestClient) testRapidCharInput() error {
	fmt.Println("\n执行测试: 快速单字符输入")
	
	testString := "The quick brown fox jumps over the lazy dog"
	for _, ch := range testString {
		c.metrics.AddInput(1)
		if err := c.sendInput(string(ch)); err != nil {
			return err
		}
		time.Sleep(10 * time.Millisecond) // 模拟100字符/秒的输入速度
	}
	
	// 发送回车
	c.metrics.AddInput(1)
	return c.sendInput("\n")
}

// 测试场景2：批量粘贴文本
func (c *InputTestClient) testBulkPaste() error {
	fmt.Println("\n执行测试: 批量粘贴文本")
	
	// 生成大段文本
	lines := []string{
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
		"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
		"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
		"Duis aute irure dolor in reprehenderit in voluptate velit esse.",
		"Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
	}
	
	bulkText := strings.Join(lines, "\n")
	c.metrics.AddInput(len(bulkText))
	
	return c.sendInput(bulkText + "\n")
}

// 测试场景3：快速命令执行
func (c *InputTestClient) testRapidCommands() error {
	fmt.Println("\n执行测试: 快速命令执行")
	
	commands := []string{
		"ls\n",
		"pwd\n",
		"date\n",
		"echo test\n",
		"whoami\n",
	}
	
	for _, cmd := range commands {
		c.metrics.AddInput(len(cmd))
		if err := c.sendInput(cmd); err != nil {
			return err
		}
		time.Sleep(50 * time.Millisecond) // 快速执行命令
	}
	
	return nil
}

// 测试场景4：特殊字符输入
func (c *InputTestClient) testSpecialCharacters() error {
	fmt.Println("\n执行测试: 特殊字符输入")
	
	specialChars := []string{
		"!@#$%^&*()",
		"[]{}|\\",
		"<>?/.,;:'\"",
		"中文测试字符串",
		"😀🎉🚀", // emoji测试
	}
	
	for _, chars := range specialChars {
		c.metrics.AddInput(len(chars))
		if err := c.sendInput(chars); err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
		
		// 发送回车
		c.metrics.AddInput(1)
		if err := c.sendInput("\n"); err != nil {
			return err
		}
	}
	
	return nil
}

// 测试场景5：极限输入速度测试
func (c *InputTestClient) testExtremeSpeed() error {
	fmt.Println("\n执行测试: 极限输入速度")
	
	// 生成随机字符
	rand.Seed(time.Now().UnixNano())
	chars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	
	// 连续发送1000个字符，无延迟
	for i := 0; i < 1000; i++ {
		ch := string(chars[rand.Intn(len(chars))])
		c.metrics.AddInput(1)
		if err := c.sendInput(ch); err != nil {
			return err
		}
	}
	
	// 发送回车
	c.metrics.AddInput(1)
	return c.sendInput("\n")
}

func main() {
	token := os.Getenv("AUTH_TOKEN")
	if token == "" {
		log.Fatal("请设置AUTH_TOKEN环境变量")
	}
	
	assetID := 1
	wsURL := fmt.Sprintf("ws://localhost:8080/api/v1/ws/ssh/%d", assetID)
	
	metrics := &InputTestMetrics{
		StartTime: time.Now(),
	}
	
	client := &InputTestClient{
		metrics: metrics,
	}
	
	// 连接到服务器
	fmt.Println("连接到SSH终端...")
	if err := client.connect(wsURL, token); err != nil {
		log.Fatalf("连接失败: %v", err)
	}
	defer client.conn.Close()
	
	// 等待初始化
	time.Sleep(2 * time.Second)
	
	// 执行测试场景
	tests := []func() error{
		client.testRapidCharInput,
		client.testBulkPaste,
		client.testRapidCommands,
		client.testSpecialCharacters,
		client.testExtremeSpeed,
	}
	
	for _, test := range tests {
		if err := test(); err != nil {
			log.Printf("测试失败: %v", err)
		}
		time.Sleep(1 * time.Second) // 测试间隔
	}
	
	// 记录结束时间
	metrics.EndTime = time.Now()
	
	// 等待所有输出
	time.Sleep(2 * time.Second)
	
	// 生成报告
	metrics.Report()
	
	// 保存详细结果
	saveResults(metrics)
}

func saveResults(metrics *InputTestMetrics) {
	filename := fmt.Sprintf("input_test_results_%s.json", time.Now().Format("20060102_150405"))
	file, err := os.Create(filename)
	if err != nil {
		log.Printf("无法创建结果文件: %v", err)
		return
	}
	defer file.Close()
	
	data := map[string]interface{}{
		"start_time":       metrics.StartTime,
		"end_time":         metrics.EndTime,
		"total_inputs":     metrics.TotalInputs,
		"total_bytes":      metrics.TotalBytes,
		"network_requests": metrics.NetworkRequests,
		"input_latencies":  metrics.InputLatencies,
		"request_timings":  metrics.RequestTimings,
		"characters_lost":  metrics.CharactersLost,
	}
	
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		log.Printf("无法写入结果文件: %v", err)
	} else {
		fmt.Printf("\n结果已保存到: %s\n", filename)
	}
}