import { useState } from 'react';

interface JsonTooltipProps {
  data: any;
  maxPreviewLength?: number;
}

/**
 * JSON浮窗组件
 * 列表中显示缩略,hover显示完整格式化JSON
 */
export function JsonTooltip({ data, maxPreviewLength = 30 }: JsonTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!data || data === null) {
    return <span className="text-gray-400">-</span>;
  }

  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const preview = jsonStr.length > maxPreviewLength
    ? jsonStr.slice(0, maxPreviewLength) + '...'
    : jsonStr;

  const formatted = typeof data === 'string'
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          return data;
        }
      })()
    : JSON.stringify(data, null, 2);

  return (
    <div className="relative inline-block">
      <span
        className="font-mono text-xs text-gray-600 cursor-help border-b border-dotted border-gray-400"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {preview} ⓘ
      </span>

      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 p-3 bg-gray-900 text-white text-xs font-mono rounded shadow-lg max-w-md whitespace-pre-wrap break-words">
          {formatted}
        </div>
      )}
    </div>
  );
}
