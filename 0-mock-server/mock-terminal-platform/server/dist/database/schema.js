import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const sandboxesTable = sqliteTable('sandboxes', {
    sandboxId: text('sandbox_id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull(),
    isSystemDefault: integer('is_system_default').notNull(),
    creationMode: text('creation_mode').notNull(),
    sourceSandboxId: text('source_sandbox_id'),
    seed: integer('seed'),
    ownerUserId: text('owner_user_id').notNull(),
    ownerTeamId: text('owner_team_id').notNull(),
    purpose: text('purpose').notNull(),
    resourceLimitsJson: text('resource_limits_json').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const runtimeContextTable = sqliteTable('platform_runtime_context', {
    contextKey: text('context_key').primaryKey(),
    currentSandboxId: text('current_sandbox_id').notNull(),
    updatedAt: integer('updated_at').notNull(),
});
export const platformsTable = sqliteTable('platforms', {
    platformId: text('platform_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformCode: text('platform_code').notNull(),
    platformName: text('platform_name').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const tenantsTable = sqliteTable('tenants', {
    tenantId: text('tenant_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    tenantCode: text('tenant_code').notNull(),
    tenantName: text('tenant_name').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const brandsTable = sqliteTable('brands', {
    brandId: text('brand_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    brandCode: text('brand_code').notNull(),
    brandName: text('brand_name').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const projectsTable = sqliteTable('projects', {
    projectId: text('project_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    projectCode: text('project_code').notNull(),
    projectName: text('project_name').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    region: text('region'),
    timezone: text('timezone'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const storesTable = sqliteTable('stores', {
    storeId: text('store_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    brandId: text('brand_id').notNull(),
    projectId: text('project_id').notNull(),
    unitCode: text('unit_code').notNull(),
    storeCode: text('store_code').notNull(),
    storeName: text('store_name').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    address: text('address'),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const contractsTable = sqliteTable('contracts', {
    contractId: text('contract_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    projectId: text('project_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    brandId: text('brand_id').notNull(),
    storeId: text('store_id').notNull(),
    contractCode: text('contract_code').notNull(),
    unitCode: text('unit_code').notNull(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: text('status').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const terminalProfilesTable = sqliteTable('terminal_profiles', {
    profileId: text('profile_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    profileCode: text('profile_code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    capabilitiesJson: text('capabilities_json').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const terminalTemplatesTable = sqliteTable('terminal_templates', {
    templateId: text('template_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    templateCode: text('template_code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    profileId: text('profile_id').notNull(),
    presetConfigJson: text('preset_config_json').notNull(),
    presetTagsJson: text('preset_tags_json').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const terminalsTable = sqliteTable('terminal_instances', {
    terminalId: text('terminal_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    brandId: text('brand_id').notNull(),
    projectId: text('project_id').notNull(),
    storeId: text('store_id').notNull(),
    profileId: text('profile_id').notNull(),
    templateId: text('template_id').notNull(),
    lifecycleStatus: text('lifecycle_status').notNull(),
    presenceStatus: text('presence_status').notNull(),
    healthStatus: text('health_status').notNull(),
    currentAppVersion: text('current_app_version'),
    currentBundleVersion: text('current_bundle_version'),
    currentConfigVersion: text('current_config_version'),
    deviceFingerprint: text('device_fingerprint'),
    deviceInfoJson: text('device_info_json').notNull(),
    sourceMode: text('source_mode').notNull(),
    activatedAt: integer('activated_at'),
    lastSeenAt: integer('last_seen_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const activationCodesTable = sqliteTable('activation_codes', {
    code: text('code').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    platformId: text('platform_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    brandId: text('brand_id').notNull(),
    projectId: text('project_id').notNull(),
    storeId: text('store_id').notNull(),
    profileId: text('profile_id').notNull(),
    templateId: text('template_id'),
    status: text('status').notNull(),
    usedBy: text('used_by'),
    usedAt: integer('used_at'),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull()
});
export const credentialsTable = sqliteTable('terminal_credentials', {
    credentialId: text('credential_id').primaryKey(),
    terminalId: text('terminal_id').notNull(),
    token: text('token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    issuedAt: integer('issued_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    refreshExpiresAt: integer('refresh_expires_at').notNull(),
    revokedAt: integer('revoked_at')
});
export const taskReleasesTable = sqliteTable('task_releases', {
    releaseId: text('release_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    taskType: text('task_type').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    targetSelectorJson: text('target_selector_json').notNull(),
    payloadJson: text('payload_json').notNull(),
    priority: integer('priority').notNull(),
    status: text('status').notNull(),
    approvalStatus: text('approval_status').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const taskInstancesTable = sqliteTable('task_instances', {
    instanceId: text('instance_id').primaryKey(),
    releaseId: text('release_id').notNull(),
    terminalId: text('terminal_id').notNull(),
    taskType: text('task_type').notNull(),
    status: text('status').notNull(),
    deliveryStatus: text('delivery_status').notNull(),
    payloadJson: text('payload_json').notNull(),
    resultJson: text('result_json'),
    errorJson: text('error_json'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deliveredAt: integer('delivered_at'),
    finishedAt: integer('finished_at')
});
export const sessionsTable = sqliteTable('tdp_sessions', {
    sessionId: text('session_id').primaryKey(),
    terminalId: text('terminal_id').notNull(),
    sandboxId: text('sandbox_id').notNull(),
    clientVersion: text('client_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    status: text('status').notNull(),
    connectedAt: integer('connected_at').notNull(),
    disconnectedAt: integer('disconnected_at'),
    lastHeartbeatAt: integer('last_heartbeat_at'),
    lastDeliveredRevision: integer('last_delivered_revision'),
    lastAckedRevision: integer('last_acked_revision'),
    lastAppliedRevision: integer('last_applied_revision'),
});
export const topicsTable = sqliteTable('tdp_topics', {
    topicId: text('topic_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    payloadMode: text('payload_mode').notNull(),
    schemaJson: text('schema_json').notNull(),
    scopeType: text('scope_type').notNull(),
    retentionHours: integer('retention_hours').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const projectionsTable = sqliteTable('tdp_projections', {
    projectionId: text('projection_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    topicKey: text('topic_key').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeKey: text('scope_key').notNull(),
    itemKey: text('item_key').notNull(),
    revision: integer('revision').notNull(),
    payloadJson: text('payload_json').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const changeLogsTable = sqliteTable('tdp_change_logs', {
    changeId: text('change_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    cursor: integer('cursor').notNull(),
    topicKey: text('topic_key').notNull(),
    operation: text('operation').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeKey: text('scope_key').notNull(),
    itemKey: text('item_key').notNull(),
    targetTerminalId: text('target_terminal_id').notNull(),
    revision: integer('revision').notNull(),
    payloadJson: text('payload_json').notNull(),
    sourceReleaseId: text('source_release_id'),
    createdAt: integer('created_at').notNull()
});
export const selectorGroupsTable = sqliteTable('selector_groups', {
    groupId: text('group_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    groupCode: text('group_code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    enabled: integer('enabled').notNull(),
    priority: integer('priority').notNull(),
    selectorDslJson: text('selector_dsl_json').notNull(),
    membershipVersion: integer('membership_version').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const selectorGroupMembershipsTable = sqliteTable('selector_group_memberships', {
    membershipId: text('membership_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    groupId: text('group_id').notNull(),
    terminalId: text('terminal_id').notNull(),
    rank: integer('rank').notNull(),
    matchedByJson: text('matched_by_json').notNull(),
    membershipVersion: integer('membership_version').notNull(),
    computedAt: integer('computed_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const projectionPoliciesTable = sqliteTable('projection_policies', {
    policyId: text('policy_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    topicKey: text('topic_key').notNull(),
    itemKey: text('item_key').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeKey: text('scope_key').notNull(),
    enabled: integer('enabled').notNull(),
    payloadJson: text('payload_json').notNull(),
    description: text('description').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const hotUpdatePackagesTable = sqliteTable('hot_update_packages', {
    packageId: text('package_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    appId: text('app_id').notNull(),
    platform: text('platform').notNull(),
    product: text('product').notNull(),
    channel: text('channel').notNull(),
    bundleVersion: text('bundle_version').notNull(),
    runtimeVersion: text('runtime_version').notNull(),
    assemblyVersion: text('assembly_version').notNull(),
    buildNumber: integer('build_number').notNull(),
    manifestJson: text('manifest_json').notNull(),
    manifestSha256: text('manifest_sha256').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    sha256: text('sha256').notNull(),
    storagePath: text('storage_path').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const hotUpdateReleasesTable = sqliteTable('hot_update_releases', {
    releaseId: text('release_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    packageId: text('package_id').notNull(),
    topicKey: text('topic_key').notNull(),
    itemKey: text('item_key').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeKey: text('scope_key').notNull(),
    enabled: integer('enabled').notNull(),
    desiredPayloadJson: text('desired_payload_json').notNull(),
    policyId: text('policy_id'),
    status: text('status').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const terminalVersionReportsTable = sqliteTable('terminal_version_reports', {
    reportId: text('report_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    terminalId: text('terminal_id').notNull(),
    displayIndex: integer('display_index').notNull(),
    displayRole: text('display_role').notNull(),
    appId: text('app_id').notNull(),
    assemblyVersion: text('assembly_version').notNull(),
    buildNumber: integer('build_number').notNull(),
    runtimeVersion: text('runtime_version').notNull(),
    bundleVersion: text('bundle_version').notNull(),
    source: text('source').notNull(),
    packageId: text('package_id'),
    releaseId: text('release_id'),
    state: text('state').notNull(),
    reason: text('reason'),
    reportedAt: integer('reported_at').notNull()
});
export const commandOutboxTable = sqliteTable('tdp_command_outbox', {
    commandId: text('command_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    terminalId: text('terminal_id').notNull(),
    topicKey: text('topic_key').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status').notNull(),
    sourceReleaseId: text('source_release_id'),
    deliveredAt: integer('delivered_at'),
    ackedAt: integer('acked_at'),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});
export const faultRulesTable = sqliteTable('fault_rules', {
    faultRuleId: text('fault_rule_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    name: text('name').notNull(),
    targetType: text('target_type').notNull(),
    matcherJson: text('matcher_json').notNull(),
    actionJson: text('action_json').notNull(),
    enabled: integer('enabled').notNull(),
    hitCount: integer('hit_count').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
});
export const auditLogsTable = sqliteTable('audit_logs', {
    auditId: text('audit_id').primaryKey(),
    sandboxId: text('sandbox_id').notNull(),
    domain: text('domain').notNull(),
    action: text('action').notNull(),
    operator: text('operator').notNull(),
    targetId: text('target_id').notNull(),
    detailJson: text('detail_json').notNull(),
    createdAt: integer('created_at').notNull()
});
