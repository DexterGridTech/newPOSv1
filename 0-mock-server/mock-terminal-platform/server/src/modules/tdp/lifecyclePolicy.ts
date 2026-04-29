import { sqlite } from '../../database/index.js'
import { now } from '../../shared/utils.js'

export type TdpProjectionLifecycle = 'persistent' | 'expiring'
export type TdpDeliveryType = 'projection' | 'command-outbox'

export interface TdpTopicLifecyclePolicy {
  topicKey: string
  lifecycle: TdpProjectionLifecycle
  deliveryType: TdpDeliveryType
  defaultTtlMs?: number
  minTtlMs?: number
  maxTtlMs?: number
  allowPublisherExpiresAt: boolean
  allowPublisherTtlMs: boolean
}

export interface TdpLifecycleComputationInput {
  sandboxId: string
  topicKey: string
  operation: 'upsert' | 'delete'
  occurredAt?: number | null
  ttlMs?: number | null
  ttl_ms?: number | null
  expiresAt?: string | number | null
  expires_at?: string | number | null
  serverNow?: number
}

export interface TdpLifecycleComputationResult {
  policy: TdpTopicLifecyclePolicy
  lifecycle: TdpProjectionLifecycle
  expiresAt: number | null
  expiryStatus: 'pending' | null
}

export const TDP_PROJECTION_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const TDP_PUBLISHER_CLOCK_FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const BUILTIN_TOPIC_POLICIES: Record<string, Partial<TdpTopicLifecyclePolicy>> = {
  'remote.control': {
    deliveryType: 'command-outbox',
  },
  'print.command': {
    deliveryType: 'command-outbox',
  },
  'order.payment.completed': {
    lifecycle: 'expiring',
    deliveryType: 'projection',
    defaultTtlMs: 2 * 24 * 60 * 60 * 1000,
    minTtlMs: 1_000,
    maxTtlMs: 2 * 24 * 60 * 60 * 1000,
  },
}

const normalizeLifecycle = (value: unknown): TdpProjectionLifecycle =>
  value === 'expiring' ? 'expiring' : 'persistent'

const normalizeDeliveryType = (value: unknown, payloadMode?: string | null): TdpDeliveryType => {
  if (value === 'command-outbox') {
    return 'command-outbox'
  }
  if (payloadMode === 'EPHEMERAL_COMMAND') {
    return 'command-outbox'
  }
  return 'projection'
}

const toPositiveInteger = (value: unknown) => {
  if (value == null) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : undefined
}

export const toTdpTimestampMs = (value: string | number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

export const readTdpTopicLifecyclePolicy = (
  sandboxId: string,
  topicKey: string,
): TdpTopicLifecyclePolicy => {
  const row = sqlite.prepare(`
    SELECT key, payload_mode, lifecycle, delivery_type, default_ttl_ms, min_ttl_ms, max_ttl_ms
    FROM tdp_topics
    WHERE sandbox_id = ? AND key = ?
    LIMIT 1
  `).get(sandboxId, topicKey) as {
    key: string
    payload_mode: string
    lifecycle: string | null
    delivery_type: string | null
    default_ttl_ms: number | null
    min_ttl_ms: number | null
    max_ttl_ms: number | null
  } | undefined
  const builtin = BUILTIN_TOPIC_POLICIES[topicKey] ?? {}
  const lifecycle = row
    ? normalizeLifecycle(row.lifecycle)
    : (builtin.lifecycle ?? 'persistent')
  const deliveryType = row
    ? normalizeDeliveryType(row.delivery_type, row.payload_mode)
    : (builtin.deliveryType ?? 'projection')
  const defaultTtlMs = toPositiveInteger(row?.default_ttl_ms) ?? builtin.defaultTtlMs
  const minTtlMs = toPositiveInteger(row?.min_ttl_ms) ?? builtin.minTtlMs
  const maxTtlMs = toPositiveInteger(row?.max_ttl_ms) ?? builtin.maxTtlMs

  return {
    topicKey,
    lifecycle,
    deliveryType,
    defaultTtlMs,
    minTtlMs,
    maxTtlMs,
    allowPublisherExpiresAt: lifecycle === 'expiring',
    allowPublisherTtlMs: lifecycle === 'expiring',
  }
}

const resolvePublisherTtlMs = (input: TdpLifecycleComputationInput) => {
  const candidate = input.ttlMs ?? input.ttl_ms
  if (candidate == null) {
    return undefined
  }
  const value = Number(candidate)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('TDP_EXPIRES_AT_OUT_OF_RANGE')
  }
  return Math.trunc(value)
}

export const validateAndComputeTdpProjectionLifecycle = (
  input: TdpLifecycleComputationInput,
): TdpLifecycleComputationResult => {
  const policy = readTdpTopicLifecyclePolicy(input.sandboxId, input.topicKey)
  const serverNow = input.serverNow ?? now()
  const publisherTtlMs = resolvePublisherTtlMs(input)
  const publisherExpiresAt = toTdpTimestampMs(input.expiresAt ?? input.expires_at)
  const hasPublisherTtl = publisherTtlMs != null || publisherExpiresAt != null

  if (policy.deliveryType === 'command-outbox' && input.operation === 'upsert') {
    throw new Error(`TDP_TOPIC_REQUIRES_COMMAND_OUTBOX:${input.topicKey}`)
  }

  if (input.operation === 'delete') {
    return {
      policy,
      lifecycle: policy.lifecycle,
      expiresAt: null,
      expiryStatus: null,
    }
  }

  if (policy.lifecycle === 'persistent') {
    if (hasPublisherTtl) {
      throw new Error(`TDP_TOPIC_DOES_NOT_ALLOW_TTL:${input.topicKey}`)
    }
    return {
      policy,
      lifecycle: 'persistent',
      expiresAt: null,
      expiryStatus: null,
    }
  }

  const occurredAt = input.occurredAt ?? serverNow
  if (occurredAt > serverNow + TDP_PUBLISHER_CLOCK_FUTURE_TOLERANCE_MS) {
    throw new Error('TDP_OCCURRED_AT_IN_FUTURE')
  }
  const ttlBase = occurredAt
  const expiresAt = publisherExpiresAt
    ?? (publisherTtlMs != null ? ttlBase + publisherTtlMs : undefined)
    ?? (policy.defaultTtlMs != null ? ttlBase + policy.defaultTtlMs : undefined)

  if (expiresAt == null) {
    throw new Error(`TDP_EXPIRES_AT_REQUIRED:${input.topicKey}`)
  }
  if (expiresAt <= serverNow) {
    throw new Error('TDP_EXPIRES_AT_ALREADY_EXPIRED')
  }
  if (policy.minTtlMs != null && expiresAt < serverNow + policy.minTtlMs) {
    throw new Error('TDP_EXPIRES_AT_BELOW_MIN')
  }
  const maxTtlMs = Math.min(policy.maxTtlMs ?? TDP_PROJECTION_MAX_TTL_MS, TDP_PROJECTION_MAX_TTL_MS)
  if (expiresAt > serverNow + maxTtlMs) {
    throw new Error('TDP_EXPIRES_AT_OUT_OF_RANGE')
  }

  return {
    policy,
    lifecycle: 'expiring',
    expiresAt,
    expiryStatus: 'pending',
  }
}
