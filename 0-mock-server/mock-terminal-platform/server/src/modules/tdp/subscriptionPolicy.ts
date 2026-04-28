import { and, eq } from 'drizzle-orm'
import { db } from '../../database/index.js'
import {
  terminalProfilesTable,
  terminalTemplatesTable,
  terminalsTable,
} from '../../database/schema.js'
import { parseJson } from '../../shared/utils.js'

export const TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1 = 'tdp.topic-subscription.v1'
export const TDP_SNAPSHOT_CHUNK_CAPABILITY_V1 = 'tdp.snapshot-chunk.v1'

const TOPIC_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/

export const validateTopicKey = (topicKey: string) =>
  topicKey.length <= 128 && TOPIC_KEY_PATTERN.test(topicKey) && !topicKey.includes('*')

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

export const normalizeTopicKeys = (topics: readonly unknown[] | undefined) =>
  Array.from(new Set(
    (topics ?? [])
      .map(topic => String(topic).trim())
      .filter(validateTopicKey),
  )).sort()

const extractAllowedTopics = (value: unknown): string[] | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  const direct = record.allowedTopics ?? record.tdpAllowedTopics
  if (isStringArray(direct)) {
    return normalizeTopicKeys(direct)
  }
  const tdp = record.tdp
  if (typeof tdp === 'object' && tdp !== null && !Array.isArray(tdp)) {
    const nested = (tdp as Record<string, unknown>).allowedTopics
    if (isStringArray(nested)) {
      return normalizeTopicKeys(nested)
    }
  }
  return undefined
}

const intersectOptionalTopicAllowlist = (
  current: Set<string> | undefined,
  allowlist: readonly string[] | undefined,
) => {
  if (!allowlist) {
    return current
  }
  const allowed = new Set(allowlist)
  if (!current) {
    return allowed
  }
  return new Set([...current].filter(topic => allowed.has(topic)))
}

const fnv1a64 = (input: string): string => {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * prime)
  }
  return hash.toString(16).padStart(16, '0')
}

export const computeSubscriptionHash = (topics: readonly string[]) => {
  const normalized = [...topics].sort().join('|')
  return `fnv1a64:${fnv1a64(`tdp-subscription-v1|${normalized}`)}`
}

export const readTerminalTopicPolicy = (
  sandboxId: string,
  terminalId: string,
) => {
  const terminal = db.select().from(terminalsTable).where(and(
    eq(terminalsTable.sandboxId, sandboxId),
    eq(terminalsTable.terminalId, terminalId),
  )).get()
  if (!terminal) {
    return {
      allowedTopics: undefined as string[] | undefined,
      policySources: [] as string[],
    }
  }

  const profile = db.select().from(terminalProfilesTable).where(and(
    eq(terminalProfilesTable.sandboxId, sandboxId),
    eq(terminalProfilesTable.profileId, terminal.profileId),
  )).get()
  const template = db.select().from(terminalTemplatesTable).where(and(
    eq(terminalTemplatesTable.sandboxId, sandboxId),
    eq(terminalTemplatesTable.templateId, terminal.templateId),
  )).get()

  let allowedTopics: Set<string> | undefined
  const policySources: string[] = []
  const profileAllowedTopics = extractAllowedTopics(parseJson<Record<string, unknown>>(profile?.capabilitiesJson, {}))
  if (profileAllowedTopics) {
    allowedTopics = intersectOptionalTopicAllowlist(allowedTopics, profileAllowedTopics)
    policySources.push('terminal_profile.capabilities.allowedTopics')
  }
  const templateAllowedTopics = extractAllowedTopics(parseJson<Record<string, unknown>>(template?.presetConfigJson, {}))
  if (templateAllowedTopics) {
    allowedTopics = intersectOptionalTopicAllowlist(allowedTopics, templateAllowedTopics)
    policySources.push('terminal_template.presetConfig.allowedTopics')
  }

  return {
    allowedTopics: allowedTopics ? [...allowedTopics].sort() : undefined,
    policySources,
  }
}

export const normalizeSubscription = (payload: {
  capabilities?: string[]
  subscribedTopics?: string[]
  requiredTopics?: string[]
  allowedTopics?: string[]
}) => {
  const capabilities = payload.capabilities ?? []
  const explicit = capabilities.includes(TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1)
  if (!explicit) {
    return {
      version: 1 as const,
      mode: 'legacy-all' as const,
      acceptedTopics: [] as string[],
      rejectedTopics: [] as string[],
      requiredMissingTopics: [] as string[],
      hash: undefined,
    }
  }

  const requestedTopics = normalizeTopicKeys(payload.subscribedTopics)
  const invalidTopics = Array.from(new Set(
    (payload.subscribedTopics ?? []).map(topic => String(topic).trim()).filter(topic => !validateTopicKey(topic)),
  )).sort()
  const allowedTopicSet = payload.allowedTopics ? new Set(payload.allowedTopics) : undefined
  const acceptedTopics = allowedTopicSet
    ? requestedTopics.filter(topic => allowedTopicSet.has(topic))
    : requestedTopics
  const rejectedTopics = Array.from(new Set([
    ...invalidTopics,
    ...requestedTopics.filter(topic => allowedTopicSet && !allowedTopicSet.has(topic)),
  ])).sort()
  const requiredTopics = normalizeTopicKeys(payload.requiredTopics)
  const requiredMissingTopics = requiredTopics.filter(topic => !acceptedTopics.includes(topic))

  return {
    version: 1 as const,
    mode: 'explicit' as const,
    acceptedTopics,
    rejectedTopics,
    requiredMissingTopics,
    hash: computeSubscriptionHash(acceptedTopics),
  }
}

