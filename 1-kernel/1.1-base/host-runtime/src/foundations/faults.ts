import type {NodeId, SessionId} from '@impos2/kernel-base-contracts'
import type {
    HostFaultRule,
    HostHelloFaultMatchResult,
    HostRelayFaultMatchResult,
} from '../types/fault'
import type {HostRelayChannel} from '../types/relay'

interface HostFaultScope {
    sessionId?: SessionId
    sourceNodeId?: NodeId
    targetNodeId?: NodeId
    targetRole?: 'master' | 'slave'
}

const matchesScope = (rule: HostFaultRule, scope: HostFaultScope): boolean => {
    if (rule.sessionId && rule.sessionId !== scope.sessionId) {
        return false
    }
    if (rule.sourceNodeId && rule.sourceNodeId !== scope.sourceNodeId) {
        return false
    }
    if (rule.targetNodeId && rule.targetNodeId !== scope.targetNodeId) {
        return false
    }
    if (rule.targetRole && rule.targetRole !== scope.targetRole) {
        return false
    }
    return true
}

export interface HostFaultRegistry {
    replaceRules(rules: readonly HostFaultRule[]): void
    addRule(rule: HostFaultRule): void
    clear(): void
    list(): readonly HostFaultRule[]
    matchHello(scope: HostFaultScope): HostHelloFaultMatchResult
    matchRelay(scope: HostFaultScope & {channel: HostRelayChannel}): HostRelayFaultMatchResult
}

export const createHostFaultRegistry = (): HostFaultRegistry => {
    let rules: HostFaultRule[] = []

    const consumeRule = (rule: HostFaultRule) => {
        if (rule.remainingHits == null) {
            return
        }
        rule.remainingHits -= 1
        if (rule.remainingHits <= 0) {
            rules = rules.filter(candidate => candidate.ruleId !== rule.ruleId)
        }
    }

    return {
        replaceRules(nextRules) {
            rules = [...nextRules]
        },
        addRule(rule) {
            rules = [...rules, rule]
        },
        clear() {
            rules = []
        },
        list() {
            return [...rules]
        },
        matchHello(scope) {
            const matched = rules.filter(rule => {
                return matchesScope(rule, scope) && (rule.kind === 'hello-delay' || rule.kind === 'hello-reject')
            })

            const result: HostHelloFaultMatchResult = {
                ruleIds: matched.map(rule => rule.ruleId),
            }

            matched.forEach(rule => {
                if (rule.kind === 'hello-delay') {
                    result.delayMs = Math.max(result.delayMs ?? 0, rule.delayMs)
                }
                if (rule.kind === 'hello-reject' && !result.rejection) {
                    result.rejection = {
                        code: rule.rejectionCode,
                        message: rule.rejectionMessage,
                    }
                }
                consumeRule(rule)
            })

            return result
        },
        matchRelay(scope) {
            const matched = rules.filter(rule => {
                if (!matchesScope(rule, scope)) {
                    return false
                }
                if (rule.kind === 'relay-delay' || rule.kind === 'relay-drop' || rule.kind === 'relay-disconnect-target') {
                    return rule.channel == null || rule.channel === scope.channel
                }
                return false
            })

            const result: HostRelayFaultMatchResult = {
                ruleIds: matched.map(rule => rule.ruleId),
                dropCurrentRelay: false,
                disconnectTarget: false,
            }

            matched.forEach(rule => {
                if (rule.kind === 'relay-delay') {
                    result.delayMs = Math.max(result.delayMs ?? 0, rule.delayMs)
                }
                if (rule.kind === 'relay-drop') {
                    result.dropCurrentRelay = true
                }
                if (rule.kind === 'relay-disconnect-target') {
                    result.disconnectTarget = true
                }
                consumeRule(rule)
            })

            return result
        },
    }
}
