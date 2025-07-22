import { useCallback, useEffect, useRef } from 'react';

export interface ActivityDetectorOptions {
  sessionId: string;
  onActivity?: (activity: UserActivityData) => void;
  throttleMs?: number; // 节流时间，默认500ms
  enableMouseTracking?: boolean; // 是否启用鼠标活动跟踪，默认true
  enableKeyboardTracking?: boolean; // 是否启用键盘活动跟踪，默认true
}

export interface UserActivityData {
  sessionId: string;
  timestamp: Date;
  activityType: 'keyboard' | 'mouse' | 'mixed';
  inputCount: number;
  lastInput: Date;
  lastMouseMove: Date;
  isActive: boolean;
}

export const useActivityDetector = (options: ActivityDetectorOptions) => {
  const {
    sessionId,
    onActivity,
    throttleMs = 500,
    enableMouseTracking = true,
    enableKeyboardTracking = true
  } = options;

  // 活动状态引用
  const activityRef = useRef<UserActivityData>({
    sessionId,
    timestamp: new Date(),
    activityType: 'mixed',
    inputCount: 0,
    lastInput: new Date(0),
    lastMouseMove: new Date(0),
    isActive: false
  });

  // 节流定时器引用
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastReportTimeRef = useRef<number>(0);

  // 报告活动的节流函数
  const reportActivity = useCallback((activityType: 'keyboard' | 'mouse') => {
    const now = Date.now();
    const timeSinceLastReport = now - lastReportTimeRef.current;

    // 更新活动数据
    const currentActivity = activityRef.current;
    currentActivity.timestamp = new Date(now);
    currentActivity.activityType = activityType;
    currentActivity.isActive = true;

    if (activityType === 'keyboard') {
      currentActivity.inputCount += 1;
      currentActivity.lastInput = new Date(now);
    } else if (activityType === 'mouse') {
      currentActivity.lastMouseMove = new Date(now);
    }

    // 如果距离上次报告时间超过节流时间，立即报告
    if (timeSinceLastReport >= throttleMs) {
      lastReportTimeRef.current = now;
      onActivity?.(currentActivity);
      return;
    }

    // 否则，设置节流定时器
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(() => {
      lastReportTimeRef.current = Date.now();
      onActivity?.(currentActivity);
      throttleTimerRef.current = null;
    }, throttleMs - timeSinceLastReport);
  }, [onActivity, throttleMs]);

  // 键盘事件处理器
  const handleKeyboardActivity = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardTracking) return;
    
    // 只跟踪实际的输入键，忽略功能键
    if (event.key.length === 1 || 
        ['Backspace', 'Delete', 'Enter', 'Tab', 'Space'].includes(event.key)) {
      reportActivity('keyboard');
    }
  }, [enableKeyboardTracking, reportActivity]);

  // 鼠标事件处理器
  const handleMouseActivity = useCallback(() => {
    if (!enableMouseTracking) return;
    reportActivity('mouse');
  }, [enableMouseTracking, reportActivity]);

  // 鼠标点击事件处理器
  const handleMouseClick = useCallback(() => {
    if (!enableMouseTracking) return;
    reportActivity('mouse');
  }, [enableMouseTracking, reportActivity]);

  // 获取当前活动状态
  const getCurrentActivity = useCallback((): UserActivityData => {
    return { ...activityRef.current };
  }, []);

  // 重置活动状态
  const resetActivity = useCallback(() => {
    activityRef.current = {
      sessionId,
      timestamp: new Date(),
      activityType: 'mixed',
      inputCount: 0,
      lastInput: new Date(0),
      lastMouseMove: new Date(0),
      isActive: false
    };
  }, [sessionId]);

  // 手动触发活动报告
  const triggerActivity = useCallback((type: 'keyboard' | 'mouse' = 'mixed' as any) => {
    reportActivity(type);
  }, [reportActivity]);

  // 设置事件监听器
  useEffect(() => {
    // 重置活动状态
    resetActivity();

    if (enableKeyboardTracking) {
      // 监听键盘事件
      document.addEventListener('keydown', handleKeyboardActivity);
      document.addEventListener('keypress', handleKeyboardActivity);
    }

    if (enableMouseTracking) {
      // 监听鼠标事件
      document.addEventListener('mousemove', handleMouseActivity);
      document.addEventListener('mousedown', handleMouseClick);
      document.addEventListener('click', handleMouseClick);
    }

    return () => {
      // 清理事件监听器
      if (enableKeyboardTracking) {
        document.removeEventListener('keydown', handleKeyboardActivity);
        document.removeEventListener('keypress', handleKeyboardActivity);
      }

      if (enableMouseTracking) {
        document.removeEventListener('mousemove', handleMouseActivity);
        document.removeEventListener('mousedown', handleMouseClick);
        document.removeEventListener('click', handleMouseClick);
      }

      // 清理节流定时器
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [
    sessionId,
    enableKeyboardTracking,
    enableMouseTracking,
    handleKeyboardActivity,
    handleMouseActivity,
    handleMouseClick,
    resetActivity
  ]);

  return {
    getCurrentActivity,
    resetActivity,
    triggerActivity,
    isActive: activityRef.current.isActive
  };
};