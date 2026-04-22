import type {
    CommandId,
    NodeId,
    RequestId,
    SessionId,
} from './ids'

export interface TransportRequestContext {
    readonly requestId?: RequestId
    readonly commandId?: CommandId
    readonly sessionId?: SessionId
    readonly nodeId?: NodeId
    readonly peerNodeId?: NodeId
    readonly metadata?: Record<string, unknown>
}

export interface TransportServerAddress {
    readonly addressName: string
    readonly baseUrl: string
    readonly timeoutMs?: number
    readonly metadata?: Record<string, unknown>
}

export interface TransportServerDefinition {
    readonly serverName: string
    readonly addresses: readonly TransportServerAddress[]
    readonly metadata?: Record<string, unknown>
}

export interface TransportServerConfigSpace {
    readonly name: string
    readonly servers: readonly TransportServerDefinition[]
}

export interface TransportServerConfig {
    readonly selectedSpace: string
    readonly spaces: readonly TransportServerConfigSpace[]
}

export interface TransportServerAddressOverride {
    readonly addressName?: string
    readonly baseUrl: string
    readonly timeoutMs?: number
    readonly metadata?: Record<string, unknown>
}

export interface TransportServerOverride {
    readonly addresses?: readonly TransportServerAddressOverride[]
    readonly metadata?: Record<string, unknown>
}

export interface ResolveTransportServerConfigOptions {
    readonly selectedSpace?: string
    readonly baseUrlOverrides?: Readonly<Record<string, string>>
    readonly serverOverrides?: Readonly<Record<string, TransportServerOverride>>
}
