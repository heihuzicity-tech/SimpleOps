/**
 * 输入聚合器 - 优化SSH终端输入性能
 * 将50ms内的输入聚合成批量发送，减少网络请求
 */
export class InputAggregator {
  private buffer: string = '';
  private timer: NodeJS.Timeout | null = null;
  private callback: (data: string) => void;
  private delay: number;
  private immediateChars: Set<string>;

  constructor(
    callback: (data: string) => void,
    delay: number = 50,
    immediateChars: string[] = ['\r', '\n', '\x03', '\x04', '\x1a', '\x1c']
  ) {
    this.callback = callback;
    this.delay = delay;
    this.immediateChars = new Set(immediateChars);
  }

  /**
   * 添加输入到缓冲区
   * @param data 输入数据
   */
  public add(data: string): void {
    // 检查是否包含需要立即发送的特殊字符
    const hasImmediateChar = this.containsImmediateChar(data);
    
    if (hasImmediateChar) {
      // 立即发送缓冲区内容和当前输入
      this.flush();
      this.callback(data);
    } else {
      // 添加到缓冲区
      this.buffer += data;
      
      // 重置定时器
      if (this.timer) {
        clearTimeout(this.timer);
      }
      
      // 设置新的定时器
      this.timer = setTimeout(() => {
        this.flush();
      }, this.delay);
    }
  }

  /**
   * 立即发送缓冲区内容
   */
  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.buffer.length > 0) {
      this.callback(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 检查是否包含需要立即发送的字符
   * @param data 输入数据
   * @returns 是否包含特殊字符
   */
  private containsImmediateChar(data: string): boolean {
    for (const char of data) {
      if (this.immediateChars.has(char)) {
        return true;
      }
    }
    
    // 检查控制字符（ASCII < 32，除了Tab）
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      if (code < 32 && code !== 9) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取当前缓冲区大小
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * 检查是否有待发送的数据
   */
  public hasPendingData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * 更新延迟时间
   */
  public setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * 添加立即发送字符
   */
  public addImmediateChar(char: string): void {
    this.immediateChars.add(char);
  }

  /**
   * 移除立即发送字符
   */
  public removeImmediateChar(char: string): void {
    this.immediateChars.delete(char);
  }
}