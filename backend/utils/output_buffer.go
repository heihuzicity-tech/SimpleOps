package utils

import (
	"sync"
	"time"
)

// OutputBuffer 输出缓冲器，用于批量发送输出数据
type OutputBuffer struct {
	mu          sync.Mutex
	buffer      [][]byte          // 缓冲区存储多个消息
	bufferSize  int               // 当前缓冲区总大小（字节）
	maxSize     int               // 最大缓冲区大小
	flushFunc   func([][]byte) error // 批量发送函数
	ticker      *time.Ticker      // 定时器
	stopChan    chan struct{}     // 停止信号
	wg          sync.WaitGroup    // 等待goroutine结束
}

// NewOutputBuffer 创建新的输出缓冲器
func NewOutputBuffer(maxSize int, flushInterval time.Duration, flushFunc func([][]byte) error) *OutputBuffer {
	ob := &OutputBuffer{
		buffer:     make([][]byte, 0, 32), // 预分配空间
		maxSize:    maxSize,
		flushFunc:  flushFunc,
		ticker:     time.NewTicker(flushInterval),
		stopChan:   make(chan struct{}),
	}
	
	// 启动定时刷新goroutine
	ob.wg.Add(1)
	go ob.flushLoop()
	
	return ob
}

// Write 写入数据到缓冲区
func (ob *OutputBuffer) Write(data []byte) error {
	if len(data) == 0 {
		return nil
	}
	
	// 复制数据，避免引用问题
	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)
	
	ob.mu.Lock()
	defer ob.mu.Unlock()
	
	// 如果单个消息超过最大缓冲区大小，直接发送
	if len(dataCopy) > ob.maxSize {
		return ob.flushFunc([][]byte{dataCopy})
	}
	
	// 如果添加此消息会超过缓冲区大小，先刷新现有内容
	if ob.bufferSize+len(dataCopy) > ob.maxSize && len(ob.buffer) > 0 {
		if err := ob.flushLocked(); err != nil {
			return err
		}
	}
	
	// 添加到缓冲区
	ob.buffer = append(ob.buffer, dataCopy)
	ob.bufferSize += len(dataCopy)
	
	// 如果缓冲区已满，立即刷新
	if ob.bufferSize >= ob.maxSize {
		return ob.flushLocked()
	}
	
	return nil
}

// Flush 手动刷新缓冲区
func (ob *OutputBuffer) Flush() error {
	ob.mu.Lock()
	defer ob.mu.Unlock()
	return ob.flushLocked()
}

// flushLocked 刷新缓冲区（需要持有锁）
func (ob *OutputBuffer) flushLocked() error {
	if len(ob.buffer) == 0 {
		return nil
	}
	
	// 调用批量发送函数
	err := ob.flushFunc(ob.buffer)
	
	// 清空缓冲区
	ob.buffer = ob.buffer[:0]
	ob.bufferSize = 0
	
	return err
}

// flushLoop 定时刷新循环
func (ob *OutputBuffer) flushLoop() {
	defer ob.wg.Done()
	
	for {
		select {
		case <-ob.ticker.C:
			ob.Flush()
		case <-ob.stopChan:
			// 最后一次刷新
			ob.Flush()
			return
		}
	}
}

// Close 关闭输出缓冲器
func (ob *OutputBuffer) Close() error {
	// 停止定时器
	ob.ticker.Stop()
	
	// 发送停止信号
	close(ob.stopChan)
	
	// 等待goroutine结束
	ob.wg.Wait()
	
	// 最后一次刷新（以防万一）
	ob.mu.Lock()
	err := ob.flushLocked()
	ob.mu.Unlock()
	
	return err
}

// GetStats 获取缓冲区统计信息
func (ob *OutputBuffer) GetStats() (messageCount int, bufferSize int) {
	ob.mu.Lock()
	defer ob.mu.Unlock()
	return len(ob.buffer), ob.bufferSize
}