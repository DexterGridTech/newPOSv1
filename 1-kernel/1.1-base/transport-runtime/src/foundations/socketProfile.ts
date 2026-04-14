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
    const url = new URL(joinedUrl)
    return appendQueryToUrl(url, query).toString()
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
