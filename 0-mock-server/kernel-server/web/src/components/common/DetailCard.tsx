/**
 * DetailCard - 通用详情卡片组件
 * 用于展示实体的所有属性,提供良好的视觉层次和用户体验
 */

import { ReactNode } from 'react';

export interface DetailField {
  label: string;
  value: any;
  type?: 'text' | 'code' | 'date' | 'array' | 'boolean';
  highlight?: boolean; // 是否高亮显示(如ID、名称等关键字段)
}

export interface DetailCardProps {
  title: string;
  icon?: ReactNode;
  fields: DetailField[];
  actions?: ReactNode;
}

export function DetailCard({ title, icon, fields, actions }: DetailCardProps) {
  const formatValue = (field: DetailField) => {
    if (field.value === null || field.value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    switch (field.type) {
      case 'code':
        return (
          <code className="px-2 py-1 bg-gray-100 text-sm font-mono rounded border border-gray-200">
            {field.value}
          </code>
        );

      case 'date':
        return (
          <span className="text-gray-700">
            {new Date(field.value).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        );

      case 'array':
        if (Array.isArray(field.value) && field.value.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {field.value.map((item, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200"
                >
                  {item}
                </span>
              ))}
            </div>
          );
        }
        return <span className="text-gray-400">空数组</span>;

      case 'boolean':
        return (
          <span
            className={`px-2 py-0.5 text-xs rounded font-medium ${
              field.value
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            {field.value ? '是' : '否'}
          </span>
        );

      default:
        return <span className="text-gray-900">{field.value}</span>;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="text-primary-600">{icon}</div>}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>

      {/* Fields Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {fields.map((field, index) => (
            <div
              key={index}
              className={`${
                field.highlight
                  ? 'col-span-1 md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg'
                  : ''
              }`}
            >
              <div className="flex flex-col gap-1">
                <label
                  className={`text-sm font-medium ${
                    field.highlight ? 'text-blue-900' : 'text-gray-600'
                  }`}
                >
                  {field.label}
                </label>
                <div className={field.highlight ? 'text-base' : 'text-sm'}>
                  {formatValue(field)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
