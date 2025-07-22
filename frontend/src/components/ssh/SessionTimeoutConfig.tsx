import React, { useState } from 'react';
import { Form, Select, InputNumber, Typography, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

export interface TimeoutOption {
  label: string;
  value: number; // 分钟数，0表示无限制
}

export interface SessionTimeoutConfigProps {
  value?: number;
  onChange?: (timeout: number) => void;
  disabled?: boolean;
}

const SessionTimeoutConfig: React.FC<SessionTimeoutConfigProps> = ({
  value = 30,
  onChange,
  disabled = false
}) => {
  const [useCustom, setUseCustom] = useState(false);

  // 预设超时选项
  const timeoutOptions: TimeoutOption[] = [
    { label: '15分钟', value: 15 },
    { label: '30分钟', value: 30 },
    { label: '1小时', value: 60 },
    { label: '2小时', value: 120 },
    { label: '4小时', value: 240 },
    { label: '8小时', value: 480 },
    { label: '无限制', value: 0 },
    { label: '自定义', value: -1 }
  ];

  const handlePresetChange = (selectedValue: number) => {
    if (selectedValue === -1) {
      // 选择自定义
      setUseCustom(true);
      onChange?.(30); // 默认30分钟
    } else {
      setUseCustom(false);
      onChange?.(selectedValue);
    }
  };

  const handleCustomChange = (customValue: number | null) => {
    if (customValue && customValue > 0) {
      onChange?.(customValue);
    }
  };

  // 获取当前显示值
  const getCurrentSelectValue = () => {
    if (useCustom) return -1;
    const preset = timeoutOptions.find(opt => opt.value === value && opt.value !== -1);
    return preset ? preset.value : -1;
  };

  const formatTimeoutDisplay = (minutes: number) => {
    if (minutes === 0) return '无限制';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}小时`;
    return `${hours}小时${remainingMinutes}分钟`;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text>会话超时:</Text>
        <Tooltip title="会话无活动时自动断开连接，键盘输入和鼠标操作会重置计时器">
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
        </Tooltip>
      </div>
      
      <Select
        value={getCurrentSelectValue()}
        onChange={handlePresetChange}
        disabled={disabled}
        style={{ width: '100%' }}
        placeholder="选择超时时间"
      >
        {timeoutOptions.map(option => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>

      {useCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text>自定义时间:</Text>
          <InputNumber
            min={1}
            max={480}
            value={value}
            onChange={handleCustomChange}
            disabled={disabled}
            placeholder="输入分钟数"
            style={{ flex: 1 }}
            addonAfter="分钟"
          />
        </div>
      )}

      {value > 0 && (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          当前设置: {formatTimeoutDisplay(value)}后自动断开
        </Text>
      )}

      {value === 0 && (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          当前设置: 会话不会自动断开
        </Text>
      )}
    </Space>
  );
};

export default SessionTimeoutConfig;