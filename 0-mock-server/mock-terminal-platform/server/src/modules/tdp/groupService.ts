import { and, desc, eq } from 'drizzle-orm'
import { db, sqlite } from '../../database/index.js'
import {
  changeLogsTable,
  projectionPoliciesTable,
  projectionsTable,
  selectorGroupMembershipsTable,
  selectorGroupsTable,
  terminalsTable,
} from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import { matchTerminalAgainstSelector } from './groupMatcher.js'
import type { SelectorDslV1, TerminalRuntimeFacts } from './groupTypes.js'
import { materializeEnabledGroupPoliciesForTerminal } from './policyService.js'
import { upsertProjectionBatch } from './service.js'
import { deleteProjectionMaterialization } from './policyService.js'

const MEMBERSHIP_TOPIC_KEY = 'terminal.group.membership'

const toBooleanInt = (value: boolean | number | undefined) => value ? 1 : 0

const parseCapabilities = (deviceInfo: Record<string, unknown>) => {
  const capabilities = deviceInfo.capabilities
  if (!Array.isArray(capabilities)) return []
  return capabilities.filter(item => typeof item === 'string')
}

export const getTerminalRuntimeFacts = (sandboxId: string, terminalId: string): TerminalRuntimeFacts => {
  const terminal = db.select().from(terminalsTable).where(and(
    eq(terminalsTable.sandboxId, sandboxId),
    eq(terminalsTable.terminalId, terminalId),
  )).get()

  if (!terminal) {
    throw new Error('终端不存在')
  }

  const deviceInfo = parseJson<Record<string, unknown>>(terminal.deviceInfoJson, {})
  const runtimeInfo = typeof deviceInfo.runtimeInfo === 'object' && deviceInfo.runtimeInfo
    ? deviceInfo.runtimeInfo as Record<string, unknown>
    : {}

  return {
    terminalId: terminal.terminalId,
    sandboxId: terminal.sandboxId,
    platformId: terminal.platformId,
    projectId: terminal.projectId,
    tenantId: terminal.tenantId,
    brandId: terminal.brandId,
    storeId: terminal.storeId,
    profileId: terminal.profileId,
    templateId: terminal.templateId,
    assemblyAppId: typeof runtimeInfo.assemblyAppId === 'string' ? runtimeInfo.assemblyAppId : undefined,
    runtimeVersion: typeof runtimeInfo.runtimeVersion === 'string' ? runtimeInfo.runtimeVersion : undefined,
    assemblyVersion: typeof runtimeInfo.assemblyVersion === 'string' ? runtimeInfo.assemblyVersion : terminal.currentAppVersion ?? undefined,
    bundleVersion: typeof runtimeInfo.bundleVersion === 'string' ? runtimeInfo.bundleVersion : terminal.currentBundleVersion ?? undefined,
    protocolVersion: typeof runtimeInfo.protocolVersion === 'string' ? runtimeInfo.protocolVersion : undefined,
    devicePlatform: typeof deviceInfo.platform === 'string' ? deviceInfo.platform : undefined,
    deviceModel: typeof deviceInfo.model === 'string' ? deviceInfo.model : undefined,
    deviceOsVersion: typeof deviceInfo.osVersion === 'string' ? deviceInfo.osVersion : undefined,
    capabilities: parseCapabilities(deviceInfo),
  }
}

const getEnabledSelectorGroups = (sandboxId: string) =>
  db.select().from(selectorGroupsTable)
    .where(and(eq(selectorGroupsTable.sandboxId, sandboxId), eq(selectorGroupsTable.enabled, 1)))
    .orderBy(selectorGroupsTable.priority, selectorGroupsTable.updatedAt, selectorGroupsTable.groupId)
    .all()

const getNextCursorForTerminal = (sandboxId: string, terminalId: string) => {
  const row = sqlite.prepare(`
    SELECT COALESCE(MAX(cursor), 0) as high_watermark
    FROM tdp_change_logs
    WHERE sandbox_id = ? AND target_terminal_id = ?
  `).get(sandboxId, terminalId) as { high_watermark: number } | undefined
  return (row?.high_watermark ?? 0) + 1
}

const upsertMembershipProjection = (input: {
  sandboxId: string
  terminalId: string
  payload: Record<string, unknown>
  timestamp: number
}) => {
  upsertProjectionBatch({
    sandboxId: input.sandboxId,
    projections: [{
      topicKey: MEMBERSHIP_TOPIC_KEY,
      scopeType: 'TERMINAL',
      scopeKey: input.terminalId,
      itemKey: input.terminalId,
      payload: input.payload,
      targetTerminalIds: [input.terminalId],
    }],
  })
}

export const createSelectorGroup = (input: {
  sandboxId: string
  groupCode: string
  name: string
  description?: string
  enabled?: boolean
  priority?: number
  selectorDslJson: SelectorDslV1
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const groupCode = input.groupCode.trim()
  if (!groupCode) {
    throw new Error('groupCode 不能为空')
  }
  const existing = db.select().from(selectorGroupsTable).where(and(
    eq(selectorGroupsTable.sandboxId, sandboxId),
    eq(selectorGroupsTable.groupCode, groupCode),
  )).get()
  if (existing) {
    throw new Error('groupCode 已存在')
  }

  const timestamp = now()
  const groupId = createId('group')
  db.insert(selectorGroupsTable).values({
    groupId,
    sandboxId,
    groupCode,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    enabled: toBooleanInt(input.enabled ?? true),
    priority: input.priority ?? 100,
    selectorDslJson: JSON.stringify(input.selectorDslJson ?? {}),
    membershipVersion: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return { groupId }
}

const mapSelectorGroup = (item: typeof selectorGroupsTable.$inferSelect) => ({
  ...item,
  enabled: Boolean(item.enabled),
  selectorDslJson: parseJson(item.selectorDslJson, {}),
})

export const listSelectorGroups = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(selectorGroupsTable)
    .where(eq(selectorGroupsTable.sandboxId, sandboxId))
    .orderBy(selectorGroupsTable.priority, desc(selectorGroupsTable.updatedAt))
    .all()
    .map(mapSelectorGroup)
}

export const updateSelectorGroup = (input: {
  sandboxId: string
  groupId: string
  groupCode?: string
  name?: string
  description?: string
  enabled?: boolean
  priority?: number
  selectorDslJson?: SelectorDslV1
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const current = db.select().from(selectorGroupsTable).where(and(
    eq(selectorGroupsTable.sandboxId, sandboxId),
    eq(selectorGroupsTable.groupId, input.groupId),
  )).get()
  if (!current) {
    throw new Error('selector group 不存在')
  }

  const nextGroupCode = input.groupCode?.trim() ?? current.groupCode
  if (!nextGroupCode) {
    throw new Error('groupCode 不能为空')
  }
  const duplicated = db.select().from(selectorGroupsTable).where(and(
    eq(selectorGroupsTable.sandboxId, sandboxId),
    eq(selectorGroupsTable.groupCode, nextGroupCode),
  )).get()
  if (duplicated && duplicated.groupId !== input.groupId) {
    throw new Error('groupCode 已存在')
  }

  const timestamp = now()
  const nextSelector = input.selectorDslJson ?? parseJson<SelectorDslV1>(current.selectorDslJson, {})
  db.update(selectorGroupsTable)
    .set({
      groupCode: nextGroupCode,
      name: input.name?.trim() ?? current.name,
      description: input.description?.trim() ?? current.description,
      enabled: input.enabled === undefined ? current.enabled : toBooleanInt(input.enabled),
      priority: input.priority ?? current.priority,
      selectorDslJson: JSON.stringify(nextSelector),
      membershipVersion: current.membershipVersion + 1,
      updatedAt: timestamp,
    })
    .where(and(eq(selectorGroupsTable.sandboxId, sandboxId), eq(selectorGroupsTable.groupId, input.groupId)))
    .run()

  const terminalIds = db.select().from(terminalsTable)
    .where(eq(terminalsTable.sandboxId, sandboxId))
    .all()
    .map(item => item.terminalId)
  const recomputeItems = terminalIds.map(terminalId => recomputeTerminalMemberships({ sandboxId, terminalId }))

  const updated = db.select().from(selectorGroupsTable).where(and(
    eq(selectorGroupsTable.sandboxId, sandboxId),
    eq(selectorGroupsTable.groupId, input.groupId),
  )).get()

  return {
    group: updated ? mapSelectorGroup(updated) : null,
    recompute: {
      total: recomputeItems.length,
      items: recomputeItems,
    },
  }
}

export const recomputeTerminalMemberships = (input: {
  sandboxId: string
  terminalId: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const facts = getTerminalRuntimeFacts(sandboxId, input.terminalId)
  const groups = getEnabledSelectorGroups(sandboxId)
  const timestamp = now()

  const matches = groups
    .map(group => {
      const selector = parseJson<SelectorDslV1>(group.selectorDslJson, {})
      const result = matchTerminalAgainstSelector(facts, selector)
      return { group, result }
    })
    .filter(item => item.result.matched)
    .sort((left, right) => {
      if (left.group.priority !== right.group.priority) {
        return left.group.priority - right.group.priority
      }
      if (left.group.updatedAt !== right.group.updatedAt) {
        return left.group.updatedAt - right.group.updatedAt
      }
      return left.group.groupId.localeCompare(right.group.groupId)
    })

  const recompute = sqlite.transaction(() => {
    sqlite.prepare(`
      DELETE FROM selector_group_memberships
      WHERE sandbox_id = ? AND terminal_id = ?
    `).run(sandboxId, input.terminalId)

    const updatedVersions = new Map<string, number>()

    matches.forEach((item, index) => {
      const membershipVersion = item.group.membershipVersion + 1
      updatedVersions.set(item.group.groupId, membershipVersion)
      db.insert(selectorGroupMembershipsTable).values({
        membershipId: createId('membership'),
        sandboxId,
        groupId: item.group.groupId,
        terminalId: input.terminalId,
        rank: index,
        matchedByJson: JSON.stringify(item.result.matchedBy),
        membershipVersion,
        computedAt: timestamp,
        updatedAt: timestamp,
      }).run()
    })

    updatedVersions.forEach((membershipVersion, groupId) => {
      db.update(selectorGroupsTable)
        .set({ membershipVersion, updatedAt: timestamp })
        .where(and(eq(selectorGroupsTable.groupId, groupId), eq(selectorGroupsTable.sandboxId, sandboxId)))
        .run()
    })

    upsertMembershipProjection({
      sandboxId,
      terminalId: input.terminalId,
      timestamp,
      payload: {
        membershipVersion: Math.max(0, ...Array.from(updatedVersions.values())),
        groups: matches.map((item, index) => ({
          groupId: item.group.groupId,
          groupCode: item.group.groupCode,
          name: item.group.name,
          priority: item.group.priority,
          rank: index,
          matchedBy: item.result.matchedBy,
        })),
      },
    })
  })

  recompute()

  materializeEnabledGroupPoliciesForTerminal({
    sandboxId,
    terminalId: input.terminalId,
    groupIds: matches.map(item => item.group.groupId),
  })

  return getTerminalGroupMemberships(sandboxId, input.terminalId)
}

export const getTerminalGroupMemberships = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  const rows = sqlite.prepare(`
    SELECT
      membership.group_id,
      membership.terminal_id,
      membership.rank,
      membership.membership_version,
      membership.matched_by_json,
      group_row.group_code,
      group_row.name,
      group_row.priority
    FROM selector_group_memberships membership
    JOIN selector_groups group_row
      ON group_row.group_id = membership.group_id
     AND group_row.sandbox_id = membership.sandbox_id
    WHERE membership.sandbox_id = ? AND membership.terminal_id = ?
    ORDER BY membership.rank ASC
  `).all(sandboxId, terminalId) as Array<{
    group_id: string
    terminal_id: string
    rank: number
    membership_version: number
    matched_by_json: string
    group_code: string
    name: string
    priority: number
  }>

  return {
    terminalId,
    membershipVersion: rows.length > 0 ? Math.max(...rows.map(item => item.membership_version)) : 0,
    groups: rows.map(item => ({
      groupId: item.group_id,
      groupCode: item.group_code,
      name: item.name,
      priority: item.priority,
      rank: item.rank,
      matchedBy: parseJson<Record<string, string>>(item.matched_by_json, {}),
    })),
  }
}

export const getSelectorGroupMemberships = (input: {
  sandboxId: string
  groupId: string
}) => {
  assertSandboxUsable(input.sandboxId)
  const rows = sqlite.prepare(`
    SELECT
      membership.group_id,
      membership.terminal_id,
      membership.rank,
      membership.membership_version,
      membership.matched_by_json,
      membership.computed_at,
      membership.updated_at,
      terminal.project_id,
      terminal.store_id,
      terminal.profile_id,
      terminal.template_id
    FROM selector_group_memberships membership
    JOIN terminal_instances terminal
      ON terminal.sandbox_id = membership.sandbox_id
     AND terminal.terminal_id = membership.terminal_id
    WHERE membership.sandbox_id = ? AND membership.group_id = ?
    ORDER BY membership.rank ASC, membership.terminal_id ASC
  `).all(input.sandboxId, input.groupId) as Array<{
    group_id: string
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
  }>

  return {
    groupId: input.groupId,
    memberCount: rows.length,
    members: rows.map(item => ({
      groupId: item.group_id,
      terminalId: item.terminal_id,
      rank: item.rank,
      membershipVersion: item.membership_version,
      matchedBy: parseJson<Record<string, string>>(item.matched_by_json, {}),
      computedAt: item.computed_at,
      updatedAt: item.updated_at,
      projectId: item.project_id,
      storeId: item.store_id,
      profileId: item.profile_id,
      templateId: item.template_id,
    })),
  }
}

export const resolveTerminalIdsByScope = (input: {
  sandboxId: string
  scopeType: string
  scopeKeys: string[]
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const scopeType = input.scopeType.trim().toUpperCase()
  const scopeKeys = Array.from(new Set(input.scopeKeys.map(item => item.trim()).filter(Boolean)))
  if (scopeKeys.length === 0) {
    return []
  }

  if (scopeType === 'TERMINAL') {
    return scopeKeys
  }

  const terminals = db.select().from(terminalsTable)
    .where(eq(terminalsTable.sandboxId, sandboxId))
    .all()

  const terminalIds = terminals
    .filter(item => {
      switch (scopeType) {
        case 'STORE':
          return scopeKeys.includes(item.storeId)
        case 'PROJECT':
          return scopeKeys.includes(item.projectId)
        case 'TENANT':
          return scopeKeys.includes(item.tenantId)
        case 'BRAND':
          return scopeKeys.includes(item.brandId)
        case 'PLATFORM':
          return scopeKeys.includes(item.platformId)
        default:
          return false
      }
    })
    .map(item => item.terminalId)

  if (scopeType === 'GROUP') {
    const groupMembershipRows = db.select().from(selectorGroupMembershipsTable).where(and(
      eq(selectorGroupMembershipsTable.sandboxId, sandboxId),
    )).all()
    return Array.from(new Set(
      groupMembershipRows
        .filter(item => scopeKeys.includes(item.groupId))
        .map(item => item.terminalId),
    ))
  }

  return Array.from(new Set(terminalIds))
}

export const upsertTerminalRuntimeFacts = (input: {
  sandboxId: string
  terminalId: string
  appVersion?: string
  protocolVersion?: string
  capabilities?: string[]
  runtimeInfo?: Record<string, unknown>
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const terminal = db.select().from(terminalsTable).where(and(
    eq(terminalsTable.sandboxId, sandboxId),
    eq(terminalsTable.terminalId, input.terminalId),
  )).get()
  if (!terminal) {
    throw new Error('终端不存在')
  }

  const previousDeviceInfo = parseJson<Record<string, unknown>>(terminal.deviceInfoJson, {})
  const previousFingerprint = JSON.stringify({
    appVersion: terminal.currentAppVersion,
    bundleVersion: terminal.currentBundleVersion,
    deviceInfo: previousDeviceInfo,
  })
  const previousRuntimeInfo = typeof previousDeviceInfo.runtimeInfo === 'object' && previousDeviceInfo.runtimeInfo
    ? previousDeviceInfo.runtimeInfo as Record<string, unknown>
    : {}
  const nextRuntimeInfo = {
    ...previousRuntimeInfo,
    ...(input.runtimeInfo ?? {}),
    ...(input.protocolVersion ? { protocolVersion: input.protocolVersion } : {}),
  }
  const nextDeviceInfo = {
    ...previousDeviceInfo,
    ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    runtimeInfo: nextRuntimeInfo,
  }
  const nextBundleVersion = typeof input.runtimeInfo?.bundleVersion === 'string'
    ? input.runtimeInfo.bundleVersion
    : terminal.currentBundleVersion
  const timestamp = now()

  db.update(terminalsTable)
    .set({
      currentAppVersion: input.appVersion ?? terminal.currentAppVersion,
      currentBundleVersion: nextBundleVersion,
      deviceInfoJson: JSON.stringify(nextDeviceInfo),
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(terminalsTable.sandboxId, sandboxId), eq(terminalsTable.terminalId, input.terminalId)))
    .run()

  const changed = previousFingerprint !== JSON.stringify({
    appVersion: input.appVersion ?? terminal.currentAppVersion,
    bundleVersion: nextBundleVersion,
    deviceInfo: nextDeviceInfo,
  })
  const membership = changed
    ? recomputeTerminalMemberships({ sandboxId, terminalId: input.terminalId })
    : getTerminalGroupMemberships(sandboxId, input.terminalId)

  return {
    terminalId: input.terminalId,
    changed,
    membership,
  }
}

export const ensureGroupCanBeDeleted = (sandboxId: string, groupId: string) => {
  const policy = db.select().from(projectionPoliciesTable).where(and(
    eq(projectionPoliciesTable.sandboxId, sandboxId),
    eq(projectionPoliciesTable.scopeType, 'GROUP'),
    eq(projectionPoliciesTable.scopeKey, groupId),
    eq(projectionPoliciesTable.enabled, 1),
  )).get()
  if (policy) {
    throw new Error('group 仍绑定 enabled policy，无法删除')
  }
}

export const deleteSelectorGroup = (input: {
  sandboxId: string
  groupId: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  ensureGroupCanBeDeleted(sandboxId, input.groupId)

  const affectedTerminalIds = db.select().from(selectorGroupMembershipsTable)
    .where(and(
      eq(selectorGroupMembershipsTable.sandboxId, sandboxId),
      eq(selectorGroupMembershipsTable.groupId, input.groupId),
    ))
    .all()
    .map(item => item.terminalId)

  const staleGroupProjections = db.select().from(projectionsTable).where(and(
    eq(projectionsTable.sandboxId, sandboxId),
    eq(projectionsTable.scopeType, 'GROUP'),
    eq(projectionsTable.scopeKey, input.groupId),
  )).all()

  staleGroupProjections.forEach(item => {
    deleteProjectionMaterialization({
      sandboxId,
      topicKey: item.topicKey,
      itemKey: item.itemKey,
      scopeType: item.scopeType,
      scopeKey: item.scopeKey,
    })
  })

  db.delete(projectionPoliciesTable)
    .where(and(
      eq(projectionPoliciesTable.sandboxId, sandboxId),
      eq(projectionPoliciesTable.scopeType, 'GROUP'),
      eq(projectionPoliciesTable.scopeKey, input.groupId),
    ))
    .run()

  db.delete(selectorGroupMembershipsTable)
    .where(and(
      eq(selectorGroupMembershipsTable.sandboxId, sandboxId),
      eq(selectorGroupMembershipsTable.groupId, input.groupId),
    ))
    .run()

  db.delete(selectorGroupsTable)
    .where(and(
      eq(selectorGroupsTable.sandboxId, sandboxId),
      eq(selectorGroupsTable.groupId, input.groupId),
    ))
    .run()

  Array.from(new Set(affectedTerminalIds)).forEach(terminalId => {
    recomputeTerminalMemberships({sandboxId, terminalId})
  })

  return {
    groupId: input.groupId,
    deleted: true,
    affectedTerminalCount: Array.from(new Set(affectedTerminalIds)).length,
  }
}
