# Kernel Base Execution Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runtime-scoped command execution kernel that replaces the old global `commandBus + ActorSystem` model for local execution only.

**Architecture:** `execution-runtime` will own local command dispatch, handler registration, synchronous lifecycle start bookkeeping, middleware chaining, and execution journal emission. This phase explicitly excludes owner-ledger, remote dispatch, and projection mirror, which belong to `topology-runtime`.

**Tech Stack:** TypeScript 5, Yarn workspace package, `@impos2/kernel-base-contracts`, `@impos2/kernel-base-platform-ports`, `@impos2/kernel-base-definition-registry`, package-local `tsx` dev verification

---

## File Map

### `1-kernel/1.1-base/execution-runtime`

**Create:**

- `1-kernel/1.1-base/execution-runtime/src/foundations/command.ts`
- `1-kernel/1.1-base/execution-runtime/src/foundations/journal.ts`

**Modify:**

- `1-kernel/1.1-base/execution-runtime/src/foundations/createExecutionRuntime.ts`
- `1-kernel/1.1-base/execution-runtime/src/foundations/index.ts`
- `1-kernel/1.1-base/execution-runtime/src/index.ts`
- `1-kernel/1.1-base/execution-runtime/src/types/index.ts`
- `1-kernel/1.1-base/execution-runtime/src/types/execution.ts`
- `1-kernel/1.1-base/execution-runtime/src/types/journal.ts`
- `1-kernel/1.1-base/execution-runtime/src/types/runtime.ts`
- `1-kernel/1.1-base/execution-runtime/dev/index.ts`

---

### Task 1: Define execution runtime contracts

**Files:**

- Create: `1-kernel/1.1-base/execution-runtime/src/foundations/command.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/execution.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/index.ts`

- [ ] **Step 1: Replace placeholder dev verification with synchronous lifecycle assertions**

```ts
import {
  createExecutionRuntime,
  createExecutionCommand,
} from '../src'
import {createCommandId, createRequestId} from '@impos2/kernel-base-contracts'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'

const lifecycle: string[] = []

const runtime = createExecutionRuntime({
  logger: createLoggerPort({
    environmentMode: 'DEV',
    write: () => {},
    scope: {moduleName: 'kernel.base.execution-runtime.dev', layer: 'kernel'},
  }),
  onLifecycleEvent: event => {
    lifecycle.push(event.eventType)
  },
})

runtime.registerHandler('kernel.base.execution-runtime.dev.echo', async command => {
  return {echo: command.payload}
})

await runtime.execute(
  createExecutionCommand({
    commandId: createCommandId(),
    requestId: createRequestId(),
    commandName: 'kernel.base.execution-runtime.dev.echo',
    payload: {ok: true},
  }),
)

if (lifecycle[0] !== 'started') {
  throw new Error('Request lifecycle must start synchronously before handler body')
}
```

- [ ] **Step 2: Run dev to verify it fails before implementation**

Run: `corepack yarn workspace @impos2/kernel-base-execution-runtime dev`

Expected: fail with missing exports such as `createExecutionRuntime` or `createExecutionCommand`

- [ ] **Step 3: Implement minimal command and execution contracts**

```ts
// execution.ts
export interface ExecutionCommand<TPayload = unknown> {
  commandId: CommandId
  requestId: RequestId
  sessionId?: SessionId
  commandName: string
  payload: TPayload
  context?: CommandRouteContext
  parentCommandId?: CommandId
  internal?: boolean
}

export interface ExecutionContext {
  command: ExecutionCommand
  dispatchChild(command: ExecutionCommand): Promise<ExecutionResult>
}

export interface ExecutionLifecycleEvent {
  eventType: 'started' | 'completed' | 'failed'
  commandId: CommandId
  requestId: RequestId
  commandName: string
  occurredAt: TimestampMs
}
```

```ts
// runtime.ts
export interface ExecutionRuntime {
  registerHandler(
    commandName: string,
    handler: ExecutionHandler,
  ): void
  execute(command: ExecutionCommand): Promise<ExecutionResult>
}
```

- [ ] **Step 4: Run type-check to ensure contracts compile**

Run: `corepack yarn workspace @impos2/kernel-base-execution-runtime type-check`

Expected: fail only until runtime factory implementation is still missing

---

### Task 2: Implement runtime factory and journal

**Files:**

- Create: `1-kernel/1.1-base/execution-runtime/src/foundations/journal.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/foundations/createExecutionRuntime.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/journal.ts`

- [ ] **Step 1: Implement in-memory execution journal**

```ts
export interface ExecutionJournalRecord {
  eventType: 'started' | 'completed' | 'failed'
  commandId: CommandId
  requestId: RequestId
  commandName: string
  occurredAt: TimestampMs
}

export const createExecutionJournal = () => {
  const records: ExecutionJournalRecord[] = []

  return {
    append(record: ExecutionJournalRecord) {
      records.push(record)
    },
    list() {
      return [...records]
    },
  }
}
```

- [ ] **Step 2: Implement local runtime-scoped execution**

```ts
export const createExecutionRuntime = (
  input: CreateExecutionRuntimeInput,
): ExecutionRuntime => {
  const handlers = new Map<string, ExecutionHandler>()
  const journal = createExecutionJournal()

  return {
    registerHandler(commandName, handler) {
      if (handlers.has(commandName)) {
        throw new Error(`Duplicated handler: ${commandName}`)
      }
      handlers.set(commandName, handler)
    },
    async execute(command) {
      const handler = handlers.get(command.commandName)
      if (!handler) {
        throw new Error(`Handler not found: ${command.commandName}`)
      }

      const startedEvent = createLifecycleEvent('started', command)
      journal.append(startedEvent)
      input.onLifecycleEvent?.(startedEvent)

      try {
        const result = await handler({
          command,
          dispatchChild: child => this.execute(child),
        })

        const completedEvent = createLifecycleEvent('completed', command)
        journal.append(completedEvent)
        input.onLifecycleEvent?.(completedEvent)

        return {status: 'completed', result}
      } catch (error) {
        const failedEvent = createLifecycleEvent('failed', command)
        journal.append(failedEvent)
        input.onLifecycleEvent?.(failedEvent)
        throw error
      }
    },
  }
}
```

- [ ] **Step 3: Run dev and type-check**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-execution-runtime type-check
corepack yarn workspace @impos2/kernel-base-execution-runtime dev
```

Expected:

1. `type-check` passes
2. `dev` confirms the first lifecycle event is `started`

---

### Task 3: Add middleware and internal command lane

**Files:**

- Modify: `1-kernel/1.1-base/execution-runtime/src/foundations/createExecutionRuntime.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/execution.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/src/types/runtime.ts`
- Modify: `1-kernel/1.1-base/execution-runtime/dev/index.ts`

- [ ] **Step 1: Add execution middleware contracts**

```ts
export interface ExecutionMiddleware {
  name: string
  handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>
}
```

- [ ] **Step 2: Add internal command helper and middleware chain**

```ts
export const createInternalExecutionCommand = (
  input: Omit<ExecutionCommand, 'internal'>,
): ExecutionCommand => ({
  ...input,
  internal: true,
})
```

```ts
const runWithMiddlewares = async (
  context: ExecutionContext,
  handler: () => Promise<ExecutionResult>,
) => {
  let index = -1

  const dispatch = async (cursor: number): Promise<ExecutionResult> => {
    if (cursor <= index) {
      throw new Error('Execution middleware chain re-entry is not allowed')
    }
    index = cursor

    const middleware = middlewares[cursor]
    if (!middleware) {
      return handler()
    }

    return middleware.handle(context, () => dispatch(cursor + 1))
  }

  return dispatch(0)
}
```

- [ ] **Step 3: Extend dev verification to cover internal lane**

```ts
const internalEvents = await runtime.execute(
  createInternalExecutionCommand({
    commandId: createCommandId(),
    requestId: INTERNAL_REQUEST_ID,
    sessionId: INTERNAL_SESSION_ID,
    commandName: 'kernel.base.execution-runtime.dev.echo',
    payload: {internal: true},
  }),
)
```

- [ ] **Step 4: Run final package verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-execution-runtime type-check
corepack yarn workspace @impos2/kernel-base-execution-runtime dev
```

Expected:

1. middleware chain passes
2. internal command path is executable
3. request start remains synchronous

---

## Self-Review

### Spec coverage

本计划已覆盖 `execution-runtime` 第一阶段要求：

1. 本机 command 注册与执行
2. 本机 lifecycle event 发射
3. 本机同步登记起点
4. child command 显式 dispatchChild
5. internal command lane

### Placeholder scan

已检查：

1. 无 `TBD`
2. 无“后续补充细节”
3. 文件路径、命令、目标对象均已明确

### Type consistency

计划中的核心命名已统一为：

1. `ExecutionCommand`
2. `ExecutionContext`
3. `ExecutionRuntime`
4. `ExecutionMiddleware`
5. `ExecutionJournalRecord`
6. `createExecutionRuntime`
7. `createExecutionCommand`
8. `createInternalExecutionCommand`
