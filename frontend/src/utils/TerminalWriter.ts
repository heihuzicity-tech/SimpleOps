/**
 * 终端批量写入器
 * 使用requestAnimationFrame批量渲染，减少DOM操作
 * 优化大量输出时的渲染性能
 */

import { Terminal } from '@xterm/xterm';

export class TerminalWriter {
  private terminal: Terminal;
  private buffer: string[] = [];
  private rafHandle: number | null = null;
  private isWriting = false;
  
  // 配置选项
  private readonly maxBufferSize = 100; // 最大缓冲条目数
  private readonly maxBufferTime = 16; // 最大缓冲时间(ms)，约一帧
  private bufferTimer: NodeJS.Timeout | null = null;
  
  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }
  
  /**
   * 写入数据到终端
   * @param data 要写入的数据
   */
  write(data: string): void {
    if (!data) return;
    
    // 将数据添加到缓冲区
    this.buffer.push(data);
    
    // 如果缓冲区达到最大大小，立即刷新
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
      return;
    }
    
    // 否则，调度批量写入
    this.scheduleWrite();
  }
  
  /**
   * 调度批量写入
   */
  private scheduleWrite(): void {
    // 如果已经有写入调度，不重复调度
    if (this.rafHandle !== null) return;
    
    // 清除任何现有的定时器
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    // 设置超时定时器，确保数据不会在缓冲区停留太久
    this.bufferTimer = setTimeout(() => {
      this.flush();
    }, this.maxBufferTime);
    
    // 使用requestAnimationFrame进行批量写入
    this.rafHandle = requestAnimationFrame(() => {
      this.performWrite();
    });
  }
  
  /**
   * 执行实际的写入操作
   */
  private performWrite(): void {
    // 清理调度标记
    this.rafHandle = null;
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    // 如果缓冲区为空，直接返回
    if (this.buffer.length === 0) return;
    
    // 防止重入
    if (this.isWriting) {
      this.scheduleWrite();
      return;
    }
    
    this.isWriting = true;
    
    try {
      // 批量写入所有缓冲的数据
      const combinedData = this.buffer.join('');
      this.buffer = [];
      
      // 写入到终端
      if (combinedData) {
        this.terminal.write(combinedData);
      }
    } catch (error) {
      console.error('Terminal write error:', error);
    } finally {
      this.isWriting = false;
      
      // 如果在写入期间又有新数据，重新调度
      if (this.buffer.length > 0) {
        this.scheduleWrite();
      }
    }
  }
  
  /**
   * 立即刷新缓冲区
   */
  flush(): void {
    // 取消任何现有的调度
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    // 立即执行写入
    this.performWrite();
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    // 刷新任何剩余的数据
    this.flush();
    
    // 清理定时器
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    // 清空缓冲区
    this.buffer = [];
  }
  
  /**
   * 获取当前缓冲区大小
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
  
  /**
   * 检查是否正在写入
   */
  isCurrentlyWriting(): boolean {
    return this.isWriting || this.buffer.length > 0;
  }
}