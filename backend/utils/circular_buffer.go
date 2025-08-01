package utils

import (
	"sync"
)

// CircularBuffer 循环缓冲区实现
type CircularBuffer struct {
	mu       sync.RWMutex
	data     []byte
	capacity int
	start    int
	end      int
	size     int
}

// NewCircularBuffer 创建新的循环缓冲区
func NewCircularBuffer(capacity int) *CircularBuffer {
	return &CircularBuffer{
		data:     make([]byte, capacity),
		capacity: capacity,
		start:    0,
		end:      0,
		size:     0,
	}
}

// Write 写入数据到缓冲区
func (cb *CircularBuffer) Write(data []byte) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	for _, b := range data {
		if cb.size == cb.capacity {
			// 缓冲区满，覆盖最旧的数据
			cb.start = (cb.start + 1) % cb.capacity
			cb.size--
		}
		cb.data[cb.end] = b
		cb.end = (cb.end + 1) % cb.capacity
		cb.size++
	}
}

// WriteString 写入字符串到缓冲区
func (cb *CircularBuffer) WriteString(s string) {
	cb.Write([]byte(s))
}

// String 获取缓冲区内容的字符串表示
func (cb *CircularBuffer) String() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if cb.size == 0 {
		return ""
	}

	result := make([]byte, cb.size)
	if cb.start < cb.end {
		copy(result, cb.data[cb.start:cb.end])
	} else {
		// 数据环绕了
		n := copy(result, cb.data[cb.start:cb.capacity])
		copy(result[n:], cb.data[0:cb.end])
	}

	return string(result)
}

// Clear 清空缓冲区
func (cb *CircularBuffer) Clear() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.start = 0
	cb.end = 0
	cb.size = 0
}

// RemoveLast 删除最后一个字符（用于退格键）
func (cb *CircularBuffer) RemoveLast() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.size > 0 {
		cb.end = (cb.end - 1 + cb.capacity) % cb.capacity
		cb.size--
		if cb.size == 0 {
			cb.start = 0
			cb.end = 0
		}
	}
}

// Size 返回缓冲区当前大小
func (cb *CircularBuffer) Size() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.size
}

// IsFull 检查缓冲区是否已满
func (cb *CircularBuffer) IsFull() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.size == cb.capacity
}