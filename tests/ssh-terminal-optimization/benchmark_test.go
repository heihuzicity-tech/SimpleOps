package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// BenchmarkResult 基准测试结果
type BenchmarkResult struct {
	TestName        string
	Duration        time.Duration
	Operations      int
	BytesProcessed  int64
	AvgLatency      time.Duration
	MaxLatency      time.Duration
	MinLatency      time.Duration
	MemoryUsed      uint64
	GoroutineCount  int
}

// PerformanceMetrics 性能指标
type PerformanceMetrics struct {
	InputResponseTime   []time.Duration
	OutputRenderTime    []time.Duration
	NetworkTransferRate []float64
	MemoryUsage         []uint64
	CPUUsage            []float64
	mu                  sync.Mutex
}

func (pm *PerformanceMetrics) AddInputLatency(d time.Duration) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.InputResponseTime = append(pm.InputResponseTime, d)
}

func (pm *PerformanceMetrics) AddOutputRender(d time.Duration) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.OutputRenderTime = append(pm.OutputRenderTime, d)
}

func (pm *PerformanceMetrics) AddTransferRate(rate float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.NetworkTransferRate = append(pm.NetworkTransferRate, rate)
}

func (pm *PerformanceMetrics) AddMemoryUsage(usage uint64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.MemoryUsage = append(pm.MemoryUsage, usage)
}

// BenchmarkSuite 基准测试套件
type BenchmarkSuite struct {
	wsURL   string
	token   string
	assetID int
	results []BenchmarkResult
}

// 基准测试1：输入响应时间
func (bs *BenchmarkSuite) BenchmarkInputResponse() BenchmarkResult {
	fmt.Println("\n运行基准测试: 输入响应时间")
	
	conn, err := bs.connect()
	if err != nil {
		log.Printf("连接失败: %v", err)
		return BenchmarkResult{TestName: "InputResponse", Duration: 0}
	}
	defer conn.Close()
	
	// 等待初始化
	time.Sleep(1 * time.Second)
	
	latencies := make([]time.Duration, 0)
	totalBytes := 0
	
	// 测试100次输入
	for i := 0; i < 100; i++ {
		input := fmt.Sprintf("echo test_%d\n", i)
		totalBytes += len(input)
		
		start := time.Now()
		msg := map[string]interface{}{
			"type":    "input",
			"content": input,
		}
		if err := conn.WriteJSON(msg); err != nil {
			log.Printf("发送失败: %v", err)
			continue
		}
		
		// 等待响应
		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, _, err := conn.ReadMessage()
		if err == nil {
			latency := time.Since(start)
			latencies = append(latencies, latency)
		}
	}
	
	// 计算统计信息
	var totalLatency, minLatency, maxLatency time.Duration
	if len(latencies) > 0 {
		minLatency = latencies[0]
		maxLatency = latencies[0]
		for _, l := range latencies {
			totalLatency += l
			if l < minLatency {
				minLatency = l
			}
			if l > maxLatency {
				maxLatency = l
			}
		}
	}
	
	avgLatency := time.Duration(0)
	if len(latencies) > 0 {
		avgLatency = totalLatency / time.Duration(len(latencies))
	}
	
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return BenchmarkResult{
		TestName:       "InputResponse",
		Duration:       time.Since(time.Now().Add(-totalLatency)),
		Operations:     len(latencies),
		BytesProcessed: int64(totalBytes),
		AvgLatency:     avgLatency,
		MaxLatency:     maxLatency,
		MinLatency:     minLatency,
		MemoryUsed:     m.Alloc,
		GoroutineCount: runtime.NumGoroutine(),
	}
}

// 基准测试2：输出渲染性能
func (bs *BenchmarkSuite) BenchmarkOutputRendering() BenchmarkResult {
	fmt.Println("\n运行基准测试: 输出渲染性能")
	
	conn, err := bs.connect()
	if err != nil {
		log.Printf("连接失败: %v", err)
		return BenchmarkResult{TestName: "OutputRendering", Duration: 0}
	}
	defer conn.Close()
	
	// 等待初始化
	time.Sleep(1 * time.Second)
	
	start := time.Now()
	totalBytes := int64(0)
	messageCount := 0
	
	// 发送产生大量输出的命令
	commands := []string{
		"find / -name '*.log' 2>/dev/null | head -1000\n",
		"ps aux\n",
		"dmesg | tail -100\n",
		"ls -la /usr/bin | head -100\n",
	}
	
	for _, cmd := range commands {
		msg := map[string]interface{}{
			"type":    "input",
			"content": cmd,
		}
		if err := conn.WriteJSON(msg); err != nil {
			log.Printf("发送命令失败: %v", err)
			continue
		}
		
		// 读取输出
		timeout := time.After(5 * time.Second)
		for {
			select {
			case <-timeout:
				goto next
			default:
				conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				_, message, err := conn.ReadMessage()
				if err == nil {
					totalBytes += int64(len(message))
					messageCount++
				} else {
					goto next
				}
			}
		}
	next:
	}
	
	duration := time.Since(start)
	
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return BenchmarkResult{
		TestName:       "OutputRendering",
		Duration:       duration,
		Operations:     messageCount,
		BytesProcessed: totalBytes,
		AvgLatency:     duration / time.Duration(messageCount+1),
		MemoryUsed:     m.Alloc,
		GoroutineCount: runtime.NumGoroutine(),
	}
}

// 基准测试3：网络传输效率
func (bs *BenchmarkSuite) BenchmarkNetworkTransfer() BenchmarkResult {
	fmt.Println("\n运行基准测试: 网络传输效率")
	
	conn, err := bs.connect()
	if err != nil {
		log.Printf("连接失败: %v", err)
		return BenchmarkResult{TestName: "NetworkTransfer", Duration: 0}
	}
	defer conn.Close()
	
	// 等待初始化
	time.Sleep(1 * time.Second)
	
	start := time.Now()
	totalBytesSent := int64(0)
	totalBytesReceived := int64(0)
	operations := 0
	
	// 测试批量数据传输
	testData := make([]byte, 1024) // 1KB数据
	for i := range testData {
		testData[i] = byte('A' + (i % 26))
	}
	
	// 发送50次1KB数据
	for i := 0; i < 50; i++ {
		msg := map[string]interface{}{
			"type":    "input",
			"content": string(testData) + "\n",
		}
		data, _ := json.Marshal(msg)
		totalBytesSent += int64(len(data))
		
		if err := conn.WriteJSON(msg); err != nil {
			log.Printf("发送失败: %v", err)
			continue
		}
		operations++
		
		// 读取响应
		conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		_, message, err := conn.ReadMessage()
		if err == nil {
			totalBytesReceived += int64(len(message))
		}
	}
	
	duration := time.Since(start)
	throughput := float64(totalBytesSent+totalBytesReceived) / duration.Seconds() / 1024 // KB/s
	
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return BenchmarkResult{
		TestName:       "NetworkTransfer",
		Duration:       duration,
		Operations:     operations,
		BytesProcessed: totalBytesSent + totalBytesReceived,
		AvgLatency:     duration / time.Duration(operations+1),
		MemoryUsed:     m.Alloc,
		GoroutineCount: runtime.NumGoroutine(),
	}
}

// 基准测试4：内存使用效率
func (bs *BenchmarkSuite) BenchmarkMemoryUsage() BenchmarkResult {
	fmt.Println("\n运行基准测试: 内存使用效率")
	
	// 强制GC获取基准内存使用
	runtime.GC()
	var mStart runtime.MemStats
	runtime.ReadMemStats(&mStart)
	
	conn, err := bs.connect()
	if err != nil {
		log.Printf("连接失败: %v", err)
		return BenchmarkResult{TestName: "MemoryUsage", Duration: 0}
	}
	defer conn.Close()
	
	// 等待初始化
	time.Sleep(1 * time.Second)
	
	start := time.Now()
	
	// 执行内存密集型操作
	for i := 0; i < 100; i++ {
		// 发送大量数据
		largeData := make([]byte, 10240) // 10KB
		for j := range largeData {
			largeData[j] = byte(rand.Intn(256))
		}
		
		msg := map[string]interface{}{
			"type":    "input",
			"content": fmt.Sprintf("echo '%s'\n", string(largeData[:100])), // 只发送前100字节
		}
		
		if err := conn.WriteJSON(msg); err != nil {
			log.Printf("发送失败: %v", err)
			continue
		}
		
		// 读取响应
		conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		conn.ReadMessage()
	}
	
	duration := time.Since(start)
	
	// 获取结束时的内存使用
	runtime.GC()
	var mEnd runtime.MemStats
	runtime.ReadMemStats(&mEnd)
	
	memoryGrowth := mEnd.Alloc - mStart.Alloc
	
	return BenchmarkResult{
		TestName:       "MemoryUsage",
		Duration:       duration,
		Operations:     100,
		BytesProcessed: 100 * 10240,
		MemoryUsed:     memoryGrowth,
		GoroutineCount: runtime.NumGoroutine(),
	}
}

func (bs *BenchmarkSuite) connect() (*websocket.Conn, error) {
	header := map[string][]string{
		"Authorization": {"Bearer " + bs.token},
	}
	
	conn, _, err := websocket.DefaultDialer.Dial(bs.wsURL, header)
	if err != nil {
		return nil, err
	}
	
	// 发送初始化消息
	initMsg := map[string]interface{}{
		"type": "resize",
		"cols": 80,
		"rows": 24,
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		conn.Close()
		return nil, err
	}
	
	return conn, nil
}

func (bs *BenchmarkSuite) Run() {
	fmt.Println("=== SSH终端性能基准测试 ===")
	fmt.Printf("服务器: %s\n", bs.wsURL)
	fmt.Printf("开始时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))
	
	// 运行所有基准测试
	bs.results = append(bs.results, bs.BenchmarkInputResponse())
	time.Sleep(2 * time.Second)
	
	bs.results = append(bs.results, bs.BenchmarkOutputRendering())
	time.Sleep(2 * time.Second)
	
	bs.results = append(bs.results, bs.BenchmarkNetworkTransfer())
	time.Sleep(2 * time.Second)
	
	bs.results = append(bs.results, bs.BenchmarkMemoryUsage())
	
	// 生成报告
	bs.GenerateReport()
}

func (bs *BenchmarkSuite) GenerateReport() {
	fmt.Println("\n\n=== 性能基准测试报告 ===")
	fmt.Printf("完成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))
	
	for _, result := range bs.results {
		if result.Duration == 0 {
			continue
		}
		
		fmt.Printf("测试: %s\n", result.TestName)
		fmt.Printf("  持续时间: %v\n", result.Duration)
		fmt.Printf("  操作次数: %d\n", result.Operations)
		fmt.Printf("  处理字节: %d\n", result.BytesProcessed)
		if result.AvgLatency > 0 {
			fmt.Printf("  平均延迟: %v\n", result.AvgLatency)
		}
		if result.MinLatency > 0 {
			fmt.Printf("  最小延迟: %v\n", result.MinLatency)
		}
		if result.MaxLatency > 0 {
			fmt.Printf("  最大延迟: %v\n", result.MaxLatency)
		}
		fmt.Printf("  内存使用: %.2f MB\n", float64(result.MemoryUsed)/1024/1024)
		fmt.Printf("  Goroutine数: %d\n", result.GoroutineCount)
		fmt.Println()
	}
	
	// 保存结果到文件
	bs.SaveResults()
}

func (bs *BenchmarkSuite) SaveResults() {
	filename := fmt.Sprintf("benchmark_results_%s.json", time.Now().Format("20060102_150405"))
	file, err := os.Create(filename)
	if err != nil {
		log.Printf("无法创建结果文件: %v", err)
		return
	}
	defer file.Close()
	
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(bs.results); err != nil {
		log.Printf("无法写入结果文件: %v", err)
	} else {
		fmt.Printf("\n结果已保存到: %s\n", filename)
	}
}

func main() {
	token := os.Getenv("AUTH_TOKEN")
	if token == "" {
		log.Fatal("请设置AUTH_TOKEN环境变量")
	}
	
	assetID := 1
	wsURL := fmt.Sprintf("ws://localhost:8080/api/v1/ws/ssh/%d", assetID)
	
	suite := &BenchmarkSuite{
		wsURL:   wsURL,
		token:   token,
		assetID: assetID,
	}
	
	suite.Run()
}