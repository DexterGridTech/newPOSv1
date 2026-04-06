import { desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { faultRulesTable, taskInstancesTable } from '../../database/schema.js'
import { DEFAULT_SANDBOX_ID } from '../../shared/constants.js'
import { createId, now, parseJson } from '../../shared/utils.js'

export const listFaultRules = () =>
  db.select().from(faultRulesTable).orderBy(desc(faultRulesTable.updatedAt)).all().map((item) => ({
    ...item,
    matcher: parseJson(item.matcherJson, {}),
    action: parseJson(item.actionJson, {}),
    enabled: Boolean(item.enabled),
  }))

export const createFaultRule = (input: {
  name: string
  targetType: string
  matcher: Record<string, unknown>
  action: Record<string, unknown>
}) => {
  const timestamp = now()
  const faultRuleId = createId('fault')
  db.insert(faultRulesTable).values({
    faultRuleId,
    sandboxId: DEFAULT_SANDBOX_ID,
    name: input.name,
    targetType: input.targetType,
    matcherJson: JSON.stringify(input.matcher),
    actionJson: JSON.stringify(input.action),
    enabled: 1,
    hitCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return { faultRuleId }
}

export const applyMockResult = (instanceId: string, input: { status: string; result?: unknown; error?: unknown }) => {
  const timestamp = now()
  db.update(taskInstancesTable)
    .set({
      status: input.status,
      resultJson: input.result ? JSON.stringify(input.result) : null,
      errorJson: input.error ? JSON.stringify(input.error) : null,
      finishedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(taskInstancesTable.instanceId, instanceId))
    .run()
  return { instanceId, status: input.status }
}

export const simulateFaultHit = (faultRuleId: string) => {
  sqlite.prepare('UPDATE fault_rules SET hit_count = hit_count + 1, updated_at = ? WHERE fault_rule_id = ?').run(now(), faultRuleId)
  return { faultRuleId }
}


export const updateFaultRule = (faultRuleId: string, input: {
  name?: string
  targetType?: string
  matcher?: Record<string, unknown>
  action?: Record<string, unknown>
  enabled?: boolean
}) => {
  const timestamp = now()
  const current = sqlite.prepare('SELECT * FROM fault_rules WHERE fault_rule_id = ?').get(faultRuleId) as Record<string, unknown> | undefined
  if (!current) {
    throw new Error('故障规则不存在')
  }

  sqlite.prepare(`
    UPDATE fault_rules
    SET name = ?,
        target_type = ?,
        matcher_json = ?,
        action_json = ?,
        enabled = ?,
        updated_at = ?
    WHERE fault_rule_id = ?
  `).run(
    input.name ?? current.name,
    input.targetType ?? current.target_type,
    JSON.stringify(input.matcher ?? parseJson(String(current.matcher_json ?? ''), {})),
    JSON.stringify(input.action ?? parseJson(String(current.action_json ?? ''), {})),
    input.enabled === undefined ? current.enabled : Number(input.enabled),
    timestamp,
    faultRuleId,
  )

  return { faultRuleId, updatedAt: timestamp }
}
