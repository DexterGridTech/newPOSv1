const TOPOLOGY_DEFAULT_SOCKET_PATH = '/ws'

export interface AssemblyTopologyBindingState {
    role: 'master' | 'slave'
    localNodeId: string
    masterNodeId?: string
    masterDeviceId?: string
    wsUrl?: string
    httpBaseUrl?: string
}

export interface AssemblyTopologyResolvedServer {
    baseUrl: string
    pathTemplate: string
}

export interface AssemblyTopologyBindingSource {
    get(): AssemblyTopologyBindingState
    set(next: Partial<AssemblyTopologyBindingState>): void
    clear(): void
    resolveServer(): AssemblyTopologyResolvedServer | undefined
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

const normalizeWsBaseUrl = (protocol: string, host: string): string => {
    switch (protocol.toLowerCase()) {
        case 'ws':
            return `http://${host}`
        case 'wss':
            return `https://${host}`
        default:
            throw new Error(`Topology wsUrl protocol is unsupported: ${protocol}`)
    }
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const resolveServerFromHttpBaseUrl = (httpBaseUrl: string): AssemblyTopologyResolvedServer => ({
    baseUrl: trimTrailingSlash(httpBaseUrl),
    pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
})

const resolveServerFromWsUrl = (wsUrl: string): AssemblyTopologyResolvedServer => {
    const parsed = parseWsUrl(wsUrl)
    const baseUrl = normalizeWsBaseUrl(parsed.protocol, parsed.host)
    if (parsed.pathname === TOPOLOGY_DEFAULT_SOCKET_PATH) {
        return {
            baseUrl,
            pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
        }
    }
    if (parsed.pathname.endsWith(TOPOLOGY_DEFAULT_SOCKET_PATH)) {
        const prefix = parsed.pathname.slice(0, -TOPOLOGY_DEFAULT_SOCKET_PATH.length)
        return {
            baseUrl: `${baseUrl}${prefix}`,
            pathTemplate: TOPOLOGY_DEFAULT_SOCKET_PATH,
        }
    }
    return {
        baseUrl,
        pathTemplate: parsed.pathname,
    }
}

export const createAssemblyTopologyBindingSource = (
    initial: AssemblyTopologyBindingState,
): AssemblyTopologyBindingSource => {
    let current = {...initial}

    return {
        get() {
            return {...current}
        },
        set(next) {
            current = {
                ...current,
                ...next,
            }
        },
        clear() {
            current = {
                role: current.role,
                localNodeId: current.localNodeId,
            }
        },
        resolveServer() {
            if (current.wsUrl) {
                return resolveServerFromWsUrl(current.wsUrl)
            }
            if (current.httpBaseUrl) {
                return resolveServerFromHttpBaseUrl(current.httpBaseUrl)
            }
            return undefined
        },
    }
}
