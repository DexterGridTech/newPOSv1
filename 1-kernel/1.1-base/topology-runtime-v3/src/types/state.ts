import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV3HelloRuntime, TopologyV3MasterLocator} from './runtime'

export interface TopologyV3ConfigRuntimeState {
    instanceMode?: 'MASTER' | 'SLAVE'
    displayMode?: 'PRIMARY' | 'SECONDARY'
    enableSlave?: boolean
    masterLocator?: TopologyV3MasterLocator | null
}

export interface TopologyV3ContextState {
    localNodeId: string
    displayIndex: number
    displayCount: number
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    workspace: 'MAIN' | 'BRANCH'
    standalone: boolean
    enableSlave: boolean
    masterLocator?: TopologyV3MasterLocator | null
}

export interface TopologyV3ConnectionState {
    serverConnectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    reconnectAttempt: number
}

export interface TopologyV3PeerState {
    peerNodeId?: string
    peerDeviceId?: string
    peerRuntime?: TopologyV3HelloRuntime
    connectedAt?: number
    disconnectedAt?: number
}

export interface TopologyV3SyncState {
    activeSessionId?: string
    status: 'idle' | 'connecting' | 'active'
    lastSnapshotAppliedAt?: number
}

export interface TopologyV3RequestMirrorState {
    requests: Record<string, {
        requestId: string
        status: string
        payload?: unknown
    }>
}

export interface TopologyV3DemoEntryValue {
    label: string
    phase: 'UNACTIVATED' | 'ACTIVATED' | 'DEBUG'
    note?: string
    updatedBy: 'MASTER' | 'SLAVE'
}

export type TopologyV3DemoRecordState = Record<string, {
    value?: TopologyV3DemoEntryValue
    updatedAt: number
    tombstone?: boolean
}>

export type TopologyV3StateSliceDescriptor = StateRuntimeSliceDescriptor<any>
