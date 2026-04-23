import { and, desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  auditLogsTable,
  projectionPoliciesTable,
  selectorGroupMembershipsTable,
  selectorGroupsTable,
  terminalsTable,
} from '../../database/schema.js'
import { parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import { explainSelectorAgainstFacts, matchTerminalAgainstSelector } from './groupMatcher.js'
import type { SelectorDslV1 } from './groupTypes.js'
import { getTerminalRuntimeFacts } from './groupService.js'

const toSelectorDsl = (value: unknown): SelectorDslV1 => {
  if (typeof value === 'string') {
    return parseJson<SelectorDslV1>(value, {})
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as SelectorDslV1
  }
  return {}
}

const listSandboxTerminalIds = (sandboxId: string) =>
  db.select().from(terminalsTable)
    .where(eq(terminalsTable.sandboxId, sandboxId))
    .all()
    .map(item => item.terminalId)

const groupByField = <T, K extends keyof T>(items: T[], field: K) => {
  const buckets = new Map<string, number>()
  items.forEach(item => {
    const raw = item[field]
    const key = typeof raw === 'string' && raw.trim() ? raw : '__missing__'
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  })
  return Array.from(buckets.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

const explainSelectorDsl = (selectorDsl: SelectorDslV1) => {
  const match = selectorDsl.match ?? {}
  const fields = Object.entries(match)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([field, value]) => {
      const values = value as string[]
      const operator = field === 'capabilitiesAll' ? '包含全部' : '属于'
      return `${field} ${operator} [${values.join(', ')}]`
    })
  return fields.length > 0
    ? fields.join(' 且 ')
    : '未配置条件：默认匹配所有终端'
}

export const previewSelectorGroup = (input: {
  sandboxId: string
  selectorDslJson: unknown
  limit?: number
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const selectorDsl = toSelectorDsl(input.selectorDslJson)
  const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 100) : 20

  const matches = listSandboxTerminalIds(sandboxId)
    .map(terminalId => {
      const facts = getTerminalRuntimeFacts(sandboxId, terminalId)
      const result = matchTerminalAgainstSelector(facts, selectorDsl)
      const explain = explainSelectorAgainstFacts(facts, selectorDsl)
      return { facts, result, explain }
    })
    .filter(item => item.result.matched)

  const runtimeFacts = matches.map(item => item.facts)
  return {
    selectorDslJson: selectorDsl,
    selectorExplain: explainSelectorDsl(selectorDsl),
    matchedTerminalCount: matches.length,
    sampleTerminals: matches.slice(0, limit).map(item => ({
      terminalId: item.facts.terminalId,
      projectId: item.facts.projectId,
      storeId: item.facts.storeId,
      profileId: item.facts.profileId,
      templateId: item.facts.templateId,
      runtimeVersion: item.facts.runtimeVersion ?? '',
      assemblyAppId: item.facts.assemblyAppId ?? '',
      matchedBy: item.result.matchedBy,
      explain: item.explain,
    })),
    distributions: {
      projectId: groupByField(runtimeFacts, 'projectId'),
      storeId: groupByField(runtimeFacts, 'storeId'),
      runtimeVersion: groupByField(runtimeFacts, 'runtimeVersion'),
      assemblyAppId: groupByField(runtimeFacts, 'assemblyAppId'),
    },
    warnings: [
      ...(matches.length === 0 ? ['NO_MATCHED_TERMINALS'] : []),
      ...(matches.length > 100 ? ['IMPACT_LARGE'] : []),
    ],
  }
}

export const getSelectorGroupStats = (input: {
  sandboxId: string
  groupId: string
}) => {
  const { sandboxId, groupId } = input
  assertSandboxUsable(sandboxId)
  const group = db.select().from(selectorGroupsTable).where(and(
    eq(selectorGroupsTable.sandboxId, sandboxId),
    eq(selectorGroupsTable.groupId, groupId),
  )).get()
  if (!group) {
    throw new Error('selector group 不存在')
  }

  const rows = sqlite.prepare(`
    SELECT
      membership.terminal_id,
      membership.rank,
      membership.membership_version,
      membership.matched_by_json,
      membership.computed_at,
      membership.updated_at,
      terminal.project_id,
      terminal.store_id,
      terminal.profile_id,
      terminal.template_id,
      terminal.device_info_json
    FROM selector_group_memberships membership
    JOIN terminal_instances terminal
      ON terminal.sandbox_id = membership.sandbox_id
     AND terminal.terminal_id = membership.terminal_id
    WHERE membership.sandbox_id = ? AND membership.group_id = ?
    ORDER BY membership.rank ASC, membership.terminal_id ASC
  `).all(sandboxId, groupId) as Array<{
    terminal_id: string
    rank: number
    membership_version: number
    matched_by_json: string
    computed_at: number
    updated_at: number
    project_id: string
    store_id: string
    profile_id: string
    template_id: string
    device_info_json: string
  }>

  const members = rows.map(row => {
    const deviceInfo = parseJson<Record<string, unknown>>(row.device_info_json, {})
    const runtimeInfo = typeof deviceInfo.runtimeInfo === 'object' && deviceInfo.runtimeInfo
      ? deviceInfo.runtimeInfo as Record<string, unknown>
      : {}
    return {
      terminalId: row.terminal_id,
      projectId: row.project_id,
      storeId: row.store_id,
      profileId: row.profile_id,
      templateId: row.template_id,
      runtimeVersion: typeof runtimeInfo.runtimeVersion === 'string' ? runtimeInfo.runtimeVersion : '',
      assemblyAppId: typeof runtimeInfo.assemblyAppId === 'string' ? runtimeInfo.assemblyAppId : '',
      rank: row.rank,
      membershipVersion: row.membership_version,
      matchedBy: parseJson<Record<string, string>>(row.matched_by_json, {}),
      computedAt: row.computed_at,
      updatedAt: row.updated_at,
    }
  })

  const policies = db.select().from(projectionPoliciesTable).where(and(
    eq(projectionPoliciesTable.sandboxId, sandboxId),
    eq(projectionPoliciesTable.scopeType, 'GROUP'),
    eq(projectionPoliciesTable.scopeKey, groupId),
  )).all().map(item => ({
    ...item,
    enabled: Boolean(item.enabled),
    payloadJson: parseJson(item.payloadJson, {}),
  }))

  return {
    group: {
      ...group,
      enabled: Boolean(group.enabled),
      selectorDslJson: parseJson(group.selectorDslJson, {}),
      selectorExplain: explainSelectorDsl(parseJson(group.selectorDslJson, {})),
    },
    memberCount: members.length,
    members,
    distributions: {
      projectId: groupByField(members, 'projectId'),
      storeId: groupByField(members, 'storeId'),
      runtimeVersion: groupByField(members, 'runtimeVersion'),
      assemblyAppId: groupByField(members, 'assemblyAppId'),
    },
    policies,
  }
}

export const listSelectorGroupPolicies = (input: {
  sandboxId: string
  groupId: string
}) => {
  const { sandboxId, groupId } = input
  assertSandboxUsable(sandboxId)
  return db.select().from(projectionPoliciesTable).where(and(
    eq(projectionPoliciesTable.sandboxId, sandboxId),
    eq(projectionPoliciesTable.scopeType, 'GROUP'),
    eq(projectionPoliciesTable.scopeKey, groupId),
  )).all().map(item => ({
    ...item,
    enabled: Boolean(item.enabled),
    payloadJson: parseJson(item.payloadJson, {}),
  }))
}

export const validateProjectionPolicyDraft = (input: {
  sandboxId: string
  policyId?: string
  topicKey: string
  itemKey: string
  scopeType: string
  scopeKey: string
  enabled?: boolean
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const enabled = input.enabled ?? true
  const conflicts = enabled
    ? db.select().from(projectionPoliciesTable).where(and(
        eq(projectionPoliciesTable.sandboxId, sandboxId),
        eq(projectionPoliciesTable.topicKey, input.topicKey),
        eq(projectionPoliciesTable.itemKey, input.itemKey),
        eq(projectionPoliciesTable.scopeType, input.scopeType),
        eq(projectionPoliciesTable.scopeKey, input.scopeKey),
        eq(projectionPoliciesTable.enabled, 1),
      )).all().filter(item => item.policyId !== input.policyId)
    : []

  return {
    valid: conflicts.length === 0,
    conflictCount: conflicts.length,
    conflicts: conflicts.map(item => ({
      policyId: item.policyId,
      topicKey: item.topicKey,
      itemKey: item.itemKey,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
      description: item.description,
      updatedAt: item.updatedAt,
    })),
    warnings: [
      ...(conflicts.length > 0 ? ['ENABLED_BUCKET_CONFLICT'] : []),
      ...(input.scopeType === 'GROUP' && !input.scopeKey.trim() ? ['GROUP_SCOPE_KEY_REQUIRED'] : []),
    ],
  }
}

export const getPolicyCenterOverview = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  const groupStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
      SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled
    FROM selector_groups
    WHERE sandbox_id = ?
  `).get(sandboxId) as { total: number; enabled: number | null; disabled: number | null }
  const policyStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
      SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled
    FROM projection_policies
    WHERE sandbox_id = ?
  `).get(sandboxId) as { total: number; enabled: number | null; disabled: number | null }
  const terminalStats = sqlite.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN device_info_json NOT LIKE '%"runtimeInfo"%' THEN 1 ELSE 0 END) as missing_runtime_info
    FROM terminal_instances
    WHERE sandbox_id = ?
  `).get(sandboxId) as { total: number; missing_runtime_info: number | null }
  const membershipRows = sqlite.prepare(`
    SELECT group_id, COUNT(*) as member_count
    FROM selector_group_memberships
    WHERE sandbox_id = ?
    GROUP BY group_id
  `).all(sandboxId) as Array<{ group_id: string; member_count: number }>
  const memberCountByGroup = new Map(membershipRows.map(item => [item.group_id, item.member_count]))
  const groups = db.select().from(selectorGroupsTable)
    .where(eq(selectorGroupsTable.sandboxId, sandboxId))
    .orderBy(desc(selectorGroupsTable.updatedAt))
    .all()
  const policies = db.select().from(projectionPoliciesTable)
    .where(eq(projectionPoliciesTable.sandboxId, sandboxId))
    .orderBy(desc(projectionPoliciesTable.updatedAt))
    .all()
  const recentAuditRows = db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.sandboxId, sandboxId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50)
    .all()
    .filter(item => item.domain === 'TDP_GROUP' || item.domain === 'TDP_POLICY')

  return {
    sandboxId,
    stats: {
      groups: {
        total: groupStats.total ?? 0,
        enabled: groupStats.enabled ?? 0,
        disabled: groupStats.disabled ?? 0,
        withoutMembers: groups.filter(item => (memberCountByGroup.get(item.groupId) ?? 0) === 0).length,
      },
      policies: {
        total: policyStats.total ?? 0,
        enabled: policyStats.enabled ?? 0,
        disabled: policyStats.disabled ?? 0,
      },
      terminals: {
        total: terminalStats.total ?? 0,
        missingRuntimeFacts: terminalStats.missing_runtime_info ?? 0,
      },
    },
    recentGroups: groups.slice(0, 5).map(item => ({
      ...item,
      enabled: Boolean(item.enabled),
      memberCount: memberCountByGroup.get(item.groupId) ?? 0,
      selectorDslJson: parseJson(item.selectorDslJson, {}),
    })),
    recentPolicies: policies.slice(0, 5).map(item => ({
      ...item,
      enabled: Boolean(item.enabled),
      payloadJson: parseJson(item.payloadJson, {}),
    })),
    risks: {
      groupsWithoutMembers: groups
        .filter(item => Boolean(item.enabled) && (memberCountByGroup.get(item.groupId) ?? 0) === 0)
        .map(item => ({ groupId: item.groupId, groupCode: item.groupCode, name: item.name })),
      missingRuntimeFactsTerminalCount: terminalStats.missing_runtime_info ?? 0,
      conflicts: [],
    },
    recentAudit: recentAuditRows.slice(0, 10).map(item => ({
      ...item,
      detail: parseJson(item.detailJson, {}),
    })),
  }
}
