package services

import (
	"bastion/models"
	"bytes"
	"compress/gzip"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// RecordingService 录制服务
type RecordingService struct {
	db       *gorm.DB
	recorders map[string]*SessionRecorder // sessionID -> recorder
	mu       sync.RWMutex
	storageDir string
}

// SessionRecorder 会话录制器
type SessionRecorder struct {
	SessionID     string
	UserID        uint
	AssetID       uint
	StartTime     time.Time
	Writer        *os.File
	Buffer        *bytes.Buffer
	Compressor    *gzip.Writer
	mu            sync.Mutex
	isRecording   bool
	metadata      *RecordingMetadata
}

// RecordingMetadata 录制元数据
type RecordingMetadata struct {
	SessionID    string    `json:"session_id"`
	UserID       uint      `json:"user_id"`
	AssetID      uint      `json:"asset_id"`
	StartTime    time.Time `json:"start_time"`
	EndTime      *time.Time `json:"end_time,omitempty"`
	Duration     int64     `json:"duration"` // 秒
	TerminalSize TerminalSize `json:"terminal_size"`
	FileInfo     FileInfo  `json:"file_info"`
	Statistics   Statistics `json:"statistics"`
}

// TerminalSize 终端尺寸
type TerminalSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// FileInfo 文件信息
type FileInfo struct {
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	CompressedSize int64 `json:"compressed_size"`
	Format       string `json:"format"` // "asciicast"
	Checksum     string `json:"checksum"`
}

// Statistics 统计信息
type Statistics struct {
	TotalBytes       int64   `json:"total_bytes"`
	CompressedBytes  int64   `json:"compressed_bytes"`
	CompressionRatio float64 `json:"compression_ratio"`
	RecordCount      int     `json:"record_count"`
}

// WSRecord WebSocket数据记录
type WSRecord struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"` // "input" | "output" | "resize"
	Data      []byte    `json:"data"`
	Size      int       `json:"size"`
}

// AsciinemaRecord asciicast格式记录
type AsciinemaRecord struct {
	Time float64 `json:"time"`
	Type string  `json:"type"`
	Data string  `json:"data"`
}

// WSInterceptor WebSocket数据拦截器
type WSInterceptor struct {
	sessionID      string
	recorder       *SessionRecorder
	originalConn   *websocket.Conn
	interceptedConn *InterceptedConn
	buffer         *bytes.Buffer
	mu             sync.Mutex
}

// InterceptedConn 拦截的连接包装器
type InterceptedConn struct {
	*websocket.Conn
	interceptor *WSInterceptor
}

// NewRecordingService 创建录制服务实例
func NewRecordingService(db *gorm.DB) *RecordingService {
	// 使用配置文件中指定的录制路径
	storageDir := "./recordings"
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		logrus.WithError(err).Error("创建录制存储目录失败")
		storageDir = "./recordings"
		os.MkdirAll(storageDir, 0755)
	}

	logrus.WithField("storage_dir", storageDir).Info("录制服务存储目录已设置")

	return &RecordingService{
		db:         db,
		recorders:  make(map[string]*SessionRecorder),
		storageDir: storageDir,
	}
}

// StartRecording 开始录制会话
func (rs *RecordingService) StartRecording(sessionID string, userID, assetID uint, width, height int) (*SessionRecorder, error) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// 检查是否已经在录制
	if _, exists := rs.recorders[sessionID]; exists {
		return nil, fmt.Errorf("会话 %s 已在录制中", sessionID)
	}

	// 创建录制文件
	filename := rs.generateFilename(sessionID, userID, assetID)
	filePath := filepath.Join(rs.storageDir, filename)
	
	file, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("创建录制文件失败: %v", err)
	}

	// 创建终端尺寸
	termSize := TerminalSize{
		Width:  width,
		Height: height,
	}

	// 创建录制器
	recorder := &SessionRecorder{
		SessionID:   sessionID,
		UserID:      userID,
		AssetID:     assetID,
		StartTime:   time.Now(),
		Writer:      file,
		Buffer:      new(bytes.Buffer),
		isRecording: true,
		metadata: &RecordingMetadata{
			SessionID:    sessionID,
			UserID:       userID,
			AssetID:      assetID,
			StartTime:    time.Now(),
			TerminalSize: termSize,
			FileInfo: FileInfo{
				Path:   filePath,
				Format: "asciicast",
			},
		},
	}

	// 初始化压缩器
	recorder.Compressor = gzip.NewWriter(recorder.Buffer)

	// 写入asciicast头部
	if err := recorder.writeAsciinemaHeader(termSize); err != nil {
		file.Close()
		return nil, fmt.Errorf("写入录制头部失败: %v", err)
	}

	rs.recorders[sessionID] = recorder
	
	logrus.WithFields(logrus.Fields{
		"session_id": sessionID,
		"user_id":    userID,
		"asset_id":   assetID,
		"file_path":  filePath,
	}).Info("会话录制已开始")

	return recorder, nil
}

// StopRecording 停止录制会话
func (rs *RecordingService) StopRecording(sessionID string) error {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	recorder, exists := rs.recorders[sessionID]
	if !exists {
		return fmt.Errorf("会话 %s 不在录制中", sessionID)
	}

	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	// 停止录制
	recorder.isRecording = false
	endTime := time.Now()
	recorder.metadata.EndTime = &endTime
	recorder.metadata.Duration = int64(endTime.Sub(recorder.StartTime).Seconds())

	// 关闭压缩器并写入最终数据
	if recorder.Compressor != nil {
		recorder.Compressor.Close()
		if _, err := recorder.Writer.Write(recorder.Buffer.Bytes()); err != nil {
			logrus.WithError(err).Error("写入最终录制数据失败")
		}
	}

	// 计算文件信息
	fileInfo, err := recorder.Writer.Stat()
	if err == nil {
		recorder.metadata.FileInfo.Size = fileInfo.Size()
	}

	// 计算校验和
	if checksum, err := rs.calculateFileChecksum(recorder.metadata.FileInfo.Path); err == nil {
		recorder.metadata.FileInfo.Checksum = checksum
	}

	// 关闭文件
	recorder.Writer.Close()

	// 保存录制记录到数据库
	if err := rs.saveRecordingToDB(recorder.metadata); err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"session_id": sessionID,
			"file_path":  recorder.metadata.FileInfo.Path,
			"file_size":  recorder.metadata.FileInfo.Size,
		}).Error("保存录制记录到数据库失败")
	} else {
		logrus.WithFields(logrus.Fields{
			"session_id": sessionID,
			"file_path":  recorder.metadata.FileInfo.Path,
			"file_size":  recorder.metadata.FileInfo.Size,
			"duration":   recorder.metadata.Duration,
		}).Info("录制记录已成功保存到数据库")
	}

	delete(rs.recorders, sessionID)

	logrus.WithFields(logrus.Fields{
		"session_id": sessionID,
		"duration":   recorder.metadata.Duration,
		"file_size":  recorder.metadata.FileInfo.Size,
	}).Info("会话录制已停止")

	return nil
}

// InterceptWebSocketConnection 拦截WebSocket连接
func (rs *RecordingService) InterceptWebSocketConnection(conn *websocket.Conn, sessionID string) *InterceptedConn {
	recorder, exists := rs.getRecorder(sessionID)
	if !exists {
		// 如果没有录制器，返回原始连接
		return &InterceptedConn{Conn: conn}
	}

	interceptor := &WSInterceptor{
		sessionID:    sessionID,
		recorder:     recorder,
		originalConn: conn,
		buffer:       new(bytes.Buffer),
	}

	interceptedConn := &InterceptedConn{
		Conn:        conn,
		interceptor: interceptor,
	}

	interceptor.interceptedConn = interceptedConn
	return interceptedConn
}

// WriteMessage 拦截写入消息（输出到终端）
func (ic *InterceptedConn) WriteMessage(messageType int, data []byte) error {
	// 先写入原始连接
	err := ic.Conn.WriteMessage(messageType, data)
	if err != nil {
		return err
	}

	// 记录输出数据
	if ic.interceptor != nil {
		ic.interceptor.recordData("output", data)
	}

	return nil
}

// ReadMessage 拦截读取消息（从终端输入）
func (ic *InterceptedConn) ReadMessage() (int, []byte, error) {
	messageType, data, err := ic.Conn.ReadMessage()
	if err != nil {
		return messageType, data, err
	}

	// 记录输入数据
	if ic.interceptor != nil {
		ic.interceptor.recordData("input", data)
	}

	return messageType, data, nil
}

// recordData 记录WebSocket数据
func (wi *WSInterceptor) recordData(direction string, data []byte) {
	if wi.recorder == nil || !wi.recorder.isRecording {
		return
	}

	wi.mu.Lock()
	defer wi.mu.Unlock()

	record := &WSRecord{
		Timestamp: time.Now(),
		Type:      direction,
		Data:      data,
		Size:      len(data),
	}

	wi.recorder.WriteRecord(record)
}

// WriteRecord 写入录制记录
func (sr *SessionRecorder) WriteRecord(record *WSRecord) {
	if !sr.isRecording {
		return
	}

	sr.mu.Lock()
	defer sr.mu.Unlock()

	// 计算相对时间（从录制开始的秒数）
	relativeTime := record.Timestamp.Sub(sr.StartTime).Seconds()

	// 创建asciicast记录
	asciinemaRecord := AsciinemaRecord{
		Time: relativeTime,
		Type: record.Type,
		Data: string(record.Data),
	}

	// 序列化记录
	recordData, err := json.Marshal(asciinemaRecord)
	if err != nil {
		logrus.WithError(err).Error("序列化录制记录失败")
		return
	}

	// 写入压缩缓冲区
	recordData = append(recordData, '\n')
	if _, err := sr.Compressor.Write(recordData); err != nil {
		logrus.WithError(err).Error("写入录制数据失败")
		return
	}

	// 更新统计信息
	sr.metadata.Statistics.TotalBytes += int64(len(record.Data))
	sr.metadata.Statistics.RecordCount++
}

// writeAsciinemaHeader 写入asciicast头部
func (sr *SessionRecorder) writeAsciinemaHeader(termSize TerminalSize) error {
	header := map[string]interface{}{
		"version":   2,
		"width":     termSize.Width,
		"height":    termSize.Height,
		"timestamp": sr.StartTime.Unix(),
		"title":     fmt.Sprintf("Bastion Session %s", sr.SessionID),
		"env": map[string]string{
			"TERM":  "xterm-256color",
			"SHELL": "/bin/bash",
		},
	}

	headerData, err := json.Marshal(header)
	if err != nil {
		return err
	}

	headerData = append(headerData, '\n')
	
	// 通过压缩器写入头部，确保格式一致
	if sr.Compressor != nil {
		_, err = sr.Compressor.Write(headerData)
	} else {
		_, err = sr.Writer.Write(headerData)
	}
	return err
}

// generateFilename 生成录制文件名
func (rs *RecordingService) generateFilename(sessionID string, userID, assetID uint) string {
	timestamp := time.Now().Format("20060102_150405")
	sessionIdShort := sessionID
	if len(sessionID) > 8 {
		sessionIdShort = sessionID[:8]
	}
	
	return fmt.Sprintf("bastion_%d_%d_%s_%s.cast", userID, assetID, timestamp, sessionIdShort)
}

// getRecorder 获取录制器
func (rs *RecordingService) getRecorder(sessionID string) (*SessionRecorder, bool) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	recorder, exists := rs.recorders[sessionID]
	return recorder, exists
}

// GetRecorder 公开方法：获取录制器
func (rs *RecordingService) GetRecorder(sessionID string) (*SessionRecorder, bool) {
	return rs.getRecorder(sessionID)
}

// calculateFileChecksum 计算文件校验和
func (rs *RecordingService) calculateFileChecksum(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// saveRecordingToDB 保存录制记录到数据库
func (rs *RecordingService) saveRecordingToDB(metadata *RecordingMetadata) error {
	recording := &models.SessionRecording{
		SessionID:        metadata.SessionID,
		UserID:           metadata.UserID,
		AssetID:          metadata.AssetID,
		StartTime:        metadata.StartTime,
		EndTime:          metadata.EndTime,
		Duration:         metadata.Duration,
		FilePath:         metadata.FileInfo.Path,
		FileSize:         metadata.FileInfo.Size,
		CompressedSize:   metadata.FileInfo.CompressedSize,
		Format:           metadata.FileInfo.Format,
		Checksum:         metadata.FileInfo.Checksum,
		TerminalWidth:    metadata.TerminalSize.Width,
		TerminalHeight:   metadata.TerminalSize.Height,
		TotalBytes:       metadata.Statistics.TotalBytes,
		CompressedBytes:  metadata.Statistics.CompressedBytes,
		CompressionRatio: metadata.Statistics.CompressionRatio,
		RecordCount:      metadata.Statistics.RecordCount,
		Status:           "completed",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	return rs.db.Create(recording).Error
}

// GetActiveRecordings 获取活跃录制列表
func (rs *RecordingService) GetActiveRecordings() map[string]*SessionRecorder {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	
	result := make(map[string]*SessionRecorder)
	for k, v := range rs.recorders {
		result[k] = v
	}
	return result
}

// 全局录制服务实例
var GlobalRecordingService *RecordingService

// InitRecordingService 初始化录制服务
func InitRecordingService(db *gorm.DB) {
	GlobalRecordingService = NewRecordingService(db)
	logrus.Info("录制服务已初始化")
}