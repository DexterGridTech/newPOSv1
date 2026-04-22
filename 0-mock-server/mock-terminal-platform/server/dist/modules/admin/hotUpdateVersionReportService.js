import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { terminalVersionReportsTable } from '../../database/schema.js';
import { createId, now } from '../../shared/utils.js';
import { assertSandboxUsable } from '../sandbox/service.js';
import { upsertTerminalRuntimeFacts } from '../tdp/groupService.js';
export const reportTerminalVersion = (input) => {
    assertSandboxUsable(input.sandboxId);
    const timestamp = now();
    const reportId = createId('ver');
    db.insert(terminalVersionReportsTable).values({
        reportId,
        sandboxId: input.sandboxId,
        terminalId: input.terminalId,
        displayIndex: input.displayIndex ?? 0,
        displayRole: input.displayRole ?? 'single',
        appId: input.appId,
        assemblyVersion: input.assemblyVersion,
        buildNumber: input.buildNumber,
        runtimeVersion: input.runtimeVersion,
        bundleVersion: input.bundleVersion,
        source: input.source ?? 'embedded',
        packageId: input.packageId ?? null,
        releaseId: input.releaseId ?? null,
        state: input.state,
        reason: input.reason ?? null,
        reportedAt: timestamp,
    }).run();
    upsertTerminalRuntimeFacts({
        sandboxId: input.sandboxId,
        terminalId: input.terminalId,
        appVersion: input.assemblyVersion,
        runtimeInfo: {
            assemblyAppId: input.appId,
            assemblyVersion: input.assemblyVersion,
            buildNumber: input.buildNumber,
            runtimeVersion: input.runtimeVersion,
            bundleVersion: input.bundleVersion,
            source: input.source ?? 'embedded',
            packageId: input.packageId,
            releaseId: input.releaseId,
            state: input.state,
        },
    });
    return {
        reportId,
        reportedAt: timestamp,
    };
};
export const listTerminalVersionHistory = (input) => {
    assertSandboxUsable(input.sandboxId);
    return db.select().from(terminalVersionReportsTable).where(and(eq(terminalVersionReportsTable.sandboxId, input.sandboxId), eq(terminalVersionReportsTable.terminalId, input.terminalId))).orderBy(desc(terminalVersionReportsTable.reportedAt)).all();
};
export const listHotUpdateVersionDrift = (sandboxId) => {
    assertSandboxUsable(sandboxId);
    const rows = db.select().from(terminalVersionReportsTable)
        .where(eq(terminalVersionReportsTable.sandboxId, sandboxId))
        .orderBy(desc(terminalVersionReportsTable.reportedAt))
        .all();
    const latestByTerminal = new Map();
    rows.forEach(row => {
        if (!latestByTerminal.has(row.terminalId)) {
            latestByTerminal.set(row.terminalId, row);
        }
    });
    return Array.from(latestByTerminal.values()).map(row => ({
        terminalId: row.terminalId,
        displayIndex: row.displayIndex,
        displayRole: row.displayRole,
        appId: row.appId,
        assemblyVersion: row.assemblyVersion,
        runtimeVersion: row.runtimeVersion,
        bundleVersion: row.bundleVersion,
        source: row.source,
        packageId: row.packageId,
        releaseId: row.releaseId,
        state: row.state,
        reportedAt: row.reportedAt,
    }));
};
