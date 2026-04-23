import type {TopologyV3MasterLocator} from '../types/runtime'

export const TOPOLOGY_V3_SHARE_FORMAT_VERSION = '2026.04' as const

export interface TopologyV3SharePayload {
    formatVersion: string
    deviceId: string
    masterNodeId: string
    exportedAt?: number
    serverAddress?: readonly {
        address: string
    }[]
    wsUrl?: string
    httpBaseUrl?: string
}

export interface TopologyV3SocketServerDefinition {
    baseUrl: string
    pathTemplate: string
}

const TOPOLOGY_DEFAULT_SOCKET_PATH = '/ws'

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined

const readString = (
    record: Record<string, unknown>,
    key: string,
): string | undefined => {
    const value = record[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

const readNumber = (
    record: Record<string, unknown>,
    key: string,
): number | undefined => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const readServerAddress = (
    record: Record<string, unknown>,
    key: string,
): readonly {address: string}[] | undefined => {
    const value = record[key]
    if (
        Array.isArray(value)
        && value.every(item => item && typeof item === 'object' && typeof (item as {address?: unknown}).address === 'string')
    ) {
        return value as readonly {address: string}[]
    }
    return undefined
}

const parseWsUrl = (wsUrl: string): {
    protocol: string
    host: string
    pathname: string
} => {
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
        pathname: pathname || TOPOLOGY_DEFAULT_SOCKET_PATH,
    }
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const normalizeTopologyV3HttpBaseUrlFromWsUrl = (
    wsUrl: string,
): string => {
    const parsed = parseWsUrl(wsUrl)
    const protocol = parsed.protocol.toLowerCase() === 'wss' ? 'https' : 'http'
    if (parsed.pathname.endsWith(TOPOLOGY_DEFAULT_SOCKET_PATH)) {
        return `${protocol}://${parsed.host}${parsed.pathname.slice(0, -TOPOLOGY_DEFAULT_SOCKET_PATH.length)}`
    }
    return `${protocol}://${parsed.host}`
}

export const normalizeTopologyV3WsUrlFromHttpBaseUrl = (
    httpBaseUrl: string,
): string => trimTrailingSlash(httpBaseUrl)
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:') + TOPOLOGY_DEFAULT_SOCKET_PATH

export const resolveTopologyV3SocketServerFromUrls = (
    input: {
        wsUrl?: string
        httpBaseUrl?: string
    },
): TopologyV3SocketServerDefinition | undefined => {
    if (input.wsUrl) {
        const parsed = parseWsUrl(input.wsUrl)
        const baseProtocol = parsed.protocol.toLowerCase() === 'wss' ? 'https' : 'http'
        const baseUrl = `${baseProtocol}://${parsed.host}`
        if (parsed.pathname === TOPOLOGY_DEFAULT_SOCKET_PATH) {
            return {
                baseUrl,
                pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
            }
        }
        if (parsed.pathname.endsWith(TOPOLOGY_DEFAULT_SOCKET_PATH)) {
            return {
                baseUrl: `${baseUrl}${parsed.pathname.slice(0, -TOPOLOGY_DEFAULT_SOCKET_PATH.length)}`,
                pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
            }
        }
        return {
            baseUrl,
            pathTemplate: parsed.pathname,
        }
    }
    if (input.httpBaseUrl) {
        return {
            baseUrl: trimTrailingSlash(input.httpBaseUrl),
            pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
        }
    }
    return undefined
}

export const parseTopologyV3SharePayload = (
    value: unknown,
): TopologyV3SharePayload => {
    const parsed = typeof value === 'string'
        ? JSON.parse(value) as unknown
        : value
    const record = toRecord(parsed)
    if (!record) {
        throw new Error('Topology share payload is not a valid JSON object')
    }
    const payload = {
        formatVersion: readString(record, 'formatVersion')
            ?? readString(record, 'FORMATVERSION')
            ?? readString(record, 'v'),
        deviceId: readString(record, 'deviceId')
            ?? readString(record, 'DEVICEID')
            ?? readString(record, 'd'),
        masterNodeId: readString(record, 'masterNodeId')
            ?? readString(record, 'MASTERNODEID')
            ?? readString(record, 'n'),
        exportedAt: readNumber(record, 'exportedAt')
            ?? readNumber(record, 'EXPORTEDAT')
            ?? readNumber(record, 't'),
        wsUrl: readString(record, 'wsUrl')
            ?? readString(record, 'WSURL')
            ?? readString(record, 'w'),
        httpBaseUrl: readString(record, 'httpBaseUrl')
            ?? readString(record, 'HTTPBASEURL')
            ?? readString(record, 'h'),
        serverAddress: readServerAddress(record, 'serverAddress')
            ?? readServerAddress(record, 'SERVERADDRESS')
            ?? readServerAddress(record, 's'),
    } satisfies Partial<TopologyV3SharePayload>

    if (
        payload.formatVersion !== TOPOLOGY_V3_SHARE_FORMAT_VERSION
        || typeof payload.deviceId !== 'string'
        || typeof payload.masterNodeId !== 'string'
        || (!payload.wsUrl && !payload.httpBaseUrl)
    ) {
        throw new Error('Topology share payload is incomplete')
    }

    return {
        formatVersion: payload.formatVersion,
        deviceId: payload.deviceId,
        masterNodeId: payload.masterNodeId,
        exportedAt: payload.exportedAt,
        serverAddress: payload.serverAddress,
        wsUrl: payload.wsUrl,
        httpBaseUrl: payload.httpBaseUrl,
    }
}

export const normalizeTopologyV3SharePayload = (
    payload: TopologyV3SharePayload,
): TopologyV3SharePayload => {
    const wsUrl = payload.wsUrl ?? payload.serverAddress?.find(item => item.address)?.address
    const httpBaseUrl = payload.httpBaseUrl ?? (wsUrl ? normalizeTopologyV3HttpBaseUrlFromWsUrl(wsUrl) : undefined)
    const normalizedWsUrl = wsUrl ?? (httpBaseUrl ? normalizeTopologyV3WsUrlFromHttpBaseUrl(httpBaseUrl) : undefined)

    if (!normalizedWsUrl && !httpBaseUrl) {
        throw new Error('Topology share payload requires wsUrl or httpBaseUrl')
    }

    return {
        formatVersion: payload.formatVersion,
        deviceId: payload.deviceId,
        masterNodeId: payload.masterNodeId,
        exportedAt: payload.exportedAt,
        serverAddress: normalizedWsUrl ? [{address: normalizedWsUrl}] : [],
        wsUrl: normalizedWsUrl,
        httpBaseUrl,
    }
}

export const createTopologyV3SharePayload = (
    input: {
        deviceId: string
        masterNodeId: string
        wsUrl?: string
        httpBaseUrl?: string
        exportedAt?: number
    },
): TopologyV3SharePayload => normalizeTopologyV3SharePayload({
    formatVersion: TOPOLOGY_V3_SHARE_FORMAT_VERSION,
    deviceId: input.deviceId,
    masterNodeId: input.masterNodeId,
    exportedAt: input.exportedAt ?? Date.now(),
    wsUrl: input.wsUrl,
    httpBaseUrl: input.httpBaseUrl,
})

export const createTopologyV3CompactSharePayload = (
    payload: TopologyV3SharePayload,
): Record<string, string> => {
    const normalized = normalizeTopologyV3SharePayload(payload)
    return {
        v: normalized.formatVersion,
        d: normalized.deviceId,
        n: normalized.masterNodeId,
        ...(normalized.wsUrl ? {w: normalized.wsUrl} : {}),
        ...(!normalized.wsUrl && normalized.httpBaseUrl ? {h: normalized.httpBaseUrl} : {}),
    }
}

export const createTopologyV3MasterLocatorFromSharePayload = (
    payload: TopologyV3SharePayload,
    addedAt: number = Date.now(),
): TopologyV3MasterLocator => {
    const normalized = normalizeTopologyV3SharePayload(payload)
    return {
        masterDeviceId: normalized.deviceId,
        masterNodeId: normalized.masterNodeId,
        serverAddress: normalized.serverAddress ? [...normalized.serverAddress] : [],
        httpBaseUrl: normalized.httpBaseUrl,
        addedAt,
    }
}

export const resolveTopologyV3SocketServerFromMasterLocator = (
    masterLocator: TopologyV3MasterLocator | null | undefined,
): TopologyV3SocketServerDefinition | undefined => resolveTopologyV3SocketServerFromUrls({
    wsUrl: masterLocator?.serverAddress?.[0]?.address,
    httpBaseUrl: masterLocator?.httpBaseUrl,
})
