export interface DualTopologyHostV3ServerConfig {
    port: number
    basePath: string
}

export interface DualTopologyHostV3AddressInfo {
    host: string
    port: number
    basePath: string
    httpBaseUrl: string
    wsUrl: string
}

export interface DualTopologyHostV3Stats {
    sessionCount: number
    activeFaultRuleCount: number
}

export type TopologyV3InstanceMode = 'MASTER' | 'SLAVE'
export type TopologyV3DisplayMode = 'PRIMARY' | 'SECONDARY'

export interface TopologyV3RuntimeInfo {
    nodeId: string
    deviceId: string
    instanceMode: TopologyV3InstanceMode
    displayMode: TopologyV3DisplayMode
    standalone: boolean
    protocolVersion: string
    capabilities: string[]
}

export interface TopologyV3HelloMessage {
    type: 'hello'
    helloId: string
    runtime: TopologyV3RuntimeInfo
    sentAt: number
}

export interface TopologyV3HelloAckMessage {
    type: 'hello-ack'
    helloId: string
    accepted: boolean
    sessionId?: string
    peerRuntime?: TopologyV3RuntimeInfo
    rejectionCode?: string
    rejectionMessage?: string
    hostTime: number
}

export interface TopologyV3StateSnapshotMessage {
    type: 'state-snapshot'
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
    entries: Array<{
        sliceName: string
        revision: string | number
        payload: unknown
    }>
    sentAt: number
}

export interface TopologyV3StateUpdateMessage {
    type: 'state-update'
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
    sliceName: string
    revision: string | number
    payload: unknown
    sentAt: number
}

export interface TopologyV3CommandDispatchEnvelope {
    envelopeId: string
    sessionId: string
    requestId: string
    commandId: string
    parentCommandId?: string
    ownerNodeId: string
    sourceNodeId: string
    targetNodeId: string
    commandName: string
    payload: unknown
    context: Record<string, unknown>
    sentAt: number
}

export interface TopologyV3CommandDispatchMessage {
    type: 'command-dispatch'
    envelope?: TopologyV3CommandDispatchEnvelope
    sessionId?: string
    sourceNodeId?: string
    targetNodeId?: string
    commandId?: string
    commandName?: string
    payload?: unknown
    sentAt?: number
}

export interface TopologyV3CommandEventEnvelope {
    envelopeId: string
    sessionId: string
    requestId: string
    commandId: string
    ownerNodeId: string
    sourceNodeId: string
    targetNodeId?: string
    eventType: 'accepted' | 'started' | 'resultPatch' | 'completed' | 'failed'
    resultPatch?: Record<string, unknown>
    result?: Record<string, unknown>
    error?: {
        key: string
        code: string
        message: string
        details?: unknown
    }
    occurredAt: number
}

export interface TopologyV3CommandEventMessage {
    type: 'command-event'
    envelope?: TopologyV3CommandEventEnvelope
    sessionId?: string
    sourceNodeId?: string
    targetNodeId?: string
    commandId?: string
    status?: 'STARTED' | 'COMPLETED' | 'FAILED'
    payload?: unknown
    sentAt?: number
}

export interface TopologyV3RequestSnapshotEnvelope {
    envelopeId: string
    sessionId: string
    requestId: string
    ownerNodeId: string
    sourceNodeId: string
    targetNodeId: string
    snapshot: unknown
    sentAt: number
}

export interface TopologyV3RequestSnapshotMessage {
    type: 'request-snapshot'
    envelope?: TopologyV3RequestSnapshotEnvelope
    sessionId?: string
    sourceNodeId?: string
    targetNodeId?: string
    requests?: Array<{
        requestId: string
        status: string
        payload?: unknown
    }>
    sentAt?: number
}

export type TopologyV3RelayChannel =
    | 'state-snapshot'
    | 'state-update'
    | 'command-dispatch'
    | 'command-event'
    | 'request-snapshot'

export interface TopologyV3RelayDelayFaultRule {
    ruleId: string
    kind: 'relay-delay'
    channel?: TopologyV3RelayChannel
    delayMs: number
}

export interface TopologyV3RelayDropFaultRule {
    ruleId: string
    kind: 'relay-drop'
    channel?: TopologyV3RelayChannel
}

export interface TopologyV3RelayDisconnectFaultRule {
    ruleId: string
    kind: 'relay-disconnect-target'
    channel?: TopologyV3RelayChannel
}

export type TopologyV3FaultRule =
    | TopologyV3RelayDelayFaultRule
    | TopologyV3RelayDropFaultRule
    | TopologyV3RelayDisconnectFaultRule

export interface TopologyV3Diagnostics {
    moduleName: string
    state: string
    peers: Array<{
        role: TopologyV3InstanceMode
        nodeId: string
        deviceId: string
    }>
    faultRules: TopologyV3FaultRule[]
}

export type DualTopologyHostV3IncomingMessage =
    | TopologyV3HelloMessage
    | TopologyV3StateSnapshotMessage
    | TopologyV3StateUpdateMessage
    | TopologyV3CommandDispatchMessage
    | TopologyV3CommandEventMessage
    | TopologyV3RequestSnapshotMessage

export type DualTopologyHostV3OutgoingMessage =
    | TopologyV3HelloAckMessage
    | TopologyV3StateSnapshotMessage
    | TopologyV3StateUpdateMessage
    | TopologyV3CommandDispatchMessage
    | TopologyV3CommandEventMessage
    | TopologyV3RequestSnapshotMessage

export interface DualTopologyHostV3Server {
    readonly config: DualTopologyHostV3ServerConfig
    start(): Promise<void>
    close(): Promise<void>
    getAddressInfo(): DualTopologyHostV3AddressInfo
    getStats(): DualTopologyHostV3Stats
    replaceFaultRules(rules: TopologyV3FaultRule[]): {
        success: boolean
        ruleCount: number
    }
}
