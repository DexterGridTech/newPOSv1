import { useState } from 'react';

export interface TreeNode {
  id: string;
  name: string;
  type?: string;
  children?: TreeNode[];
  data?: any;
  online?: boolean;
}

interface TreeViewProps {
  data: TreeNode[];
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  renderNode?: (node: TreeNode) => React.ReactNode;
}

/**
 * 树形组件
 */
export function TreeView({ data, selectedId, onSelect, renderNode }: TreeViewProps) {
  return (
    <div className="space-y-1">
      {data.map((node) => (
        <TreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedId}
          onSelect={onSelect}
          renderNode={renderNode}
        />
      ))}
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  renderNode?: (node: TreeNode) => React.ReactNode;
}

function TreeNodeComponent({
  node,
  level,
  selectedId,
  onSelect,
  renderNode,
}: TreeNodeComponentProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-3 rounded cursor-pointer ${
          selectedId === node.id
            ? 'bg-blue-50 text-blue-600'
            : 'hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${level * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mr-1 p-0.5 hover:bg-gray-200 rounded"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-5" />}

        {renderNode ? renderNode(node) : (
          <div className="flex-1 flex items-center gap-2">
            {node.type === 'device' && node.online !== undefined && (
              <span className={`inline-block w-2 h-2 rounded-full ${node.online ? 'bg-green-500' : 'bg-red-500'}`} title={node.online ? '在线' : '离线'} />
            )}
            <div className="flex-1">
              <div className="font-medium">{node.name}</div>
              {node.type && (
                <div className="text-xs text-gray-500">类型: {node.type}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              renderNode={renderNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
