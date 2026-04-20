import { and, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import { projectionPoliciesTable, projectionsTable, selectorGroupMembershipsTable } from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import { fanoutExistingProjectionToTerminalIds, upsertProjectionBatch } from './service.js'

const getTargetTerminalIdsForPolicy = (input: {
  sandboxId: string
  scopeType: string
  scopeKey: string
}) => {
  if (input.scopeType === 'TERMINAL') {
    return [input.scopeKey]
  }
  if (input.scopeType !== 'GROUP') {
    throw new Error('当前仅支持 GROUP / TERMINAL scope policy')
  }
  const rows = db.select().from(selectorGroupMembershipsTable).where(and(
    eq(selectorGroupMembershipsTable.sandboxId, input.sandboxId),
    eq(selectorGroupMembershipsTable.groupId, input.scopeKey),
  )).all()
  return Array.from(new Set(rows.map(item => item.terminalId)))
}

export const createProjectionPolicy = (input: {
  sandboxId: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  enabled?: boolean
  payloadJson: Record<string, unknown>
  description?: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const enabled = input.enabled ?? true
  const existing = db.select().from(projectionPoliciesTable).where(and(
    eq(projectionPoliciesTable.sandboxId, sandboxId),
    eq(projectionPoliciesTable.topicKey, input.topicKey),
    eq(projectionPoliciesTable.itemKey, input.itemKey),
    eq(projectionPoliciesTable.scopeType, input.scopeType),
    eq(projectionPoliciesTable.scopeKey, input.scopeKey),
  )).get()
  if (existing?.enabled) {
    throw new Error('同 scope bucket 已存在 enabled policy')
  }

  const timestamp = now()
  const policyId = existing?.policyId ?? createId('policy')
  if (existing) {
    db.update(projectionPoliciesTable).set({
      enabled: enabled ? 1 : 0,
      payloadJson: JSON.stringify(input.payloadJson ?? {}),
      description: input.description?.trim() ?? '',
      updatedAt: timestamp,
    }).where(and(
      eq(projectionPoliciesTable.sandboxId, sandboxId),
      eq(projectionPoliciesTable.policyId, policyId),
    )).run()
  } else {
    db.insert(projectionPoliciesTable).values({
      policyId,
      sandboxId,
      topicKey: input.topicKey,
      itemKey: input.itemKey,
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      enabled: enabled ? 1 : 0,
      payloadJson: JSON.stringify(input.payloadJson ?? {}),
      description: input.description?.trim() ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }).run()
  }

  const targetTerminalIds = enabled
    ? getTargetTerminalIdsForPolicy({ sandboxId, scopeType: input.scopeType, scopeKey: input.scopeKey })
    : []

  if (enabled) {
    upsertProjectionBatch({
      sandboxId,
      projections: [{
        topicKey: input.topicKey,
        itemKey: input.itemKey,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        payload: input.payloadJson,
        targetTerminalIds,
      }],
    })
  }

  return {
    policyId,
    topicKey: input.topicKey,
    itemKey: input.itemKey,
    scopeType: input.scopeType,
    scopeKey: input.scopeKey,
    enabled,
    payloadJson: input.payloadJson,
    description: input.description?.trim() ?? '',
    currentMatchedTerminalCount: targetTerminalIds.length,
  }
}

const getProjectionPolicyRecord = (sandboxId: string, policyId: string) => {
  const policy = db.select().from(projectionPoliciesTable).where(and(
    eq(projectionPoliciesTable.sandboxId, sandboxId),
    eq(projectionPoliciesTable.policyId, policyId),
  )).get()
  if (!policy) {
    throw new Error('projection policy 不存在')
  }
  return policy
}

export const getProjectionPolicy = (input: {
  sandboxId: string
  policyId: string
}) => {
  const policy = getProjectionPolicyRecord(input.sandboxId, input.policyId)
  return {
    ...policy,
    enabled: Boolean(policy.enabled),
    payloadJson: parseJson(policy.payloadJson, {}),
  }
}

const listHistoricalTargetTerminalIds = (input: {
  sandboxId: string
  topicKey: string
  scopeType: string
  scopeKey: string
  itemKey: string
}) => {
  const rows = sqlite.prepare(`
    SELECT DISTINCT target_terminal_id
    FROM tdp_change_logs
    WHERE sandbox_id = ?
      AND topic_key = ?
      AND scope_type = ?
      AND scope_key = ?
      AND item_key = ?
      AND target_terminal_id != ''
  `).all(
    input.sandboxId,
    input.topicKey,
    input.scopeType,
    input.scopeKey,
    input.itemKey,
  ) as Array<{target_terminal_id: string}>

  return rows.map(item => item.target_terminal_id)
}

export const deleteProjectionMaterialization = (input: {
  sandboxId: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  targetTerminalIds?: string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const targetTerminalIds = input.targetTerminalIds
    ? Array.from(new Set(input.targetTerminalIds.filter(item => item.trim().length > 0)))
    : listHistoricalTargetTerminalIds(input)

  return upsertProjectionBatch({
    sandboxId,
    projections: [{
      operation: 'delete',
      topicKey: input.topicKey,
      itemKey: input.itemKey,
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      payload: {},
      targetTerminalIds,
    }],
  })
}

export const listProjectionPolicies = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(projectionPoliciesTable)
    .where(eq(projectionPoliciesTable.sandboxId, sandboxId))
    .all()
    .map(item => ({
      ...item,
      enabled: Boolean(item.enabled),
      payloadJson: parseJson(item.payloadJson, {}),
    }))
}

export const materializeEnabledGroupPoliciesForTerminal = (input: {
  sandboxId: string
  terminalId: string
  groupIds: string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const groupIds = Array.from(new Set(input.groupIds.filter(groupId => groupId.trim().length > 0)))
  if (groupIds.length === 0) {
    return { total: 0, items: [] }
  }

  const policies = db.select().from(projectionPoliciesTable)
    .where(and(
      eq(projectionPoliciesTable.sandboxId, sandboxId),
      eq(projectionPoliciesTable.scopeType, 'GROUP'),
      eq(projectionPoliciesTable.enabled, 1),
    ))
    .all()
    .filter(policy => groupIds.includes(policy.scopeKey))

  if (policies.length === 0) {
    return { total: 0, items: [] }
  }

  const items = policies.map(policy => {
    const projection = db.select().from(projectionsTable).where(and(
      eq(projectionsTable.sandboxId, sandboxId),
      eq(projectionsTable.topicKey, policy.topicKey),
      eq(projectionsTable.scopeType, policy.scopeType),
      eq(projectionsTable.scopeKey, policy.scopeKey),
      eq(projectionsTable.itemKey, policy.itemKey),
    )).get()

    if (!projection) {
      return upsertProjectionBatch({
        sandboxId,
        projections: [{
          topicKey: policy.topicKey,
          itemKey: policy.itemKey,
          scopeType: policy.scopeType,
          scopeKey: policy.scopeKey,
          payload: parseJson<Record<string, unknown>>(policy.payloadJson, {}),
          targetTerminalIds: [input.terminalId],
        }],
      })
    }

    return fanoutExistingProjectionToTerminalIds({
      sandboxId,
      topicKey: projection.topicKey,
      scopeType: projection.scopeType,
      scopeKey: projection.scopeKey,
      itemKey: projection.itemKey,
      revision: projection.revision,
      payload: parseJson<Record<string, unknown>>(projection.payloadJson, {}),
      targetTerminalIds: [input.terminalId],
    })
  })

  return {
    total: items.reduce((sum, item) => sum + (item.total ?? 0), 0),
    items,
  }
}

export const updateProjectionPolicy = (input: {
  sandboxId: string
  policyId: string
  enabled?: boolean
  payloadJson?: Record<string, unknown>
  description?: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const current = getProjectionPolicyRecord(sandboxId, input.policyId)
  const previousEnabled = Boolean(current.enabled)
  const nextEnabled = input.enabled ?? previousEnabled
  const currentPayload = parseJson<Record<string, unknown>>(current.payloadJson, {})
  const nextPayload = input.payloadJson ?? currentPayload
  const nextDescription = input.description?.trim() ?? current.description
  const timestamp = now()

  db.update(projectionPoliciesTable)
    .set({
      enabled: nextEnabled ? 1 : 0,
      payloadJson: JSON.stringify(nextPayload),
      description: nextDescription,
      updatedAt: timestamp,
    })
    .where(and(
      eq(projectionPoliciesTable.sandboxId, sandboxId),
      eq(projectionPoliciesTable.policyId, input.policyId),
    ))
    .run()

  if (previousEnabled && !nextEnabled) {
    deleteProjectionMaterialization({
      sandboxId,
      topicKey: current.topicKey,
      itemKey: current.itemKey,
      scopeType: current.scopeType,
      scopeKey: current.scopeKey,
    })
  } else if (!previousEnabled && nextEnabled) {
    upsertProjectionBatch({
      sandboxId,
      projections: [{
        topicKey: current.topicKey,
        itemKey: current.itemKey,
        scopeType: current.scopeType,
        scopeKey: current.scopeKey,
        payload: nextPayload,
        targetTerminalIds: getTargetTerminalIdsForPolicy({
          sandboxId,
          scopeType: current.scopeType,
          scopeKey: current.scopeKey,
        }),
      }],
    })
  } else if (nextEnabled && JSON.stringify(currentPayload) !== JSON.stringify(nextPayload)) {
    upsertProjectionBatch({
      sandboxId,
      projections: [{
        topicKey: current.topicKey,
        itemKey: current.itemKey,
        scopeType: current.scopeType,
        scopeKey: current.scopeKey,
        payload: nextPayload,
        targetTerminalIds: getTargetTerminalIdsForPolicy({
          sandboxId,
          scopeType: current.scopeType,
          scopeKey: current.scopeKey,
        }),
      }],
    })
  }

  return {
    policyId: current.policyId,
    topicKey: current.topicKey,
    itemKey: current.itemKey,
    scopeType: current.scopeType,
    scopeKey: current.scopeKey,
    enabled: nextEnabled,
    payloadJson: nextPayload,
    description: nextDescription,
  }
}

export const deleteProjectionPolicy = (input: {
  sandboxId: string
  policyId: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const current = getProjectionPolicyRecord(sandboxId, input.policyId)
  const enabled = Boolean(current.enabled)

  db.delete(projectionPoliciesTable)
    .where(and(
      eq(projectionPoliciesTable.sandboxId, sandboxId),
      eq(projectionPoliciesTable.policyId, input.policyId),
    ))
    .run()

  if (enabled) {
    deleteProjectionMaterialization({
      sandboxId,
      topicKey: current.topicKey,
      itemKey: current.itemKey,
      scopeType: current.scopeType,
      scopeKey: current.scopeKey,
    })
  }

  return {
    policyId: current.policyId,
    deleted: true,
  }
}
