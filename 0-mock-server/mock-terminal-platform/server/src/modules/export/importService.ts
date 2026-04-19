import { db } from '../../database/index.js'
import { faultRulesTable, topicsTable } from '../../database/schema.js'
import { createId, now } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'

const ensureNonEmptyString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} 不能为空`)
  }
}

export interface ImportPayload {
  sandboxId?: string
  topics?: Array<{ key: string; name: string; scopeType?: string; payloadMode?: string; schema?: Record<string, unknown>; retentionHours?: number }>
  faultRules?: Array<{ name: string; targetType: string; matcher: Record<string, unknown>; action: Record<string, unknown> }>
}

export const validateImportPayload = (input: ImportPayload) => {
  const checks: string[] = []

  for (const [index, topic] of (input.topics ?? []).entries()) {
    ensureNonEmptyString(topic.key, `topics[${index}].key`)
    ensureNonEmptyString(topic.name, `topics[${index}].name`)
    checks.push(`topic:${topic.key}`)
  }

  for (const [index, rule] of (input.faultRules ?? []).entries()) {
    ensureNonEmptyString(rule.name, `faultRules[${index}].name`)
    ensureNonEmptyString(rule.targetType, `faultRules[${index}].targetType`)
    checks.push(`fault:${rule.name}`)
  }

  return {
    valid: true,
    checks,
    topicCount: input.topics?.length ?? 0,
    faultRuleCount: input.faultRules?.length ?? 0,
  }
}

export const importMockTemplates = (input: ImportPayload & { sandboxId: string }) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  validateImportPayload(input)

  const timestamp = now()
  let topicCount = 0
  let faultCount = 0

  for (const topic of input.topics ?? []) {
    db.insert(topicsTable).values({
      topicId: createId('topic'),
      sandboxId,
      key: topic.key,
      name: topic.name,
      payloadMode: topic.payloadMode ?? 'FLEXIBLE_JSON',
      schemaJson: JSON.stringify(topic.schema ?? { type: 'object', additionalProperties: true }),
      scopeType: topic.scopeType ?? 'TERMINAL',
      retentionHours: topic.retentionHours ?? 72,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
    topicCount += 1
  }

  for (const rule of input.faultRules ?? []) {
    db.insert(faultRulesTable).values({
      faultRuleId: createId('fault'),
      sandboxId,
      name: rule.name,
      targetType: rule.targetType,
      matcherJson: JSON.stringify(rule.matcher),
      actionJson: JSON.stringify(rule.action),
      enabled: 1,
      hitCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
    faultCount += 1
  }

  return {
    importedTopics: topicCount,
    importedFaultRules: faultCount,
  }
}
