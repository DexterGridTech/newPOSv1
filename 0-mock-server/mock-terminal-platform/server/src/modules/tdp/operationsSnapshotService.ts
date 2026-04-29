import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../database/index.js'
import {
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
} from '../../database/schema.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import {
  getTerminalDecisionTrace,
  getTerminalResolvedTopics,
} from './decisionService.js'
import {
  getHighWatermarkForTerminal,
  listSessions,
  listTopics,
} from './service.js'
import { readTerminalTopicPolicy } from './subscriptionPolicy.js'

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const topicCountOfResolvedResults = (
  resolvedResults: Record<string, unknown> | undefined,
) => Object.fromEntries(
  Object.entries(resolvedResults ?? {})
    .map(([topic, items]) => [
      topic,
      items && typeof items === 'object' && !Array.isArray(items)
        ? Object.keys(items).length
        : 0,
    ]),
)

const filterAllowedTopics = (
  topics: readonly string[],
  allowedTopics: readonly string[] | undefined,
) => {
  if (!allowedTopics) {
    return [...topics].sort()
  }
  const allowedTopicSet = new Set(allowedTopics)
  return topics.filter(topic => allowedTopicSet.has(topic)).sort()
}

export const getTerminalOperationsSnapshot = (input: {
  sandboxId: string
  terminalId: string
}) => {
  assertSandboxUsable(input.sandboxId)
  const sampledAt = Date.now()
  const terminal = db.select().from(terminalsTable).where(and(
    eq(terminalsTable.sandboxId, input.sandboxId),
    eq(terminalsTable.terminalId, input.terminalId),
  )).get()
  if (!terminal) {
    throw new Error('TERMINAL_NOT_FOUND')
  }

  const profile = db.select().from(terminalProfilesTable).where(and(
    eq(terminalProfilesTable.sandboxId, input.sandboxId),
    eq(terminalProfilesTable.profileId, terminal.profileId),
  )).get()
  const template = db.select().from(terminalTemplatesTable).where(and(
    eq(terminalTemplatesTable.sandboxId, input.sandboxId),
    eq(terminalTemplatesTable.templateId, terminal.templateId),
  )).get()
  const topicRegistry = listTopics(input.sandboxId)
  const policy = readTerminalTopicPolicy(input.sandboxId, input.terminalId)
  const resolvedTopics = getTerminalResolvedTopics(input)
  const decisionTrace = getTerminalDecisionTrace(input)
  const sessions = listSessions(input.sandboxId)
    .filter(session => session.terminalId === input.terminalId)
    .sort((left, right) => (right.connectedAt ?? 0) - (left.connectedAt ?? 0))
  const currentSession = sessions.find(session => session.status === 'CONNECTED') ?? sessions[0]
  const currentSubscription = currentSession?.subscription
  const definedTopics = Array.from(new Set([
    ...Object.keys(resolvedTopics.resolvedResults ?? {}),
    ...topicRegistry.map(topic => topic.key),
  ])).sort()
  const serverAvailableTopics = filterAllowedTopics(definedTopics, policy.allowedTopics)
  const acceptedTopics = asStringArray(currentSubscription?.acceptedTopics)
  const subscribedTopics = asStringArray(currentSubscription?.subscribedTopics)
  const requestedTopics = subscribedTopics.length > 0
    ? subscribedTopics
    : acceptedTopics
  const highWatermark = getHighWatermarkForTerminal(
    input.sandboxId,
    input.terminalId,
    currentSubscription?.mode === 'explicit'
      ? {
          mode: 'explicit',
          acceptedTopics,
        }
      : undefined,
  )

  return {
    mode: 'server-enhanced' as const,
    sampledAt,
    terminal: {
      terminalId: terminal.terminalId,
      sandboxId: terminal.sandboxId,
      platformId: terminal.platformId,
      projectId: terminal.projectId,
      brandId: terminal.brandId,
      tenantId: terminal.tenantId,
      storeId: terminal.storeId,
      profileId: terminal.profileId,
      profileCode: profile?.profileCode,
      profileName: profile?.name,
      templateId: terminal.templateId,
      templateCode: template?.templateCode,
      templateName: template?.name,
      lifecycleStatus: terminal.lifecycleStatus,
      presenceStatus: terminal.presenceStatus,
      healthStatus: terminal.healthStatus,
      currentAppVersion: terminal.currentAppVersion,
      currentBundleVersion: terminal.currentBundleVersion,
      currentConfigVersion: terminal.currentConfigVersion,
      lastSeenAt: terminal.lastSeenAt,
    },
    topicRegistry: {
      total: topicRegistry.length,
      topics: topicRegistry.map(topic => ({
        key: topic.key,
        name: topic.name,
        payloadMode: topic.payloadMode,
        scopeType: topic.scopeType,
        lifecycle: topic.lifecycle,
        deliveryType: topic.deliveryType,
      })),
    },
    policy: {
      allowedTopics: policy.allowedTopics,
      policySources: policy.policySources,
    },
    resolvedTopics: {
      availableTopics: serverAvailableTopics,
      resolvedItemCounts: topicCountOfResolvedResults(resolvedTopics.resolvedResults),
    },
    sessions: {
      total: sessions.length,
      currentSessionId: currentSession?.sessionId,
      onlineSessions: sessions
        .filter(session => session.status === 'CONNECTED')
        .map(session => ({
          sessionId: session.sessionId,
          terminalId: session.terminalId,
          localNodeId: session.localNodeId,
          displayIndex: session.displayIndex,
          displayMode: session.displayMode,
          instanceMode: session.instanceMode,
          status: session.status,
          connectedAt: session.connectedAt,
          lastHeartbeatAt: session.lastHeartbeatAt,
          highWatermark: session.highWatermark,
          ackLag: session.ackLag,
          applyLag: session.applyLag,
          subscription: session.subscription,
        })),
      current: currentSession
        ? {
            sessionId: currentSession.sessionId,
            status: currentSession.status,
            localNodeId: currentSession.localNodeId,
            displayIndex: currentSession.displayIndex,
            displayMode: currentSession.displayMode,
            instanceMode: currentSession.instanceMode,
            connectedAt: currentSession.connectedAt,
            lastHeartbeatAt: currentSession.lastHeartbeatAt,
            lastDeliveredRevision: currentSession.lastDeliveredRevision,
            lastAckedRevision: currentSession.lastAckedRevision,
            lastAppliedRevision: currentSession.lastAppliedRevision,
            highWatermark,
            ackLag: Math.max(0, highWatermark - (currentSession.lastAckedRevision ?? 0)),
            applyLag: Math.max(0, highWatermark - (currentSession.lastAppliedRevision ?? 0)),
            subscription: currentSubscription,
          }
        : undefined,
    },
    subscription: {
      requestedTopics,
      acceptedTopics,
      rejectedTopics: asStringArray(currentSubscription?.rejectedTopics),
      requiredMissingTopics: asStringArray(currentSubscription?.requiredMissingTopics),
      acceptedHash: currentSubscription?.hash,
      serverAvailableTopics,
    },
    decisionTrace: {
      runtimeFacts: decisionTrace.runtimeFacts,
      membershipSnapshot: decisionTrace.membershipSnapshot,
      topics: decisionTrace.perTopicCandidates.map(item => ({
        topicKey: item.topicKey,
        itemKey: item.itemKey,
        winner: item.winner
          ? {
              scopeType: item.winner.scopeType,
              scopeKey: item.winner.scopeKey,
              revision: item.winner.revision,
              source: item.winner.source,
              policyId: item.winner.policyId,
              reason: item.winner.reason,
            }
          : null,
        candidateCount: item.candidates.length,
      })),
    },
    findings: [
      ...(currentSession ? [] : [{
        key: 'server-session-missing',
        tone: 'warn' as const,
        title: '服务端无当前在线 session',
        detail: '服务端没有找到该终端的 CONNECTED session，可能是终端离线、旧连接已断开或 session registry 已重置。',
      }]),
      ...acceptedTopics
        .filter(topic => !serverAvailableTopics.includes(topic))
        .map(topic => ({
          key: `accepted-topic-unavailable:${topic}`,
          tone: 'warn' as const,
          title: 'accepted topic 不在服务端可给列表',
          detail: `${topic} 出现在 accepted topics，但当前服务端 resolved/topic registry 中未找到。`,
        })),
    ],
  }
}
