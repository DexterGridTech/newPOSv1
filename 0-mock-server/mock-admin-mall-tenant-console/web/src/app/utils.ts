import {DOMAINS} from './config'
import type {Overview} from './types'

export const formatTime = (value?: number) => value
  ? new Date(value).toLocaleString('zh-CN', {hour12: false})
  : '--'

export const buildMetricSummary = (overview: Overview | null) => {
  const counts = new Map<string, number>()
  const entityCounts = new Map<string, number>()
  overview?.alignedEntities.forEach(item => {
    counts.set(item.domain, (counts.get(item.domain) ?? 0) + item.count)
    entityCounts.set(item.entity_type, (entityCounts.get(item.entity_type) ?? 0) + item.count)
  })

  const sumEntities = (...entityTypes: string[]) =>
    entityTypes.reduce((sum, entityType) => sum + (entityCounts.get(entityType) ?? 0), 0)

  return DOMAINS.map(domain => ({
    key: domain.key,
    label: domain.label,
    count: (() => {
      switch (domain.key) {
        case 'environment':
          return sumEntities('sandbox', 'platform', 'project')
        case 'organization':
          return counts.get('organization') ?? 0
        case 'facilities':
          return sumEntities('table', 'workstation')
        case 'iam':
          return counts.get('iam') ?? 0
        case 'products':
          return sumEntities('product')
        case 'menus':
          return sumEntities('brand_menu', 'menu_catalog')
        case 'operations':
          return sumEntities(
            'availability_rule',
            'menu_availability',
            'price_rule',
            'saleable_stock',
            'store_config',
          )
        case 'projection':
          return overview?.outbox.reduce((sum, item) => sum + item.count, 0) ?? 0
        default:
          return 0
      }
    })(),
  }))
}
