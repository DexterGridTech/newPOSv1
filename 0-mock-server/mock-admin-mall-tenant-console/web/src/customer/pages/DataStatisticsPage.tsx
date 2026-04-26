import {useMemo} from 'react'
import {PageHeader} from '../components/common'
import type {CollectionState, OutboxItem, PageKey} from '../types'
import type {DistributionPanel, RiskItem, StatisticHealth, StatisticKpi} from './statisticsModel'
import {buildStatistics} from './statisticsModel'

export function DataStatisticsPage(props: {
  collections: CollectionState
  outbox: OutboxItem[]
  selectedPlatformId: string
  selectPage: (page: PageKey) => void
}) {
  const statistics = useMemo(
    () => buildStatistics(props.collections, props.outbox, props.selectedPlatformId),
    [props.collections, props.outbox, props.selectedPlatformId],
  )

  return (
    <section className="customer-v3-statistics">
      <PageHeader title="数据统计" scope="按顶部沙箱与平台汇总主数据规模、业务覆盖和投影风险" />

      <div className="customer-v3-stat-kpis">
        {statistics.kpis.map(item => <KpiCard key={item.label} item={item} />)}
      </div>

      <div className="customer-v3-stat-layout">
        <section className="customer-v3-stat-panel customer-v3-stat-panel-strong">
          <PanelTitle title="主数据健康度" subtitle="优先看合同、菜单、库存和投影是否能支撑终端准确运行" />
          <div className="customer-v3-health-list">
            {statistics.health.map(item => <HealthRow key={item.label} item={item} />)}
          </div>
        </section>

        <section className="customer-v3-stat-panel">
          <PanelTitle title="风险关注" subtitle="需要业务或运维优先处理的异常" />
          <div className="customer-v3-risk-list">
            {statistics.risks.length === 0 ? (
              <div className="customer-v3-risk-empty">当前平台没有高优先级异常。</div>
            ) : statistics.risks.map((item, index) => (
              <RiskRow key={`${item.title}-${index}`} item={item} onOpen={() => props.selectPage(item.page)} />
            ))}
          </div>
        </section>
      </div>

      <div className="customer-v3-stat-distributions">
        {statistics.distributions.map(panel => <DistributionCard key={panel.title} panel={panel} />)}
      </div>

      <div className="customer-v3-stat-layout">
        <section className="customer-v3-stat-panel">
          <PanelTitle title="项目经营视图" subtitle="项目列表最关心门店数、营业门店、合同覆盖和租户品牌复杂度" />
          <div className="customer-v3-stat-table-wrap">
            <table className="customer-v3-stat-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>大区</th>
                  <th>业态</th>
                  <th>门店</th>
                  <th>营业中</th>
                  <th>合同覆盖</th>
                  <th>租户品牌</th>
                </tr>
              </thead>
              <tbody>
                {statistics.projectSnapshots.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong></td>
                    <td>{item.region}</td>
                    <td>{item.businessMode}</td>
                    <td>{item.stores}</td>
                    <td>{item.operatingStores}</td>
                    <td>{item.contractCoverage}%</td>
                    <td>{item.tenantBrands}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="customer-v3-stat-panel">
          <PanelTitle title="品牌菜单视图" subtitle="品牌、商品和菜单是否足够完整，决定门店菜单能否顺利下发" />
          <div className="customer-v3-stat-table-wrap">
            <table className="customer-v3-stat-table">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>品类</th>
                  <th>门店</th>
                  <th>商品</th>
                  <th>品牌菜单</th>
                  <th>菜单商品</th>
                  <th>标准菜单</th>
                </tr>
              </thead>
              <tbody>
                {statistics.brandSnapshots.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong></td>
                    <td>{item.category}</td>
                    <td>{item.stores}</td>
                    <td>{item.products}</td>
                    <td>{item.brandMenus}</td>
                    <td>{item.menuProducts}</td>
                    <td>{item.standardMenuEnabled ? '已启用' : '未启用'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="customer-v3-stat-layout compact">
        <section className="customer-v3-stat-panel">
          <PanelTitle title="权限与账号" subtitle="角色、权限和授权记录是否支撑门店实际运营" />
          <div className="customer-v3-stat-mini-grid">
            {statistics.iam.map(item => <KpiCard key={item.label} item={item} compact />)}
          </div>
        </section>
        <section className="customer-v3-stat-panel">
          <PanelTitle title="经营资料" subtitle="桌台、工作站、可售状态和异常菜单的基础规模" />
          <div className="customer-v3-stat-mini-grid">
            {statistics.commercial.map(item => <KpiCard key={item.label} item={item} compact />)}
          </div>
        </section>
      </div>
    </section>
  )
}

function KpiCard({item, compact = false}: {item: StatisticKpi; compact?: boolean}) {
  return (
    <article className={`customer-v3-stat-kpi ${item.tone ?? 'neutral'} ${compact ? 'compact' : ''}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <p>{item.helper}</p>
    </article>
  )
}

function HealthRow({item}: {item: StatisticHealth}) {
  return (
    <article className={`customer-v3-health-row ${item.tone}`}>
      <div>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </div>
      <b>{item.value}</b>
      <div className="customer-v3-health-track" aria-hidden="true">
        <i style={{width: `${Math.min(100, Math.max(0, item.ratio))}%`}} />
      </div>
    </article>
  )
}

function DistributionCard({panel}: {panel: DistributionPanel}) {
  return (
    <section className="customer-v3-stat-panel">
      <PanelTitle title={panel.title} subtitle={panel.subtitle} />
      <div className="customer-v3-distribution-list">
        {panel.buckets.length === 0 ? <div className="customer-v3-risk-empty">暂无数据</div> : panel.buckets.map(bucket => (
          <div key={bucket.label} className="customer-v3-distribution-row">
            <div>
              <strong>{bucket.label}</strong>
              <span>{bucket.count} 条</span>
            </div>
            <div className="customer-v3-distribution-track" aria-hidden="true">
              <i style={{width: `${Math.max(4, bucket.ratio)}%`}} />
            </div>
            <b>{bucket.ratio}%</b>
          </div>
        ))}
      </div>
    </section>
  )
}

function RiskRow({item, onOpen}: {item: RiskItem; onOpen: () => void}) {
  return (
    <article className="customer-v3-risk-row">
      <span className={`customer-v3-risk-level level-${item.level}`}>{item.level}</span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
      </div>
      <button type="button" onClick={onOpen}>查看</button>
    </article>
  )
}

function PanelTitle({title, subtitle}: {title: string; subtitle: string}) {
  return (
    <header className="customer-v3-stat-panel-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  )
}
