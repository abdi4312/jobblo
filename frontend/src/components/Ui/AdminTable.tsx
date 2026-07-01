import React from 'react';
import { Table, Card, Button, Space, Select, Input } from 'antd';
import type { TableProps } from 'antd';
import { Search, Filter, Plus } from 'lucide-react';

interface AdminTableProps<T extends Record<string, any>> extends TableProps<T> {
  title: string;
  extra?: React.ReactNode;
  topSection?: React.ReactNode;
  onAddButtonClick?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterOptions?: Array<{ label: string; value: string }>;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
}

export const AdminTable = <T extends Record<string, any>>({
  title,
  extra,
  topSection,
  onAddButtonClick,
  addButtonText = 'Add New',
  showAddButton = true,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filterOptions,
  filterValue,
  onFilterChange,
  filterPlaceholder = 'All',
  ...tableProps
}: AdminTableProps<T>) => {
  return (
    <Card title={title} extra={extra} className="shadow-sm">
      {(topSection || showAddButton || onSearchChange || filterOptions) && (
        <div className="flex flex-col lg:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          {topSection || (
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {onSearchChange && (
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <Input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-full outline-none focus:border-[#2d4a3e]"
                  />
                </div>
              )}
              {filterOptions && onFilterChange && (
                <Select
                  placeholder={filterPlaceholder}
                  value={filterValue || undefined}
                  onChange={onFilterChange}
                  style={{ width: 200 }}
                  suffixIcon={<Filter size={16} />}
                >
                  {filterOptions.map((option) => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>
          )}
          {showAddButton && onAddButtonClick && (
            <Button
              type="primary"
              icon={<Plus size={18} />}
              onClick={onAddButtonClick}
              className="bg-[#2d4a3e] hover:bg-[#233b31] flex items-center"
            >
              {addButtonText}
            </Button>
          )}
        </div>
      )}

      <Table {...tableProps} />
    </Card>
  );
};
