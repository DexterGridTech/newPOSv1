import { sqlite } from '../../database/index.js';
import { parseJson } from '../../shared/utils.js';
import { assertSandboxUsable } from '../sandbox/service.js';
const normalizeRows = (rows) => rows.map((item) => {
    const normalized = { ...item };
    for (const [key, value] of Object.entries(normalized)) {
        if (typeof value === 'string' && key.endsWith('_json')) {
            normalized[key] = parseJson(value, value);
        }
    }
    return normalized;
});
export const exportMockData = (sandboxId) => {
    assertSandboxUsable(sandboxId);
    const platforms = normalizeRows(sqlite.prepare('SELECT * FROM platforms WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const tenants = normalizeRows(sqlite.prepare('SELECT * FROM tenants WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const brands = normalizeRows(sqlite.prepare('SELECT * FROM brands WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const projects = normalizeRows(sqlite.prepare('SELECT * FROM projects WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const stores = normalizeRows(sqlite.prepare('SELECT * FROM stores WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const contracts = normalizeRows(sqlite.prepare('SELECT * FROM contracts WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const topics = normalizeRows(sqlite.prepare('SELECT * FROM tdp_topics WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const releases = normalizeRows(sqlite.prepare('SELECT * FROM task_releases WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const instances = normalizeRows(sqlite.prepare('SELECT ti.* FROM task_instances ti JOIN task_releases tr ON tr.release_id = ti.release_id WHERE tr.sandbox_id = ? ORDER BY ti.updated_at DESC').all(sandboxId));
    const faults = normalizeRows(sqlite.prepare('SELECT * FROM fault_rules WHERE sandbox_id = ? ORDER BY updated_at DESC').all(sandboxId));
    const audits = normalizeRows(sqlite.prepare('SELECT * FROM audit_logs WHERE sandbox_id = ? ORDER BY created_at DESC LIMIT 500').all(sandboxId));
    return {
        sandboxId,
        exportedAt: Date.now(),
        platforms,
        tenants,
        brands,
        projects,
        stores,
        contracts,
        topics,
        taskReleases: releases,
        taskInstances: instances,
        faultRules: faults,
        auditLogs: audits,
    };
};
export const exportMockDataText = (sandboxId) => JSON.stringify(exportMockData(sandboxId), null, 2);
