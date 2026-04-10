import type {
    CommandId,
    NodeId,
    RequestId,
    SessionId,
} from '@impos2/kernel-base-contracts'

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

export interface ServerCatalog {
    registerServer(server: TransportServerDefinition): void
    replaceServers(servers: readonly TransportServerDefinition[]): void
    resolveServer(serverName: string): TransportServerDefinition
    resolveAddresses(serverName: string): readonly TransportServerAddress[]
    listServerNames(): readonly string[]
    clear(): void
}
