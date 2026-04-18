import type {
    SocketConnectionProfile,
    SocketCodec,
    TypeDescriptor,
} from '../types'
import {appendQueryToUrl, compilePath} from './shared'

interface DefineSocketProfileInput<TPath, TQuery, THeaders, TIncoming, TOutgoing> {
    readonly name: string
    readonly serverName: string
    readonly pathTemplate: string
    readonly handshake?: {
        readonly path?: TypeDescriptor<TPath>
        readonly query?: TypeDescriptor<TQuery>
        readonly headers?: TypeDescriptor<THeaders>
    }
    readonly messages?: {
        readonly incoming?: TypeDescriptor<TIncoming>
        readonly outgoing?: TypeDescriptor<TOutgoing>
    }
    readonly codec: SocketCodec<TIncoming, TOutgoing>
    readonly meta?: SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>['meta']
}

const trimTrailingSlash = (value: string): string => {
    return value.endsWith('/') ? value.slice(0, -1) : value
}

const trimLeadingSlash = (value: string): string => {
    return value.startsWith('/') ? value.slice(1) : value
}

const normalizeBase = (baseUrl: string): string => {
    const normalized = baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    return normalized.endsWith('/') ? normalized : `${normalized}/`
}

const hasUrlHost = (value: string): boolean => {
    return /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i.test(value)
}

const appendQueryToSocketUrl = (
    value: string,
    query?: Record<string, unknown>,
): string => {
    if (!query) {
        return value
    }

    const entries: string[] = []
    Object.entries(query).forEach(([key, rawValue]) => {
        if (rawValue === undefined || rawValue === null) {
            return
        }

        if (Array.isArray(rawValue)) {
            rawValue.forEach(item => {
                entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
            })
            return
        }

        entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(rawValue))}`)
    })

    if (!entries.length) {
        return value
    }

    const separator = value.includes('?') ? '&' : '?'
    return `${value}${separator}${entries.join('&')}`
}

export const defineSocketProfile = <TPath, TQuery, THeaders, TIncoming, TOutgoing>(
    input: DefineSocketProfileInput<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
): SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing> => {
    return {
        protocol: 'ws',
        name: input.name,
        serverName: input.serverName,
        pathTemplate: input.pathTemplate,
        handshake: input.handshake ?? {},
        messages: input.messages ?? {},
        codec: input.codec,
        meta: input.meta ?? {},
    }
}

export const buildSocketUrl = (
    baseUrl: string,
    pathTemplate: string,
    path?: Record<string, unknown>,
    query?: Record<string, unknown>,
): string => {
    const compiledPath = compilePath(pathTemplate, path)
    const joinedUrl = `${trimTrailingSlash(normalizeBase(baseUrl))}/${trimLeadingSlash(compiledPath)}`
    if (!hasUrlHost(joinedUrl)) {
        throw new Error(`Socket url host is empty: ${joinedUrl}`)
    }
    /**
     * 不使用 `new URL(joinedUrl)` 解析 ws/wss。
     *
     * RN84 + Hermes 在 Android 上对 `new URL('ws://...')` 的 host 解析不可靠，会得到空
     * host，进而让 RN 原生 WebSocketModule 抛 `Invalid URL host: ""`。这里保持纯字符串
     * 方式拼接 query，避免把已经合法的 ws 地址交给运行时 URL polyfill 二次解析。
     */
    return appendQueryToSocketUrl(joinedUrl, query)
}

export class JsonSocketCodec<TIncoming = unknown, TOutgoing = unknown> implements SocketCodec<TIncoming, TOutgoing> {
    serialize(message: TOutgoing): string {
        return JSON.stringify(message)
    }

    deserialize(raw: string): TIncoming {
        try {
            return JSON.parse(raw) as TIncoming
        } catch (error) {
            throw error
        }
    }
}
