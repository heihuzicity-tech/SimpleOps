import React, { useState, useCallback, useEffect } from 'react';
import { 
  Input, 
  Select, 
  DatePicker, 
  Button, 
  Card, 
  Row, 
  Col, 
  Space, 
  Tooltip,
  Badge,
  Collapse,
  Form
} from 'antd';
import { 
  SearchOutlined, 
  ClearOutlined, 
  FilterOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

// 过滤器选项配置
export interface FilterOption {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiSelect' | 'date' | 'dateRange' | 'number' | 'switch';
  options?: { value: any; label: string; disabled?: boolean }[];
  placeholder?: string;
  defaultValue?: any;
  rules?: any[];
  tooltip?: string;
  width?: string | number;
  allowClear?: boolean;
  showSearch?: boolean;
}

// 搜索过滤器配置
export interface SearchFilterConfig {
  // 主搜索框
  searchPlaceholder?: string;
  searchWidth?: string | number;
  
  // 过滤器
  filters?: FilterOption[];
  
  // 布局
  layout?: 'horizontal' | 'vertical' | 'inline';
  showAdvanced?: boolean;
  collapsible?: boolean;
  
  // 功能
  showClear?: boolean;
  showFilterCount?: boolean;
  autoSubmit?: boolean;
  submitDelay?: number;
}

// 过滤器值类型
export type FilterValues = Record<string, any>;

// 组件Props
export interface SearchFilterProps {
  config: SearchFilterConfig;
  onSearch: (keyword: string, filters: FilterValues) => void;
  onClear?: () => void;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  defaultKeyword?: string;
  defaultFilters?: FilterValues;
}

// 预设过滤器配置
export const AssetFilters: FilterOption[] = [
  {
    key: 'type',
    label: '资产类型',
    type: 'select',
    options: [
      { value: 'server', label: '服务器' },
      { value: 'database', label: '数据库' },
      { value: 'network', label: '网络设备' },
      { value: 'storage', label: '存储设备' },
    ],
    placeholder: '选择资产类型',
    allowClear: true,
  },
  {
    key: 'protocol',
    label: '协议',
    type: 'select',
    options: [
      { value: 'ssh', label: 'SSH' },
      { value: 'rdp', label: 'RDP' },
      { value: 'vnc', label: 'VNC' },
      { value: 'mysql', label: 'MySQL' },
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'telnet', label: 'Telnet' },
    ],
    placeholder: '选择协议',
    allowClear: true,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 1, label: '启用' },
      { value: 0, label: '禁用' },
    ],
    placeholder: '选择状态',
    allowClear: true,
  },
  {
    key: 'group_id',
    label: '分组',
    type: 'select',
    placeholder: '选择分组',
    allowClear: true,
    // options 需要动态传入
  },
];

export const SessionFilters: FilterOption[] = [
  {
    key: 'username',
    label: '用户名',
    type: 'text',
    placeholder: '输入用户名',
  },
  {
    key: 'asset_name',
    label: '资产名称',
    type: 'text',
    placeholder: '输入资产名称',
  },
  {
    key: 'protocol',
    label: '协议',
    type: 'select',
    options: [
      { value: 'ssh', label: 'SSH' },
      { value: 'rdp', label: 'RDP' },
      { value: 'vnc', label: 'VNC' },
    ],
    placeholder: '选择协议',
    allowClear: true,
  },
  {
    key: 'status',
    label: '会话状态',
    type: 'select',
    options: [
      { value: 'active', label: '活跃' },
      { value: 'closed', label: '已关闭' },
      { value: 'timeout', label: '超时' },
      { value: 'terminated', label: '强制终止' },
    ],
    placeholder: '选择状态',
    allowClear: true,
  },
  {
    key: 'date_range',
    label: '时间范围',
    type: 'dateRange',
    placeholder: '选择时间范围',
  },
];

/**
 * 通用搜索过滤组件
 * 支持关键字搜索和多种类型的过滤器
 */
export const SearchFilter: React.FC<SearchFilterProps> = ({
  config,
  onSearch,
  onClear,
  loading = false,
  className,
  style,
  defaultKeyword = '',
  defaultFilters = {},
}) => {
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(config.showAdvanced || false);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // 获取活跃过滤器数量
  const getActiveFilterCount = useCallback(() => {
    return Object.keys(filters).filter(key => {
      const value = filters[key];
      return value !== undefined && value !== null && value !== '' && 
             (!Array.isArray(value) || value.length > 0);
    }).length;
  }, [filters]);

  // 延迟搜索
  const debounceSearch = useCallback((searchKeyword: string, searchFilters: FilterValues) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => {
      onSearch(searchKeyword, searchFilters);
    }, config.submitDelay || 300);

    setSearchTimer(timer);
  }, [onSearch, config.submitDelay, searchTimer]);

  // 处理关键字搜索
  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (config.autoSubmit) {
      debounceSearch(value, filters);
    }
  };

  // 处理过滤器变化
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    if (config.autoSubmit) {
      debounceSearch(keyword, newFilters);
    }
  };

  // 手动搜索
  const handleSearch = () => {
    onSearch(keyword, filters);
  };

  // 清空所有过滤条件
  const handleClear = () => {
    setKeyword('');
    setFilters({});
    form.resetFields();
    
    if (onClear) {
      onClear();
    } else {
      onSearch('', {});
    }
  };

  // 渲染过滤器输入组件
  const renderFilterInput = (filter: FilterOption) => {
    const commonProps = {
      placeholder: filter.placeholder,
      style: { width: filter.width || '100%' },
      allowClear: filter.allowClear !== false,
    };

    switch (filter.type) {
      case 'text':
        return (
          <Input
            {...commonProps}
            value={filters[filter.key]}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            value={filters[filter.key]}
            onChange={(value) => handleFilterChange(filter.key, value)}
            showSearch={filter.showSearch}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {filter.options?.map(option => (
              <Option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </Option>
            ))}
          </Select>
        );

      case 'multiSelect':
        return (
          <Select
            {...commonProps}
            mode="multiple"
            value={filters[filter.key]}
            onChange={(value) => handleFilterChange(filter.key, value)}
            showSearch={filter.showSearch}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {filter.options?.map(option => (
              <Option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </Option>
            ))}
          </Select>
        );

      case 'date':
        return (
          <DatePicker
            {...commonProps}
            value={filters[filter.key] ? dayjs(filters[filter.key]) : undefined}
            onChange={(date) => handleFilterChange(filter.key, date?.format('YYYY-MM-DD'))}
          />
        );

      case 'dateRange':
        return (
          <RangePicker
            placeholder={filter.placeholder ? [filter.placeholder, filter.placeholder] : ['开始日期', '结束日期']}
            style={{ width: filter.width || '100%' }}
            allowClear={filter.allowClear !== false}
            value={filters[filter.key] ? 
              [dayjs(filters[filter.key][0]), dayjs(filters[filter.key][1])] : 
              undefined
            }
            onChange={(dates) => {
              const dateRange = dates ? [
                dates[0]?.format('YYYY-MM-DD'),
                dates[1]?.format('YYYY-MM-DD')
              ] : undefined;
              handleFilterChange(filter.key, dateRange);
            }}
          />
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={filters[filter.key]}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          />
        );

      default:
        return null;
    }
  };

  // 渲染过滤器项
  const renderFilterItem = (filter: FilterOption) => {
    const input = renderFilterInput(filter);
    
    if (filter.tooltip) {
      return (
        <Tooltip title={filter.tooltip}>
          {input}
        </Tooltip>
      );
    }
    
    return input;
  };

  // 获取主要过滤器（显示在主行）
  const getMainFilters = () => {
    return config.filters?.slice(0, showAdvanced ? config.filters.length : 3) || [];
  };

  // 获取高级过滤器（折叠显示）
  const getAdvancedFilters = () => {
    if (!config.filters || config.filters.length <= 3) return [];
    return config.filters.slice(3);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [searchTimer]);

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className={className} style={style} bodyStyle={{ paddingBottom: 16 }}>
      <Form form={form} layout={config.layout || 'horizontal'}>
        <Row gutter={[16, 16]} align="middle">
          {/* 主搜索框 */}
          <Col xs={24} sm={8} lg={6}>
            <Input
              placeholder={config.searchPlaceholder || '输入关键字搜索...'}
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: config.searchWidth || '100%' }}
              allowClear
            />
          </Col>

          {/* 主要过滤器 */}
          {getMainFilters().map(filter => (
            <Col key={filter.key} xs={24} sm={8} lg={4}>
              <div>
                <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                  {filter.label}
                </div>
                {renderFilterItem(filter)}
              </div>
            </Col>
          ))}

          {/* 操作按钮 */}
          <Col xs={24} sm={8} lg={6}>
            <Space>
              {!config.autoSubmit && (
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  loading={loading}
                >
                  搜索
                </Button>
              )}
              
              {config.showClear !== false && (
                <Button 
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                  disabled={loading}
                >
                  清空
                </Button>
              )}

              {config.filters && config.filters.length > 3 && (
                <Button
                  type="text"
                  icon={showAdvanced ? <UpOutlined /> : <DownOutlined />}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  高级
                  {config.showFilterCount && activeFilterCount > 0 && (
                    <Badge count={activeFilterCount} size="small" style={{ marginLeft: 4 }} />
                  )}
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {/* 高级过滤器 */}
        {showAdvanced && getAdvancedFilters().length > 0 && (
          <Row gutter={[16, 16]} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            {getAdvancedFilters().map(filter => (
              <Col key={filter.key} xs={24} sm={12} lg={6}>
                <div>
                  <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                    {filter.label}
                  </div>
                  {renderFilterItem(filter)}
                </div>
              </Col>
            ))}
          </Row>
        )}

        {/* 活跃过滤器提示 */}
        {config.showFilterCount && activeFilterCount > 0 && (
          <Row style={{ marginTop: 8 }}>
            <Col span={24}>
              <Space size={8}>
                <FilterOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontSize: '12px', color: '#666' }}>
                  已应用 {activeFilterCount} 个过滤条件
                </span>
                {Object.entries(filters).map(([key, value]) => {
                  if (value === undefined || value === null || value === '' || 
                      (Array.isArray(value) && value.length === 0)) {
                    return null;
                  }
                  
                  const filter = config.filters?.find(f => f.key === key);
                  if (!filter) return null;
                  
                  let displayValue = value;
                  if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                  } else if (filter.options) {
                    const option = filter.options.find(opt => opt.value === value);
                    displayValue = option?.label || value;
                  }
                  
                  return (
                    <Badge
                      key={key}
                      count={
                        <span style={{ fontSize: '11px' }}>
                          {filter.label}: {displayValue}
                        </span>
                      }
                      style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                    />
                  );
                })}
              </Space>
            </Col>
          </Row>
        )}
      </Form>
    </Card>
  );
};

export default SearchFilter;