import {DOMAINS} from './config'
import type {Overview} from './types'

export const formatTime = (value?: number) => value
  ? new Date(value).toLocaleString('zh-CN', {hour12: false})
  : '--'

export const buildMetricSummary = (overview: Overview | null) => {
  const counts = new Map<string, number>()
  overview?.alignedEntities.forEach(item => {
    counts.set(item.domain, (counts.get(item.domain) ?? 0) + item.count)
  })

  return DOMAINS.map(domain => ({
    key: domain.key,
    label: domain.label,
    count: (() => {
      switch (domain.key) {
        case 'environment':
          return (overview?.legacyDocuments.length ?? 0) + (overview?.outbox.length ?? 0)
        case 'organization':
        case 'facilities':
          return counts.get('organization') ?? 0
        case 'iam':
          return counts.get('iam') ?? 0
        case 'products':
        case 'menus':
          return counts.get('catering-product') ?? 0
        case 'operations':
          return counts.get('catering-store-operating') ?? 0
        case 'projection':
          return overview?.outbox.reduce((sum, item) => sum + item.count, 0) ?? 0
        default:
          return 0
      }
    })(),
  }))
}
