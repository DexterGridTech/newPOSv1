import type {CollectionState, CustomerEntity} from '../types'

export function TopContextBar(props: {
  collections: CollectionState
  selectedSandboxId: string
  selectedPlatformId: string
  setSelectedSandboxId: (value: string) => void
  setSelectedPlatformId: (value: string) => void
}) {
  return (
    <header className="customer-v3-topbar">
      <SelectPill label="沙箱" value={props.selectedSandboxId} items={props.collections.sandboxes} onChange={props.setSelectedSandboxId} />
      <SelectPill label="平台" value={props.selectedPlatformId} items={props.collections.platforms} onChange={props.setSelectedPlatformId} />
    </header>
  )
}

function SelectPill({label, value, items, onChange}: {label: string; value: string; items: CustomerEntity[]; onChange: (value: string) => void}) {
  const hasCurrentValue = items.some(item => item.entityId === value)
  const resolvedValue = hasCurrentValue ? value : items[0]?.entityId ?? ''
  return (
    <label className="customer-v3-context-select">
      <span>{label}</span>
      <select value={resolvedValue} onChange={event => onChange(event.target.value)}>
        {items.length === 0 ? <option value="">暂无可选项</option> : null}
        {items.map(item => <option key={item.entityId} value={item.entityId}>{item.title}</option>)}
      </select>
    </label>
  )
}
