import type {AssemblyTopologyBindingState} from './assemblyTopologyBinding'

export interface AssemblyTopologySharePayload {
    formatVersion?: '2026.04' | string
    deviceId?: string
    masterNodeId?: string
    wsUrl?: string
    httpBaseUrl?: string
    v?: string
    d?: string
    n?: string
    w?: string
    h?: string
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
    const deviceId = payload.deviceId ?? payload.d
    const masterNodeId = payload.masterNodeId ?? payload.n
    const payloadWsUrl = payload.wsUrl ?? payload.w
    const payloadHttpBaseUrl = payload.httpBaseUrl ?? payload.h

    if (!deviceId) {
        throw new Error('Topology share payload deviceId is required')
    }
    if (!masterNodeId) {
        throw new Error('Topology share payload masterNodeId is required')
    }
    if (!payloadWsUrl && !payloadHttpBaseUrl) {
        throw new Error('Topology share payload requires wsUrl or httpBaseUrl')
    }

    const httpBaseUrl = payloadHttpBaseUrl ?? normalizeHttpBaseUrlFromWsUrl(String(payloadWsUrl))
    const wsUrl = payloadWsUrl ?? normalizeWsUrlFromHttpBaseUrl(httpBaseUrl)

    return {
        masterLocator: {
            masterDeviceId: deviceId,
            addedAt: Date.now() as any,
            serverAddress: [{address: wsUrl}],
            masterNodeId,
            httpBaseUrl,
        },
        bindingSeed: {
            role: 'slave',
            masterNodeId,
            masterDeviceId: deviceId,
            wsUrl,
            httpBaseUrl,
        },
    }
}
