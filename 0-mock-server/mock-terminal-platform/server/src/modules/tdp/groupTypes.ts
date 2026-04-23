export interface SelectorDslV1 {
  match?: Partial<{
    platformId: string[]
    projectId: string[]
    tenantId: string[]
    brandId: string[]
    storeId: string[]
    profileId: string[]
    templateId: string[]
    assemblyAppId: string[]
    runtimeVersion: string[]
    assemblyVersion: string[]
    bundleVersion: string[]
    protocolVersion: string[]
    devicePlatform: string[]
    deviceModel: string[]
    deviceOsVersion: string[]
    capabilitiesAll: string[]
  }>
}

export interface TerminalRuntimeFacts {
  terminalId: string
  sandboxId: string
  platformId: string
  projectId: string
  tenantId: string
  brandId: string
  storeId: string
  profileId: string
  templateId: string
  assemblyAppId?: string
  runtimeVersion?: string
  assemblyVersion?: string
  bundleVersion?: string
  protocolVersion?: string
  devicePlatform?: string
  deviceModel?: string
  deviceOsVersion?: string
  capabilities: string[]
}

export interface SelectorMatchResult {
  matched: boolean
  matchedBy: Record<string, string>
}

export interface SelectorExplainItem {
  field: string
  operator: 'in' | 'containsAll'
  expected: string[]
  actual: string[]
  matched: boolean
}

export interface SelectorExplainResult {
  matched: boolean
  summary: string
  items: SelectorExplainItem[]
}
