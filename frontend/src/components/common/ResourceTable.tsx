import React, { useState, useCallback, useMemo } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Dropdown, 
  Menu, 
  Popconfirm, 
  Tooltip, 
  Tag, 
  Typography,
  Checkbox,
  Alert,
  Card
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  MoreOutlined,
  EyeOutlined,
  CopyOutlined,
  ExportOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { Key } from 'antd/es/table/interface';

const { Text } = Typography;

// 列配置类型
export interface ColumnConfig<T = any> {
  key: string;
  title: string;
  dataIndex?: string | string[];
  width?: number | string;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  // 自定义过滤器
  filters?: { text: string; value: any }[];
  // 列是否可见
  visible?: boolean;
  // 列是否可配置显示/隐藏
  configurable?: boolean;
  // 工具提示
  tooltip?: string;
  // 复制功能
  copyable?: boolean;
  // 省略号显示
  ellipsis?: boolean;
}

// 操作按钮配置
export interface ActionConfig<T = any> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  danger?: boolean;
  disabled?: (record: T) => boolean;
  visible?: (record: T) => boolean;
  confirm?: {
    title: string;
    description?: string;
    okText?: string;
    cancelText?: string;
  };
  onClick: (record: T, index: number) => void;
  // 权限检查
  permission?: string;
}

// 批量操作配置
export interface BatchActionConfig<T = any> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  confirm?: {
    title: string;
    description?: string;
    okText?: string;
    cancelText?: string;
  };
  onClick: (selectedRows: T[], selectedKeys: Key[]) => void;
  // 权限检查
  permission?: string;
}

// 分页配置
export interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
  pageSizeOptions?: string[];
  onChange: (page: number, pageSize: number) => void;
}

// 表格配置
export interface ResourceTableConfig<T = any> {
  // 基础配置
  rowKey: string | ((record: T) => string);
  
  // 选择功能
  selectable?: boolean;
  selectType?: 'checkbox' | 'radio';
  
  // 操作列
  showActions?: boolean;
  actionsWidth?: number;
  actionsFixed?: 'left' | 'right';
  maxVisibleActions?: number; // 最多显示几个操作按钮，其余放入下拉菜单
  
  // 表格功能
  bordered?: boolean;
  size?: 'small' | 'middle' | 'large';
  sticky?: boolean;
  showHeader?: boolean;
  
  // 导出功能
  exportable?: boolean;
  exportFileName?: string;
  
  // 列配置功能
  columnConfigurable?: boolean;
  
  // 刷新功能
  refreshable?: boolean;
  
  // 空状态
  emptyText?: string;
  emptyImage?: string;
}

// 组件Props
export interface ResourceTableProps<T = any> {
  // 数据
  data: T[];
  columns: ColumnConfig<T>[];
  loading?: boolean;
  
  // 配置
  config: ResourceTableConfig<T>;
  
  // 操作
  actions?: ActionConfig<T>[];
  batchActions?: BatchActionConfig<T>[];
  
  // 分页
  pagination?: PaginationConfig;
  
  // 选择
  selectedKeys?: Key[];
  onSelectionChange?: (selectedKeys: Key[], selectedRows: T[]) => void;
  
  // 事件
  onRefresh?: () => void;
  onExport?: (data: T[]) => void;
  onColumnConfigChange?: (columns: ColumnConfig<T>[]) => void;
  
  // 样式
  className?: string;
  style?: React.CSSProperties;
  
  // 表格属性
  tableProps?: Omit<TableProps<T>, 'dataSource' | 'columns' | 'loading' | 'pagination'>;
}

/**
 * 通用资源表格组件
 * 支持配置化列显示、操作按钮、批量操作、分页等功能
 */
export const ResourceTable = <T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  config,
  actions = [],
  batchActions = [],
  pagination,
  selectedKeys = [],
  onSelectionChange,
  onRefresh,
  onExport,
  onColumnConfigChange,
  className,
  style,
  tableProps,
}: ResourceTableProps<T>) => {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => {
      const visibility: Record<string, boolean> = {};
      columns.forEach(col => {
        visibility[col.key] = col.visible !== false;
      });
      return visibility;
    }
  );

  // 构建表格列
  const tableColumns = useMemo((): ColumnsType<T> => {
    const visibleColumns = columns.filter(col => columnVisibility[col.key]);
    
    const antdColumns: ColumnsType<T> = visibleColumns.map(col => {
      const antdCol: any = {
        key: col.key,
        title: col.tooltip ? (
          <Tooltip title={col.tooltip}>
            {col.title}
          </Tooltip>
        ) : col.title,
        dataIndex: col.dataIndex || col.key,
        width: col.width,
        fixed: col.fixed,
        align: col.align,
        sorter: col.sortable,
        filters: col.filters,
        ellipsis: col.ellipsis,
      };

      // 自定义渲染
      if (col.render) {
        antdCol.render = col.render;
      } else if (col.copyable) {
        antdCol.render = (value: any) => (
          <Text copyable={{ text: value }}>{value}</Text>
        );
      }

      return antdCol;
    });

    // 添加操作列
    if (config.showActions && actions.length > 0) {
      antdColumns.push({
        key: 'actions',
        title: '操作',
        width: config.actionsWidth || 150,
        fixed: config.actionsFixed || 'right',
        render: (_, record, index) => renderActions(record, index),
      });
    }

    return antdColumns;
  }, [columns, columnVisibility, config, actions]);

  // 渲染操作按钮
  const renderActions = useCallback((record: T, index: number) => {
    const visibleActions = actions.filter(action => 
      action.visible ? action.visible(record) : true
    );

    if (visibleActions.length === 0) {
      return null;
    }

    const maxVisible = config.maxVisibleActions || 3;
    const directActions = visibleActions.slice(0, maxVisible);
    const dropdownActions = visibleActions.slice(maxVisible);

    const renderAction = (action: ActionConfig<T>) => {
      const button = (
        <Button
          key={action.key}
          type={action.type || 'link'}
          size="small"
          icon={action.icon}
          danger={action.danger}
          disabled={action.disabled ? action.disabled(record) : false}
          onClick={() => action.onClick(record, index)}
        >
          {action.label}
        </Button>
      );

      if (action.confirm) {
        return (
          <Popconfirm
            key={action.key}
            title={action.confirm.title}
            description={action.confirm.description}
            okText={action.confirm.okText || '确定'}
            cancelText={action.confirm.cancelText || '取消'}
            onConfirm={() => action.onClick(record, index)}
          >
            {React.cloneElement(button, { onClick: undefined })}
          </Popconfirm>
        );
      }

      return button;
    };

    const elements = directActions.map(renderAction);

    if (dropdownActions.length > 0) {
      const menu = (
        <Menu>
          {dropdownActions.map(action => (
            <Menu.Item
              key={action.key}
              icon={action.icon}
              danger={action.danger}
              disabled={action.disabled ? action.disabled(record) : false}
              onClick={() => action.onClick(record, index)}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu>
      );

      elements.push(
        <Dropdown key="more" overlay={menu} trigger={['click']}>
          <Button type="link" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      );
    }

    return <Space size="small">{elements}</Space>;
  }, [actions, config.maxVisibleActions]);

  // 渲染批量操作
  const renderBatchActions = () => {
    if (!config.selectable || batchActions.length === 0 || selectedKeys.length === 0) {
      return null;
    }

    const selectedRows = data.filter(item => {
      const key = typeof config.rowKey === 'function' ? config.rowKey(item) : item[config.rowKey];
      return selectedKeys.includes(key);
    });

    return (
      <Alert
        type="info"
        showIcon
        message={
          <Space>
            <span>已选择 {selectedKeys.length} 项</span>
            {batchActions.map(action => {
              const button = (
                <Button
                  key={action.key}
                  type="link"
                  size="small"
                  icon={action.icon}
                  danger={action.danger}
                  onClick={() => action.onClick(selectedRows, selectedKeys)}
                >
                  {action.label}
                </Button>
              );

              if (action.confirm) {
                return (
                  <Popconfirm
                    key={action.key}
                    title={action.confirm.title}
                    description={action.confirm.description}
                    okText={action.confirm.okText || '确定'}
                    cancelText={action.confirm.cancelText || '取消'}
                    onConfirm={() => action.onClick(selectedRows, selectedKeys)}
                  >
                    {React.cloneElement(button, { onClick: undefined })}
                  </Popconfirm>
                );
              }

              return button;
            })}
          </Space>
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  // 渲染表格工具栏
  const renderToolbar = () => {
    const hasTools = config.refreshable || config.exportable || config.columnConfigurable;
    
    if (!hasTools) {
      return null;
    }

    return (
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          {config.refreshable && (
            <Tooltip title="刷新">
              <Button icon={<ReloadOutlined />} onClick={onRefresh} />
            </Tooltip>
          )}
          
          {config.exportable && (
            <Button 
              icon={<ExportOutlined />} 
              onClick={() => onExport && onExport(data)}
            >
              导出
            </Button>
          )}
          
          {config.columnConfigurable && (
            <Dropdown
              overlay={
                <Menu>
                  {columns.filter(col => col.configurable !== false).map(col => (
                    <Menu.Item key={col.key}>
                      <Checkbox
                        checked={columnVisibility[col.key]}
                        onChange={(e) => {
                          const newVisibility = {
                            ...columnVisibility,
                            [col.key]: e.target.checked
                          };
                          setColumnVisibility(newVisibility);
                          
                          if (onColumnConfigChange) {
                            const updatedColumns = columns.map(c => ({
                              ...c,
                              visible: newVisibility[c.key]
                            }));
                            onColumnConfigChange(updatedColumns);
                          }
                        }}
                      >
                        {col.title}
                      </Checkbox>
                    </Menu.Item>
                  ))}
                </Menu>
              }
              trigger={['click']}
            >
              <Button icon={<SettingOutlined />}>
                列配置
              </Button>
            </Dropdown>
          )}
        </Space>
      </div>
    );
  };

  // 行选择配置
  const rowSelection = config.selectable ? {
    type: config.selectType || 'checkbox',
    selectedRowKeys: selectedKeys,
    onChange: (keys: Key[], rows: T[]) => {
      onSelectionChange && onSelectionChange(keys, rows);
    },
    getCheckboxProps: (record: T) => ({
      name: record.name,
    }),
  } : undefined;

  // 分页配置
  const paginationConfig = pagination ? {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: pagination.showSizeChanger !== false,
    showQuickJumper: pagination.showQuickJumper !== false,
    showTotal: pagination.showTotal !== false ? 
      (total: number, range: [number, number]) => 
        `显示 ${range[0]}-${range[1]} 条，共 ${total} 条` : 
      undefined,
    pageSizeOptions: pagination.pageSizeOptions || ['10', '20', '50', '100'],
    onChange: pagination.onChange,
    onShowSizeChange: pagination.onChange,
  } : false;

  return (
    <div className={className} style={style}>
      {renderToolbar()}
      {renderBatchActions()}
      
      <Table<T>
        dataSource={data}
        columns={tableColumns}
        loading={loading}
        pagination={paginationConfig}
        rowSelection={rowSelection as any}
        rowKey={config.rowKey}
        bordered={config.bordered}
        size={config.size || 'middle'}
        sticky={config.sticky}
        showHeader={config.showHeader !== false}
        locale={{
          emptyText: config.emptyText || '暂无数据',
        }}
        scroll={{ x: 'max-content' }}
        {...tableProps}
      />
    </div>
  );
};

// 预设的常用操作
export const CommonActions = {
  view: (onClick: (record: any) => void): ActionConfig => ({
    key: 'view',
    label: '查看',
    icon: <EyeOutlined />,
    onClick,
  }),
  
  edit: (onClick: (record: any) => void): ActionConfig => ({
    key: 'edit',
    label: '编辑',
    icon: <EditOutlined />,
    onClick,
  }),
  
  delete: (onClick: (record: any) => void): ActionConfig => ({
    key: 'delete',
    label: '删除',
    icon: <DeleteOutlined />,
    danger: true,
    confirm: {
      title: '确定要删除这条记录吗？',
      description: '删除后无法恢复',
    },
    onClick,
  }),
  
  copy: (onClick: (record: any) => void): ActionConfig => ({
    key: 'copy',
    label: '复制',
    icon: <CopyOutlined />,
    onClick,
  }),
};

// 预设的批量操作
export const CommonBatchActions = {
  batchDelete: (onClick: (selectedRows: any[], selectedKeys: Key[]) => void): BatchActionConfig => ({
    key: 'batchDelete',
    label: '批量删除',
    icon: <DeleteOutlined />,
    danger: true,
    confirm: {
      title: '确定要删除选中的记录吗？',
      description: '删除后无法恢复',
    },
    onClick,
  }),
  
  batchExport: (onClick: (selectedRows: any[], selectedKeys: Key[]) => void): BatchActionConfig => ({
    key: 'batchExport',
    label: '批量导出',
    icon: <ExportOutlined />,
    onClick,
  }),
};

export default ResourceTable;