import React from 'react';
import { Tag, Badge, Tooltip, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined, 
  SyncOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { ConnectionStatus } from '../../hooks/useConnectionStatus';

// 组件Props接口
export interface ConnectionStatusTagProps {
  status: ConnectionStatus;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  // 扩展信息
  latency?: number;
  lastTestTime?: number;
  successRate?: number;
  message?: string;
  error?: string;
}

// 状态配置
const statusConfig = {
  idle: {
    color: 'default',
    text: '未测试',
    icon: MinusCircleOutlined,
    badgeStatus: 'default' as const,
  },
  connecting: {
    color: 'processing',
    text: '连接中',
    icon: SyncOutlined,
    badgeStatus: 'processing' as const,
  },
  connected: {
    color: 'success',
    text: '连接成功',
    icon: CheckCircleOutlined,
    badgeStatus: 'success' as const,
  },
  disconnected: {
    color: 'warning',
    text: '连接断开',
    icon: ExclamationCircleOutlined,
    badgeStatus: 'warning' as const,
  },
  error: {
    color: 'error',
    text: '连接失败',
    icon: CloseCircleOutlined,
    badgeStatus: 'error' as const,
  },
};

// 格式化延迟显示
const formatLatency = (latency?: number): string => {
  if (latency === undefined) return '';
  if (latency < 1000) return `${latency}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

// 格式化时间显示
const formatTime = (timestamp?: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  
  if (diff < 60000) { // 1分钟内
    return '刚刚';
  } else if (diff < 3600000) { // 1小时内
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) { // 24小时内
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString();
  }
};

// 生成工具提示内容
const generateTooltipContent = (props: ConnectionStatusTagProps) => {
  const { status, latency, lastTestTime, successRate, message, error } = props;
  const config = statusConfig[status];
  
  const items = [
    `状态: ${config.text}`,
  ];
  
  if (message) {
    items.push(`消息: ${message}`);
  }
  
  if (error) {
    items.push(`错误: ${error}`);
  }
  
  if (latency !== undefined) {
    items.push(`延迟: ${formatLatency(latency)}`);
  }
  
  if (lastTestTime) {
    items.push(`测试时间: ${formatTime(lastTestTime)}`);
  }
  
  if (successRate !== undefined) {
    items.push(`成功率: ${successRate}%`);
  }
  
  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>{item}</div>
      ))}
    </div>
  );
};

/**
 * 连接状态标签组件
 * 统一显示连接状态，支持不同样式和扩展信息
 */
export const ConnectionStatusTag: React.FC<ConnectionStatusTagProps> = ({
  status,
  size = 'medium',
  showText = true,
  showIcon = true,
  showTooltip = true,
  className,
  style,
  onClick,
  ...props
}) => {
  const config = statusConfig[status];
  const IconComponent = config.icon;
  
  // 根据size确定实际尺寸
  const getTagSize = () => {
    switch (size) {
      case 'small':
        return 'small' as const;
      case 'large':
        return 'large' as const;
      default:
        return undefined;
    }
  };
  
  // 构建标签内容
  const buildTagContent = () => {
    const elements = [];
    
    // 添加图标
    if (showIcon) {
      elements.push(
        <IconComponent 
          key="icon" 
          spin={status === 'connecting'} 
          style={{ fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px' }}
        />
      );
    }
    
    // 添加文本
    if (showText) {
      let displayText = config.text;
      
      // 在中等和大尺寸下显示延迟信息
      if (size !== 'small' && props.latency !== undefined && status === 'connected') {
        displayText += ` (${formatLatency(props.latency)})`;
      }
      
      elements.push(
        <span key="text">{displayText}</span>
      );
    }
    
    return elements.length === 1 ? elements[0] : <Space size={4}>{elements}</Space>;
  };
  
  // 构建标签组件
  const tagElement = (
    <Tag
      color={config.color}
      className={className}
      style={{ 
        cursor: onClick ? 'pointer' : 'default',
        ...style 
      }}
      onClick={onClick}
      icon={!showText && showIcon ? <IconComponent spin={status === 'connecting'} /> : undefined}
    >
      {showText || !showIcon ? buildTagContent() : null}
    </Tag>
  );
  
  // 是否需要工具提示
  if (showTooltip) {
    return (
      <Tooltip 
        title={generateTooltipContent({ status, ...props })}
        placement="top"
        overlayStyle={{ maxWidth: '300px' }}
      >
        {tagElement}
      </Tooltip>
    );
  }
  
  return tagElement;
};

// 预设组件变体
export const ConnectionStatusBadge: React.FC<Omit<ConnectionStatusTagProps, 'showText' | 'showIcon'>> = (props) => {
  const config = statusConfig[props.status];
  
  const badgeElement = (
    <Badge 
      status={config.badgeStatus}
      text={config.text}
      className={props.className}
      style={props.style}
    />
  );
  
  if (props.showTooltip !== false) {
    return (
      <Tooltip title={generateTooltipContent(props)}>
        {badgeElement}
      </Tooltip>
    );
  }
  
  return badgeElement;
};

// 仅图标组件
export const ConnectionStatusIcon: React.FC<Omit<ConnectionStatusTagProps, 'showText' | 'showIcon'> & { size?: number }> = ({ 
  status, 
  size = 14, 
  showTooltip = true,
  style,
  onClick,
  ...props 
}) => {
  const config = statusConfig[status];
  const IconComponent = config.icon;
  
  const iconElement = (
    <IconComponent 
      spin={status === 'connecting'}
      style={{ 
        color: getStatusColor(status),
        fontSize: size,
        cursor: onClick ? 'pointer' : 'default',
        ...style 
      }}
      onClick={onClick}
    />
  );
  
  if (showTooltip) {
    return (
      <Tooltip title={generateTooltipContent({ status, ...props })}>
        {iconElement}
      </Tooltip>
    );
  }
  
  return iconElement;
};

// 获取状态颜色的工具函数
const getStatusColor = (status: ConnectionStatus): string => {
  switch (status) {
    case 'idle':
      return '#d9d9d9';
    case 'connecting':
      return '#1890ff';
    case 'connected':
      return '#52c41a';
    case 'disconnected':
      return '#faad14';
    case 'error':
      return '#ff4d4f';
    default:
      return '#d9d9d9';
  }
};

// 简化的状态显示组件（用于表格等紧凑场景）
export const SimpleConnectionStatus: React.FC<{
  status: ConnectionStatus;
  size?: 'small' | 'medium';
}> = ({ status, size = 'small' }) => {
  return (
    <ConnectionStatusTag
      status={status}
      size={size}
      showText={size !== 'small'}
      showIcon={true}
      showTooltip={true}
    />
  );
};

// 导出默认组件
export default ConnectionStatusTag;