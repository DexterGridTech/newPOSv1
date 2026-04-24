import type {
    NodeHelloAck,
    NodeId,
    SessionId,
    TimestampMs,
} from '@next/kernel-base-contracts'
import type {HostRelayChannel} from './relay'

export interface HostFaultRuleBase {
    ruleId: string
    remainingHits?: number
    createdAt: TimestampMs
    sessionId?: SessionId
    targetRole?: 'master' | 'slave'
    sourceNodeId?: NodeId
    targetNodeId?: NodeId
}

export interface HostHelloDelayFaultRule extends HostFaultRuleBase {
    kind: 'hello-delay'
    delayMs: number
}

export interface HostHelloRejectFaultRule extends HostFaultRuleBase {
    kind: 'hello-reject'
    rejectionCode: NonNullable<NodeHelloAck['rejectionCode']>
    rejectionMessage?: string
}

export interface HostRelayDelayFaultRule extends HostFaultRuleBase {
    kind: 'relay-delay'
    channel?: HostRelayChannel
    delayMs: number
}

export interface HostRelayDropFaultRule extends HostFaultRuleBase {
    kind: 'relay-drop'
    channel?: HostRelayChannel
}

export interface HostRelayDisconnectFaultRule extends HostFaultRuleBase {
    kind: 'relay-disconnect-target'
    channel?: HostRelayChannel
}

export type HostFaultRule =
    | HostHelloDelayFaultRule
    | HostHelloRejectFaultRule
    | HostRelayDelayFaultRule
    | HostRelayDropFaultRule
    | HostRelayDisconnectFaultRule

export interface HostFaultMatchResult {
    ruleIds: readonly string[]
}

export interface HostHelloFaultMatchResult extends HostFaultMatchResult {
    delayMs?: number
    rejection?: {
        code: NonNullable<NodeHelloAck['rejectionCode']>
        message?: string
    }
}

export interface HostRelayFaultMatchResult extends HostFaultMatchResult {
    delayMs?: number
    dropCurrentRelay: boolean
    disconnectTarget: boolean
}
