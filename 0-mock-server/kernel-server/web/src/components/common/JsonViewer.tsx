import { useState } from 'react';

interface JsonViewerProps {
  data: any;
  defaultExpanded?: boolean;
}

/**
 * JSON查看器组件
 * 支持展开/折叠功能
 */
export function JsonViewer({ data, defaultExpanded = false }: JsonViewerProps) {
  return (
    <div className="font-mono text-sm">
      <JsonNode data={data} level={0} defaultExpanded={defaultExpanded} />
    </div>
  );
}

interface JsonNodeProps {
  data: any;
  level: number;
  defaultExpanded: boolean;
  name?: string;
}

function JsonNode({ data, level, defaultExpanded, name }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const indent = level * 20;

  if (data === null) {
    return (
      <div style={{ marginLeft: `${indent}px` }} className="text-gray-500">
        {name && <span className="text-blue-600">{name}: </span>}
        <span>null</span>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div style={{ marginLeft: `${indent}px` }} className="text-gray-500">
        {name && <span className="text-blue-600">{name}: </span>}
        <span>undefined</span>
      </div>
    );
  }

  const dataType = typeof data;

  // 基本类型
  if (dataType === 'string') {
    return (
      <div style={{ marginLeft: `${indent}px` }}>
        {name && <span className="text-blue-600">{name}: </span>}
        <span className="text-green-600">"{data}"</span>
      </div>
    );
  }

  if (dataType === 'number') {
    return (
      <div style={{ marginLeft: `${indent}px` }}>
        {name && <span className="text-blue-600">{name}: </span>}
        <span className="text-purple-600">{data}</span>
      </div>
    );
  }

  if (dataType === 'boolean') {
    return (
      <div style={{ marginLeft: `${indent}px` }}>
        {name && <span className="text-blue-600">{name}: </span>}
        <span className="text-orange-600">{data.toString()}</span>
      </div>
    );
  }

  // 数组
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ marginLeft: `${indent}px` }}>
          {name && <span className="text-blue-600">{name}: </span>}
          <span className="text-gray-600">[]</span>
        </div>
      );
    }

    return (
      <div style={{ marginLeft: `${indent}px` }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-gray-200 rounded px-1"
          >
            <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
          </button>
          {name && <span className="text-blue-600">{name}: </span>}
          <span className="text-gray-600">
            [{data.length} {data.length === 1 ? 'item' : 'items'}]
          </span>
        </div>
        {isExpanded && (
          <div>
            {data.map((item, index) => (
              <JsonNode
                key={index}
                data={item}
                level={level + 1}
                defaultExpanded={false}
                name={`[${index}]`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 对象
  if (dataType === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return (
        <div style={{ marginLeft: `${indent}px` }}>
          {name && <span className="text-blue-600">{name}: </span>}
          <span className="text-gray-600">{'{}'}</span>
        </div>
      );
    }

    return (
      <div style={{ marginLeft: `${indent}px` }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-gray-200 rounded px-1"
          >
            <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
          </button>
          {name && <span className="text-blue-600">{name}: </span>}
          <span className="text-gray-600">
            {'{'}{keys.length} {keys.length === 1 ? 'key' : 'keys'}{'}'}
          </span>
        </div>
        {isExpanded && (
          <div>
            {keys.map((key) => (
              <JsonNode
                key={key}
                data={data[key]}
                level={level + 1}
                defaultExpanded={false}
                name={key}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginLeft: `${indent}px` }}>
      {name && <span className="text-blue-600">{name}: </span>}
      <span className="text-gray-500">{String(data)}</span>
    </div>
  );
}
