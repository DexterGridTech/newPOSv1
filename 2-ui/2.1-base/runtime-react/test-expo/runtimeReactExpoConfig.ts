export interface RuntimeReactExpoConfig {
    displayIndex: number
    displayCount: number
    deviceId: string
    enableDualTopologyPreview: boolean
    topologyMode: 'none' | 'preview' | 'host'
    topologyRole: 'master' | 'slave'
    topologyHostBaseUrl?: string
    topologyWsUrl?: string
    topologyMasterNodeId?: string
    topologyMasterDeviceId?: string
    topologyProfileName?: string
    topologyNodeId?: string
}

const parseNumber = (value: string | null | undefined, fallback: number): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export const getRuntimeReactExpoConfig = (): RuntimeReactExpoConfig => {
    const globalValue = globalThis as typeof globalThis & {
        location?: {
            search?: string
        }
        __RUNTIME_REACT_EXPO_CONFIG__?: Partial<RuntimeReactExpoConfig>
    }
    const params = typeof globalValue.location?.search === 'string'
        ? new URLSearchParams(globalValue.location.search)
        : undefined
    const injected = globalValue.__RUNTIME_REACT_EXPO_CONFIG__ ?? {}

    const displayIndex = parseNumber(
        params?.get('displayIndex') ?? injected.displayIndex?.toString(),
        0,
    )
    const displayCount = parseNumber(
        params?.get('displayCount') ?? injected.displayCount?.toString(),
        displayIndex > 0 ? 2 : 1,
    )
    const deviceId = params?.get('deviceId')
        ?? injected.deviceId
        ?? `runtime-react-expo-${displayIndex}`
    const topologyValue = (params?.get('topology')
        ?? (injected.enableDualTopologyPreview ? 'dual' : undefined)
        ?? 'none')
        .toLowerCase()
    const topologyMode: RuntimeReactExpoConfig['topologyMode'] = topologyValue === 'host'
        ? 'host'
        : topologyValue === 'dual'
            ? 'preview'
            : 'none'
    const topologyRole = ((params?.get('topologyRole')
        ?? injected.topologyRole
        ?? (displayIndex === 0 ? 'master' : 'slave'))
        .toLowerCase() === 'slave'
            ? 'slave'
            : 'master') as RuntimeReactExpoConfig['topologyRole']
    const topologyHostBaseUrl = params?.get('topologyHostBaseUrl')
        ?? injected.topologyHostBaseUrl
        ?? undefined
    const topologyWsUrl = params?.get('topologyWsUrl')
        ?? injected.topologyWsUrl
        ?? undefined
    const topologyMasterNodeId = params?.get('topologyMasterNodeId')
        ?? injected.topologyMasterNodeId
        ?? undefined
    const topologyMasterDeviceId = params?.get('topologyMasterDeviceId')
        ?? injected.topologyMasterDeviceId
        ?? undefined
    const topologyProfileName = params?.get('topologyProfileName')
        ?? injected.topologyProfileName
        ?? 'runtime-react.expo.topology-host'
    const topologyNodeId = params?.get('topologyNodeId')
        ?? injected.topologyNodeId
        ?? undefined
    const enableDualTopologyPreview = topologyMode === 'preview'

    return {
        displayIndex,
        displayCount,
        deviceId,
        enableDualTopologyPreview,
        topologyMode,
        topologyRole,
        topologyHostBaseUrl,
        topologyWsUrl,
        topologyMasterNodeId,
        topologyMasterDeviceId,
        topologyProfileName,
        topologyNodeId,
    }
}
