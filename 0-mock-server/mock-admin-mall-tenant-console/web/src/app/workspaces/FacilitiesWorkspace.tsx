import {JsonPanel, ResourceCard} from '../shared'
import {formatTime} from '../utils'
import type {EntityItem} from '../types'

type Props = {
  tables: EntityItem[]
  workstations: EntityItem[]
}

export function FacilitiesWorkspace({tables, workstations}: Props) {
  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>桌台与工作站</h3>
            <p className="panel-subtitle">围绕桌台状态机、工作站职责映射与未来 KDS/产线消费场景，保留独立设施工作区。</p>
          </div>
          <span>{tables.length + workstations.length}</span>
        </div>
        <div className="facts-grid">
          <div><span>桌台</span><strong>{tables.length}</strong></div>
          <div><span>工作站</span><strong>{workstations.length}</strong></div>
          <div><span>可用桌台</span><strong>{tables.filter(item => item.status === 'AVAILABLE').length}</strong></div>
          <div><span>激活工作站</span><strong>{workstations.filter(item => item.status === 'ACTIVE').length}</strong></div>
        </div>
      </article>
      <ResourceCard title="桌台列表" count={tables.length} items={tables} />
      <ResourceCard title="工作站列表" count={workstations.length} items={workstations} />
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>设施 payload 快照</h3>
            <p className="panel-subtitle">用于校验 terminal-facing 设施主数据是否保留足够结构，不把职责信息压平。</p>
          </div>
          <span>{formatTime(Date.now())}</span>
        </div>
        <JsonPanel value={{tables, workstations}} />
      </article>
    </>
  )
}
