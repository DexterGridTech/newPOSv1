import type {ChangeEvent, CSSProperties, ReactNode, SelectHTMLAttributes} from 'react'
import type {EntityItem, OrgTreeNode} from './types'

const formatJsonValue = (value: unknown) => {
  if (typeof value === 'undefined') {
    return 'undefined'
  }

  return JSON.stringify(value, null, 2)
}

const resolveStatusClass = (status: string) => {
  const normalizedStatus = status.toLowerCase()

  if (['active', 'allowed', 'approved', 'available', 'open', 'published'].includes(normalizedStatus)) {
    return 'published'
  }

  if (['pending', 'queued', 'reserved', 'suspended'].includes(normalizedStatus)) {
    return 'pending'
  }

  if (['closed', 'denied', 'failed', 'inactive', 'rejected', 'terminated'].includes(normalizedStatus)) {
    return 'failed'
  }

  return 'neutral'
}

export const JsonPanel = ({value}: {value: unknown}) => (
  <pre className="json-panel">{formatJsonValue(value)}</pre>
)

type TextFieldProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
}

export const TextField = ({label, name, value, onChange}: TextFieldProps) => (
  <label>
    <span>{label}</span>
    <input
      name={name}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
    />
  </label>
)

type SelectFieldProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'value' | 'onChange' | 'children'>

export const SelectField = ({label, name, value, onChange, children, ...rest}: SelectFieldProps) => (
  <label>
    <span>{label}</span>
    <select
      {...rest}
      name={name}
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      {children}
    </select>
  </label>
)

type ResourceCardProps = {
  title: string
  count: number
  description?: string
  items: EntityItem[]
}

const getResourceCardItemKey = (title: string, item: EntityItem, index: number) => [
  title,
  item.aggregateId,
  item.entityId,
  item.title,
  item.status,
  String(index),
].join(':')

export const ResourceCard = ({title, count, description, items}: ResourceCardProps) => (
  <article className="panel resource-card-panel">
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {description ? <p className="panel-subtitle">{description}</p> : null}
      </div>
      <span>{count}</span>
    </div>
    <div className="document-list">
      {items.map((item, index) => (
        <div
          key={getResourceCardItemKey(title, item, index)}
          className="resource-card-row"
          title={`${item.title} · ${item.entityId}`}
        >
          <div>
            <strong>{item.title}</strong>
            <span>{item.entityId}</span>
          </div>
          <span className={`pill ${resolveStatusClass(item.status)}`}>{item.status}</span>
        </div>
      ))}
      {items.length === 0 ? <p className="empty">当前分域还没有记录。</p> : null}
    </div>
  </article>
)

type TreeNodeProps = {
  node: OrgTreeNode
  depth?: number
}

export const TreeNode = ({node, depth = 0}: TreeNodeProps) => (
  <div className="tree-node" style={{'--depth': String(depth)} as CSSProperties}>
    <div className="tree-row">
      <div>
        <strong>{node.title}</strong>
        <span>{node.type}</span>
      </div>
      <span className={`pill ${resolveStatusClass(node.status)}`}>{node.status}</span>
    </div>
    {Array.isArray(node.children) && node.children.length > 0 ? (
      <div className="tree-children">
        {node.children.map((child, index) => (
          <TreeNode
            key={`${node.id}:${String((child as {id?: string}).id ?? index)}`}
            node={child as OrgTreeNode}
            depth={depth + 1}
          />
        ))}
      </div>
    ) : null}
  </div>
)
