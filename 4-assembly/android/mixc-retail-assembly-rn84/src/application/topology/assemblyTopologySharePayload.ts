import type {AssemblyTopologyBindingState} from './assemblyTopologyBinding'

export interface AssemblyTopologySharePayload {
    formatVersion: '2026.04' | string
    deviceId: string
    masterNodeId: string
    wsUrl?: string
    httpBaseUrl?: string
}

export interface AssemblyTopologyMasterLocator {
    masterNodeId?: string
    masterDeviceId?: string
    addedAt: number
    serverAddress: Array<{address: string}>
    httpBaseUrl?: string
}

const parseWsUrl = (wsUrl: string): {protocol: string; host: string; pathname: string} => {
    const match = wsUrl.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(\/[^?#]*)?/i)
    if (!match) {
        throw new Error(`Topology wsUrl is invalid: ${wsUrl}`)
    }
    const [, protocol, host, pathname] = match
    if (!host) {
        throw new Error(`Topology wsUrl host is empty: ${wsUrl}`)
    }
    return {
        protocol,
        host,
        pathname: pathname || '/ws',
    }
}

const normalizeHttpBaseUrlFromWsUrl = (wsUrl: string): string => {
    const parsed = parseWsUrl(wsUrl)
    const protocol = parsed.protocol.toLowerCase() === 'wss' ? 'https' : 'http'
    if (parsed.pathname.endsWith('/ws')) {
        return `${protocol}://${parsed.host}${parsed.pathname.slice(0, -3)}`
    }
    return `${protocol}://${parsed.host}`
}

const normalizeWsUrlFromHttpBaseUrl = (httpBaseUrl: string): string => {
    const trimmed = httpBaseUrl.replace(/\/+$/, '')
    return trimmed.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws'
}

export const importAssemblyTopologySharePayload = (
    payload: AssemblyTopologySharePayload,
): {
    masterLocator: AssemblyTopologyMasterLocator
    bindingSeed: Omit<AssemblyTopologyBindingState, 'localNodeId'>
} => {
    if (!payload.deviceId) {
        throw new Error('Topology share payload deviceId is required')
    }
    if (!payload.masterNodeId) {
        throw new Error('Topology share payload masterNodeId is required')
    }
    if (!payload.wsUrl && !payload.httpBaseUrl) {
        throw new Error('Topology share payload requires wsUrl or httpBaseUrl')
    }

    const httpBaseUrl = payload.httpBaseUrl ?? normalizeHttpBaseUrlFromWsUrl(String(payload.wsUrl))
    const wsUrl = payload.wsUrl ?? normalizeWsUrlFromHttpBaseUrl(httpBaseUrl)

    return {
        masterLocator: {
            masterDeviceId: payload.deviceId,
            addedAt: Date.now() as any,
            serverAddress: [{address: wsUrl}],
            masterNodeId: payload.masterNodeId,
            httpBaseUrl,
        },
        bindingSeed: {
            role: 'slave',
            masterNodeId: payload.masterNodeId,
            masterDeviceId: payload.deviceId,
            wsUrl,
            httpBaseUrl,
        },
    }
}
