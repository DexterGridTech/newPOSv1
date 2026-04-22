import { eq } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { projectionPoliciesTable, projectionsTable, terminalsTable, } from '../../database/schema.js';
import { parseJson } from '../../shared/utils.js';
import { assertSandboxUsable } from '../sandbox/service.js';
import { getTerminalGroupMemberships, getTerminalRuntimeFacts } from './groupService.js';
const SCOPE_PRIORITY = ['PLATFORM', 'PROJECT', 'BRAND', 'TENANT', 'STORE', 'GROUP', 'TERMINAL'];
const buildScopeChain = (input) => {
    const { terminalId, facts, membership } = input;
    const scopeChain = [
        { scopeType: 'PLATFORM', scopeKey: facts.platformId },
        { scopeType: 'PROJECT', scopeKey: facts.projectId },
        { scopeType: 'BRAND', scopeKey: facts.brandId },
        { scopeType: 'TENANT', scopeKey: facts.tenantId },
        { scopeType: 'STORE', scopeKey: facts.storeId },
        ...[...membership.groups]
            .sort((left, right) => left.rank - right.rank)
            .map(group => ({
            scopeType: 'GROUP',
            scopeKey: group.groupId,
            rank: group.rank,
            priority: group.priority,
        })),
        { scopeType: 'TERMINAL', scopeKey: terminalId },
    ];
    return scopeChain.filter(item => item.scopeKey.trim().length > 0);
};
const loadPolicyLookup = (sandboxId) => {
    const rows = db.select().from(projectionPoliciesTable)
        .where(eq(projectionPoliciesTable.sandboxId, sandboxId))
        .all();
    return new Map(rows.map(item => [
        `${item.topicKey}|${item.itemKey}|${item.scopeType}|${item.scopeKey}`,
        item,
    ]));
};
const loadRelevantProjectionCandidates = (input) => {
    const chainIndex = new Map(input.scopeChain.map((item, index) => [`${item.scopeType}:${item.scopeKey}`, index]));
    const policies = loadPolicyLookup(input.sandboxId);
    const rows = db.select().from(projectionsTable)
        .where(eq(projectionsTable.sandboxId, input.sandboxId))
        .all()
        .filter(item => chainIndex.has(`${item.scopeType}:${item.scopeKey}`));
    return rows.map((item) => {
        const policy = policies.get(`${item.topicKey}|${item.itemKey}|${item.scopeType}|${item.scopeKey}`);
        return {
            topicKey: item.topicKey,
            itemKey: item.itemKey,
            scopeType: item.scopeType,
            scopeKey: item.scopeKey,
            revision: item.revision,
            payload: parseJson(item.payloadJson, {}),
            source: policy ? 'policy' : 'projection',
            policyId: policy?.policyId,
            chainIndex: chainIndex.get(`${item.scopeType}:${item.scopeKey}`) ?? -1,
        };
    });
};
const describeScope = (candidate, scopeChain) => {
    if (candidate.scopeType !== 'GROUP') {
        return candidate.scopeType;
    }
    const group = scopeChain.find(item => item.scopeType === 'GROUP' && item.scopeKey === candidate.scopeKey);
    return group?.rank != null ? `GROUP(rank ${group.rank})` : 'GROUP';
};
const toWinnerReason = (candidates, scopeChain) => {
    const winner = candidates[candidates.length - 1];
    if (!winner) {
        return 'no matching scope';
    }
    if (candidates.length === 1) {
        return `${describeScope(winner, scopeChain)} is the only matching scope`;
    }
    const previous = candidates[candidates.length - 2];
    return `${describeScope(winner, scopeChain)} overrides ${describeScope(previous, scopeChain)}`;
};
const applySimulatedOverride = (input) => {
    const override = input.override;
    if (!override) {
        return input.candidates;
    }
    const chainIndex = input.scopeChain.findIndex(item => item.scopeType === override.scopeType && item.scopeKey === override.scopeKey);
    if (chainIndex < 0) {
        return input.candidates;
    }
    const filtered = input.candidates.filter(item => !(item.topicKey === override.topicKey
        && item.itemKey === override.itemKey
        && item.scopeType === override.scopeType
        && item.scopeKey === override.scopeKey));
    if (override.enabled === false) {
        return filtered;
    }
    const simulatedCandidate = {
        topicKey: override.topicKey,
        itemKey: override.itemKey,
        scopeType: override.scopeType,
        scopeKey: override.scopeKey,
        revision: Math.max(0, ...input.candidates
            .filter(item => item.topicKey === override.topicKey
            && item.itemKey === override.itemKey
            && item.scopeType === override.scopeType
            && item.scopeKey === override.scopeKey)
            .map(item => item.revision)) + 1,
        payload: override.payloadJson ?? {},
        source: 'policy-preview',
        chainIndex,
    };
    return [
        ...filtered,
        simulatedCandidate,
    ];
};
const buildDecisionArtifacts = (input) => {
    assertSandboxUsable(input.sandboxId);
    const runtimeFacts = getTerminalRuntimeFacts(input.sandboxId, input.terminalId);
    const membershipSnapshot = getTerminalGroupMemberships(input.sandboxId, input.terminalId);
    const scopeChain = buildScopeChain({
        terminalId: input.terminalId,
        facts: runtimeFacts,
        membership: membershipSnapshot,
    });
    const allCandidates = applySimulatedOverride({
        candidates: loadRelevantProjectionCandidates({
            sandboxId: input.sandboxId,
            scopeChain,
        }),
        scopeChain,
        override: input.override,
    });
    const grouped = new Map();
    allCandidates.forEach(candidate => {
        const key = `${candidate.topicKey}|${candidate.itemKey}`;
        const bucket = grouped.get(key) ?? [];
        bucket.push(candidate);
        grouped.set(key, bucket);
    });
    const perTopicCandidates = Array.from(grouped.entries())
        .map(([key, rawCandidates]) => {
        const [topicKey, itemKey] = key.split('|');
        const candidates = [...rawCandidates].sort((left, right) => left.chainIndex - right.chainIndex);
        const winner = candidates[candidates.length - 1];
        return {
            topicKey,
            itemKey,
            candidates: candidates.map(item => ({
                scopeType: item.scopeType,
                scopeKey: item.scopeKey,
                revision: item.revision,
                source: item.source,
                policyId: item.policyId,
                payload: item.payload,
            })),
            winner: winner
                ? {
                    scopeType: winner.scopeType,
                    scopeKey: winner.scopeKey,
                    revision: winner.revision,
                    source: winner.source,
                    policyId: winner.policyId,
                    payload: winner.payload,
                    reason: toWinnerReason(candidates, scopeChain),
                }
                : null,
        };
    })
        .sort((left, right) => {
        if (left.topicKey !== right.topicKey) {
            return left.topicKey.localeCompare(right.topicKey);
        }
        return left.itemKey.localeCompare(right.itemKey);
    });
    const resolvedResults = perTopicCandidates.reduce((acc, item) => {
        if (!item.winner) {
            return acc;
        }
        acc[item.topicKey] = acc[item.topicKey] ?? {};
        acc[item.topicKey][item.itemKey] = item.winner.payload;
        return acc;
    }, {});
    return {
        terminalId: input.terminalId,
        runtimeFacts,
        membershipSnapshot,
        scopeChain,
        perTopicCandidates,
        resolvedResults,
    };
};
const resolveTargetTerminalIdsForScope = (input) => {
    if (input.scopeType === 'TERMINAL') {
        return [input.scopeKey];
    }
    const terminals = db.select().from(terminalsTable)
        .where(eq(terminalsTable.sandboxId, input.sandboxId))
        .all();
    switch (input.scopeType) {
        case 'STORE':
            return terminals.filter(item => item.storeId === input.scopeKey).map(item => item.terminalId);
        case 'TENANT':
            return terminals.filter(item => item.tenantId === input.scopeKey).map(item => item.terminalId);
        case 'BRAND':
            return terminals.filter(item => item.brandId === input.scopeKey).map(item => item.terminalId);
        case 'PROJECT':
            return terminals.filter(item => item.projectId === input.scopeKey).map(item => item.terminalId);
        case 'PLATFORM':
            return terminals.filter(item => item.platformId === input.scopeKey).map(item => item.terminalId);
        case 'GROUP':
            return db.select().from(terminalsTable)
                .where(eq(terminalsTable.sandboxId, input.sandboxId))
                .all()
                .map(item => item.terminalId)
                .filter(terminalId => getTerminalGroupMemberships(input.sandboxId, terminalId).groups.some(group => group.groupId === input.scopeKey));
        default:
            return [];
    }
};
const classifyImpact = (input) => {
    if (!input.current && input.next) {
        return 'new-winner';
    }
    if (input.current && !input.next) {
        return 'winner-removed';
    }
    if (!input.current && !input.next) {
        return 'unchanged-empty';
    }
    const currentScope = `${input.current?.scopeType ?? ''}:${input.current?.scopeKey ?? ''}`;
    const nextScope = `${input.next?.scopeType ?? ''}:${input.next?.scopeKey ?? ''}`;
    if (currentScope !== nextScope) {
        return 'winner-scope-changed';
    }
    return 'winner-payload-changed';
};
export const getTerminalDecisionTrace = (input) => {
    const result = buildDecisionArtifacts(input);
    return {
        terminalId: result.terminalId,
        runtimeFacts: result.runtimeFacts,
        membershipSnapshot: result.membershipSnapshot,
        perTopicCandidates: result.perTopicCandidates,
        resolvedResults: result.resolvedResults,
    };
};
export const getTerminalResolvedTopics = (input) => {
    const result = buildDecisionArtifacts(input);
    return {
        terminalId: result.terminalId,
        resolvedResults: result.resolvedResults,
    };
};
export const getTerminalTopicDecision = (input) => {
    const result = buildDecisionArtifacts(input);
    return {
        terminalId: result.terminalId,
        topicKey: input.topicKey,
        items: result.perTopicCandidates.filter(item => item.topicKey === input.topicKey),
    };
};
export const previewPolicyImpact = (input) => {
    assertSandboxUsable(input.sandboxId);
    const targetTerminalIds = resolveTargetTerminalIdsForScope({
        sandboxId: input.sandboxId,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
    });
    const impacts = targetTerminalIds.map(terminalId => {
        const current = buildDecisionArtifacts({
            sandboxId: input.sandboxId,
            terminalId,
        }).perTopicCandidates.find(item => item.topicKey === input.topicKey && item.itemKey === input.itemKey)?.winner ?? null;
        const next = buildDecisionArtifacts({
            sandboxId: input.sandboxId,
            terminalId,
            override: {
                topicKey: input.topicKey,
                itemKey: input.itemKey,
                scopeType: input.scopeType,
                scopeKey: input.scopeKey,
                enabled: input.enabled,
                payloadJson: input.payloadJson,
            },
        }).perTopicCandidates.find(item => item.topicKey === input.topicKey && item.itemKey === input.itemKey)?.winner ?? null;
        const changed = JSON.stringify(current) !== JSON.stringify(next);
        return {
            terminalId,
            changed,
            reason: changed ? classifyImpact({ current, next }) : 'unchanged',
            currentWinner: current,
            nextWinner: next,
        };
    });
    const changedTerminalCount = impacts.filter(item => item.changed).length;
    return {
        topicKey: input.topicKey,
        itemKey: input.itemKey,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        targetTerminalCount: impacts.length,
        changedTerminalCount,
        warnings: [
            ...(impacts.length === 0 ? ['NO_TARGET_TERMINALS'] : []),
            ...(changedTerminalCount > 100 ? ['IMPACT_LARGE'] : []),
            ...(input.scopeType === 'GROUP' ? ['GROUP_SCOPE_OVERRIDES_STORE_AND_LOWER_DEFAULTS'] : []),
        ],
        impacts,
    };
};
