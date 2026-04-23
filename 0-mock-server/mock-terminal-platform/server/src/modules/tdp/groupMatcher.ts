import type {
  SelectorDslV1,
  SelectorExplainItem,
  SelectorExplainResult,
  SelectorMatchResult,
  TerminalRuntimeFacts,
} from './groupTypes.js'

const includesAny = (expected: string[] | undefined, actual: string | undefined) => {
  if (!expected || expected.length === 0) return true
  if (!actual) return false
  return expected.includes(actual)
}

export const matchTerminalAgainstSelector = (
  facts: TerminalRuntimeFacts,
  selector: SelectorDslV1,
): SelectorMatchResult => {
  const match = selector.match ?? {}
  const matchedBy: Record<string, string> = {}

  const fieldChecks: Array<[keyof NonNullable<SelectorDslV1['match']>, string | undefined]> = [
    ['platformId', facts.platformId],
    ['projectId', facts.projectId],
    ['tenantId', facts.tenantId],
    ['brandId', facts.brandId],
    ['storeId', facts.storeId],
    ['profileId', facts.profileId],
    ['templateId', facts.templateId],
    ['assemblyAppId', facts.assemblyAppId],
    ['runtimeVersion', facts.runtimeVersion],
    ['assemblyVersion', facts.assemblyVersion],
    ['bundleVersion', facts.bundleVersion],
    ['protocolVersion', facts.protocolVersion],
    ['devicePlatform', facts.devicePlatform],
    ['deviceModel', facts.deviceModel],
    ['deviceOsVersion', facts.deviceOsVersion],
  ]

  for (const [field, actual] of fieldChecks) {
    const expected = match[field]
    if (!includesAny(expected, actual)) {
      return { matched: false, matchedBy: {} }
    }
    if (expected && expected.length > 0 && actual) {
      matchedBy[field] = actual
    }
  }

  if (match.capabilitiesAll?.length) {
    const missing = match.capabilitiesAll.find(item => !facts.capabilities.includes(item))
    if (missing) {
      return { matched: false, matchedBy: {} }
    }
    matchedBy.capabilitiesAll = match.capabilitiesAll.join(',')
  }

  return { matched: true, matchedBy }
}

export const explainSelectorAgainstFacts = (
  facts: TerminalRuntimeFacts,
  selector: SelectorDslV1,
): SelectorExplainResult => {
  const match = selector.match ?? {}
  const items: SelectorExplainItem[] = []

  const fieldChecks: Array<[keyof NonNullable<SelectorDslV1['match']>, string | undefined]> = [
    ['platformId', facts.platformId],
    ['projectId', facts.projectId],
    ['tenantId', facts.tenantId],
    ['brandId', facts.brandId],
    ['storeId', facts.storeId],
    ['profileId', facts.profileId],
    ['templateId', facts.templateId],
    ['assemblyAppId', facts.assemblyAppId],
    ['runtimeVersion', facts.runtimeVersion],
    ['assemblyVersion', facts.assemblyVersion],
    ['bundleVersion', facts.bundleVersion],
    ['protocolVersion', facts.protocolVersion],
    ['devicePlatform', facts.devicePlatform],
    ['deviceModel', facts.deviceModel],
    ['deviceOsVersion', facts.deviceOsVersion],
  ]

  fieldChecks.forEach(([field, actual]) => {
    const expected = match[field]
    if (!expected || expected.length === 0) {
      return
    }
    items.push({
      field,
      operator: 'in',
      expected,
      actual: actual ? [actual] : [],
      matched: includesAny(expected, actual),
    })
  })

  if (match.capabilitiesAll?.length) {
    items.push({
      field: 'capabilitiesAll',
      operator: 'containsAll',
      expected: match.capabilitiesAll,
      actual: facts.capabilities,
      matched: match.capabilitiesAll.every(item => facts.capabilities.includes(item)),
    })
  }

  const matched = items.every(item => item.matched)
  const summary = items.length === 0
    ? '未配置 selector 条件，默认全量命中'
    : matched
      ? `命中 ${items.length} 条 selector 条件`
      : `未命中 ${items.filter(item => !item.matched).length} 条 selector 条件`

  return {
    matched,
    summary,
    items,
  }
}
