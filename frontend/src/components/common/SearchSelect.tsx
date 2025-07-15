import React from 'react';
import { Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Search, Group } = Input;

interface SearchSelectProps {
  searchType: string;
  onSearchTypeChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  searchOptions?: Array<{ value: string; label: string }>;
  style?: React.CSSProperties;
  size?: 'large' | 'middle' | 'small';
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SearchSelect: React.FC<SearchSelectProps> = ({
  searchType,
  onSearchTypeChange,
  onSearch,
  placeholder = '请输入关键字搜索',
  searchOptions = [],
  style,
  size = 'middle',
  value,
  onChange,
}) => {
  const selectBefore = (
    <Select
      value={searchType}
      onChange={onSearchTypeChange}
      size={size}
      style={{ width: 120 }}
      bordered={false}
    >
      {searchOptions.map(option => (
        <Option key={option.value} value={option.value}>
          {option.label}
        </Option>
      ))}
    </Select>
  );

  return (
    <div style={{ display: 'inline-block', ...style }}>
      <style>
        {`
          .search-select-custom .ant-input-group-wrapper {
            border-radius: 0 !important;
          }
          .search-select-custom .ant-input-group {
            border-radius: 0 !important;
          }
          .search-select-custom .ant-input-group-addon {
            border-radius: 0 !important;
            background-color: #fafafa !important;
            border-right: 0 !important;
          }
          .search-select-custom .ant-input-group-addon .ant-select-selector {
            border: none !important;
            border-radius: 0 !important;
            background-color: transparent !important;
          }
          .search-select-custom .ant-input-affix-wrapper {
            border-radius: 0 !important;
            border-left: 0 !important;
          }
          .search-select-custom .ant-input {
            border-radius: 0 !important;
          }
          .search-select-custom .ant-input-search-button {
            border-radius: 0 !important;
          }
          .search-select-custom .ant-btn {
            border-radius: 0 !important;
          }
        `}
      </style>
      <Search
        placeholder={placeholder}
        onSearch={onSearch}
        value={value}
        onChange={onChange}
        size={size}
        allowClear
        enterButton={<SearchOutlined />}
        addonBefore={selectBefore}
        className="search-select-custom"
      />
    </div>
  );
};

export default SearchSelect;