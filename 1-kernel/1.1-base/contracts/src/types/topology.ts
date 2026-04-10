import type {SessionId, TimestampMs, NodeId} from './ids'
import type {CompatibilityDecision} from './compatibility'

export interface NodeRuntimeInfo {
    nodeId: NodeId
    deviceId: string
    role: 'master' | 'slave'
    platform: string
    product: string
    assemblyAppId: string
    assemblyVersion: string
    buildNumber: number
    bundleVersion: string
    runtimeVersion: string
    protocolVersion: string
    capabilities: string[]
}

export interface PairingTicket {
    token: string
    masterNodeId: NodeId
    transportUrls: string[]
    issuedAt: TimestampMs
    expiresAt: TimestampMs
    hostRuntime: NodeRuntimeInfo
}

export interface NodeHello {
    helloId: string
    ticketToken: string
    runtime: NodeRuntimeInfo
    sentAt: TimestampMs
}

export interface NodeHelloAck {
    helloId: string
    accepted: boolean
    sessionId?: SessionId
    peerRuntime?: NodeRuntimeInfo
    compatibility: CompatibilityDecision
    rejectionCode?:
        | 'TOKEN_INVALID'
        | 'TOKEN_EXPIRED'
        | 'ROLE_CONFLICT'
        | 'PROTOCOL_INCOMPATIBLE'
        | 'CAPABILITY_MISSING'
        | 'PAIR_OCCUPIED'
    rejectionMessage?: string
    hostTime: TimestampMs
}
