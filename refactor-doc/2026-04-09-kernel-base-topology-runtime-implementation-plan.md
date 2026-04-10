# Kernel Base Topology Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first owner-ledger based topology runtime so request truth, request projection, and compatibility evaluation no longer depend on old cross-machine slice merging.

**Architecture:** `topology-runtime` owns owner-ledger, request node lifecycle transitions, request projection building, and compatibility evaluation. This first phase stays local and protocol-driven: it accepts dispatch/event envelopes and updates owner truth, but it does not implement real transport channels or host relay logic.

**Tech Stack:** TypeScript 5, Yarn workspace package, `@impos2/kernel-base-contracts`, `@impos2/kernel-base-platform-ports`, `@impos2/kernel-base-execution-runtime`, package-local `tsx` dev verification

---

## File Map

### `1-kernel/1.1-base/topology-runtime`

**Create:**

- `1-kernel/1.1-base/topology-runtime/src/foundations/compatibility.ts`

**Modify:**

- `1-kernel/1.1-base/topology-runtime/package.json`
- `1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts`
- `1-kernel/1.1-base/topology-runtime/src/foundations/index.ts`
- `1-kernel/1.1-base/topology-runtime/src/foundations/ownerLedger.ts`
- `1-kernel/1.1-base/topology-runtime/src/foundations/projectionBuilder.ts`
- `1-kernel/1.1-base/topology-runtime/src/index.ts`
- `1-kernel/1.1-base/topology-runtime/src/types/index.ts`
- `1-kernel/1.1-base/topology-runtime/src/types/ownerLedger.ts`
- `1-kernel/1.1-base/topology-runtime/src/types/runtime.ts`
- `1-kernel/1.1-base/topology-runtime/dev/index.ts`

---

### Task 1: Define owner-ledger and topology runtime contracts

**Files:**

- Modify: `1-kernel/1.1-base/topology-runtime/src/types/ownerLedger.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/types/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/dev/index.ts`

- [ ] **Step 1: Replace placeholder dev verification with owner-ledger scenario assertions**

```ts
import {
  createOwnerLedger,
  createTopologyRuntime,
} from '../src'
import {
  createCommandId,
  createEnvelopeId,
  createNodeId,
  createRequestId,
  createSessionId,
} from '@impos2/kernel-base-contracts'

const ownerNodeId = createNodeId()
const targetNodeId = createNodeId()
const requestId = createRequestId()
const rootCommandId = createCommandId()
const childCommandId = createCommandId()

const topology = createTopologyRuntime({
  localNodeId: ownerNodeId,
})

topology.registerRootRequest({
  requestId,
  rootCommandId,
  ownerNodeId,
  sourceNodeId: ownerNodeId,
  commandName: 'kernel.base.topology-runtime.dev.root',
})

topology.registerChildDispatch({
  envelopeId: createEnvelopeId(),
  sessionId: createSessionId(),
  requestId,
  commandId: childCommandId,
  parentCommandId: rootCommandId,
  ownerNodeId,
  sourceNodeId: ownerNodeId,
  targetNodeId,
  commandName: 'kernel.base.topology-runtime.dev.remote',
  payload: {step: 'child'},
  context: {},
  sentAt: Date.now(),
})

const projection = topology.getRequestProjection(requestId)
if (!projection || projection.pendingCommandCount !== 2) {
  throw new Error('Owner-ledger projection bootstrap failed')
}
```

- [ ] **Step 2: Run dev to verify it fails before implementation**

Run: `corepack yarn workspace @impos2/kernel-base-topology-runtime dev`

Expected: fail with missing exports such as `createTopologyRuntime` or `registerRootRequest`

- [ ] **Step 3: Implement owner-ledger contracts**

```ts
export type OwnerCommandNodeStatus =
  | 'registered'
  | 'dispatched'
  | 'accepted'
  | 'started'
  | 'complete'
  | 'error'

export interface OwnerCommandNode {
  commandId: CommandId
  requestId: RequestId
  ownerNodeId: NodeId
  sourceNodeId: NodeId
  targetNodeId: NodeId
  commandName: string
  parentCommandId?: CommandId
  status: OwnerCommandNodeStatus
  result?: Record<string, unknown>
  error?: AppError
  startedAt?: TimestampMs
  updatedAt: TimestampMs
}

export interface OwnerLedgerRecord {
  requestId: RequestId
  ownerNodeId: NodeId
  rootCommandId: CommandId
  startedAt: TimestampMs
  updatedAt: TimestampMs
  nodes: Record<string, OwnerCommandNode>
}
```

- [ ] **Step 4: Define topology runtime public API**

```ts
export interface TopologyRuntime {
  registerRootRequest(input: RegisterRootRequestInput): OwnerLedgerRecord
  registerChildDispatch(envelope: CommandDispatchEnvelope): OwnerLedgerRecord
  applyCommandEvent(envelope: CommandEventEnvelope): OwnerLedgerRecord
  getRequestRecord(requestId: RequestId): OwnerLedgerRecord | undefined
  getRequestProjection(requestId: RequestId): RequestProjection | undefined
  evaluateCompatibility(input: CompatibilityEvaluationInput): CompatibilityDecision
}
```

---

### Task 2: Implement owner-ledger and projection builder

**Files:**

- Modify: `1-kernel/1.1-base/topology-runtime/src/foundations/ownerLedger.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/foundations/projectionBuilder.ts`

- [ ] **Step 1: Implement in-memory owner-ledger**

```ts
export const createOwnerLedger = (): OwnerLedger => {
  const records = new Map<RequestId, OwnerLedgerRecord>()

  return {
    registerRootRequest(input) {
      if (records.has(input.requestId)) {
        throw new Error(`Request already registered: ${input.requestId}`)
      }
      // create record + root node
    },
    registerChildDispatch(envelope) {
      // require owner record exists
      // require parentCommandId already known when present
      // insert child node as dispatched
    },
    applyCommandEvent(envelope) {
      // only update known node
      // accepted/started/completed/failed/resultPatch update node
    },
  }
}
```

- [ ] **Step 2: Implement request projection builder**

```ts
export const buildRequestProjection = (
  record: OwnerLedgerRecord,
): RequestProjection => {
  const nodes = Object.values(record.nodes)
  const hasError = nodes.some(node => node.status === 'error')
  const allTerminal = nodes.every(node => node.status === 'complete' || node.status === 'error')

  return {
    requestId: record.requestId,
    ownerNodeId: record.ownerNodeId,
    status: hasError ? 'error' : allTerminal ? 'complete' : 'started',
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    resultsByCommand: Object.fromEntries(
      nodes.filter(node => node.result).map(node => [node.commandId, node.result!]),
    ),
    mergedResults: Object.assign({}, ...nodes.map(node => node.result ?? {})),
    errorsByCommand: Object.fromEntries(
      nodes
        .filter(node => node.error)
        .map(node => [node.commandId, {key: node.error!.key, code: node.error!.code, message: node.error!.message}]),
    ),
    pendingCommandCount: nodes.filter(node => node.status !== 'complete' && node.status !== 'error').length,
  }
}
```

- [ ] **Step 3: Run package verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-topology-runtime type-check
corepack yarn workspace @impos2/kernel-base-topology-runtime dev
```

Expected:

1. owner-ledger root and child registration succeed
2. initial projection pending count reflects registered nodes

---

### Task 3: Implement compatibility evaluator and topology runtime assembly

**Files:**

- Create: `1-kernel/1.1-base/topology-runtime/src/foundations/compatibility.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/foundations/createTopologyRuntime.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/src/index.ts`
- Modify: `1-kernel/1.1-base/topology-runtime/package.json`
- Modify: `1-kernel/1.1-base/topology-runtime/dev/index.ts`

- [ ] **Step 1: Remove premature transport dependency**

Update `package.json` to keep only dependencies needed for this first phase:

```json
{
  "dependencies": {
    "@impos2/kernel-base-contracts": "*",
    "@impos2/kernel-base-platform-ports": "*",
    "@impos2/kernel-base-execution-runtime": "*"
  }
}
```

- [ ] **Step 2: Implement compatibility evaluation**

```ts
export interface CompatibilityEvaluationInput {
  localProtocolVersion: string
  peerProtocolVersion: string
  localCapabilities: readonly string[]
  peerCapabilities: readonly string[]
  requiredCapabilities?: readonly string[]
  localRuntimeVersion?: string
  peerRuntimeVersion?: string
}

export const evaluateCompatibility = (
  input: CompatibilityEvaluationInput,
): CompatibilityDecision => {
  if (input.localProtocolVersion !== input.peerProtocolVersion) {
    return {
      level: 'rejected',
      reasons: ['protocolVersion mismatch'],
      enabledCapabilities: [],
      disabledCapabilities: [...input.peerCapabilities],
    }
  }
  // required capabilities -> rejected
  // runtime version mismatch -> degraded
  // else full
}
```

- [ ] **Step 3: Implement `createTopologyRuntime(...)`**

```ts
export const createTopologyRuntime = (
  input: CreateTopologyRuntimeInput,
): TopologyRuntime => {
  const ledger = createOwnerLedger()

  return {
    registerRootRequest: ledger.registerRootRequest,
    registerChildDispatch: ledger.registerChildDispatch,
    applyCommandEvent: ledger.applyCommandEvent,
    getRequestRecord: ledger.getRequestRecord,
    getRequestProjection(requestId) {
      const record = ledger.getRequestRecord(requestId)
      return record ? buildRequestProjection(record) : undefined
    },
    evaluateCompatibility: evaluation => evaluateCompatibility({
      localProtocolVersion: input.localProtocolVersion,
      localCapabilities: input.localCapabilities,
      localRuntimeVersion: input.localRuntimeVersion,
      ...evaluation,
    }),
  }
}
```

- [ ] **Step 4: Extend dev verification with remote event flow**

```ts
topology.applyCommandEvent({
  envelopeId: createEnvelopeId(),
  sessionId,
  requestId,
  commandId: childCommandId,
  ownerNodeId,
  sourceNodeId: targetNodeId,
  eventType: 'started',
  occurredAt: Date.now(),
})

topology.applyCommandEvent({
  envelopeId: createEnvelopeId(),
  sessionId,
  requestId,
  commandId: childCommandId,
  ownerNodeId,
  sourceNodeId: targetNodeId,
  eventType: 'completed',
  result: {remote: 'done'},
  occurredAt: Date.now(),
})
```

- [ ] **Step 5: Run final package verification**

Run:

```bash
corepack yarn install
corepack yarn workspace @impos2/kernel-base-topology-runtime type-check
corepack yarn workspace @impos2/kernel-base-topology-runtime dev
```

Expected:

1. package resolves in workspace
2. root + child nodes can be tracked by owner-ledger
3. completed remote event updates projection results
4. compatibility evaluation returns deterministic output

---

## Self-Review

### Spec coverage

本计划已覆盖 `topology-runtime` 第一阶段核心职责：

1. owner-ledger
2. request projection 构建
3. command dispatch / command event 本地接线
4. compatibility decision

### Placeholder scan

已检查：

1. 无 `TBD`
2. 无“后续再细化”
3. 文件路径、对象、验证命令均已明确

### Type consistency

计划中的核心命名已统一为：

1. `OwnerCommandNode`
2. `OwnerLedgerRecord`
3. `TopologyRuntime`
4. `buildRequestProjection`
5. `evaluateCompatibility`
6. `createTopologyRuntime`
