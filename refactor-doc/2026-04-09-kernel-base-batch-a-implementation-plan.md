# Kernel Base Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real implementation for `contracts`, `platform-ports`, and `definition-registry`, so the new kernel base layer has stable public contracts before runtime packages start.

**Architecture:** `contracts` owns shared language only, including time, runtime ID, request/topology protocol objects, and module manifest contracts. `platform-ports` owns runtime-scoped host port contracts and structured logging contracts. `definition-registry` owns only definition registration and query, without taking on runtime store/catalog responsibilities.

**Tech Stack:** TypeScript 5, Yarn workspace packages, `tsx` dev verification entries, package-local `tsc --noEmit` type-check

---

## File Map

### `1-kernel/1.1-base/contracts`

**Create:**

- `1-kernel/1.1-base/contracts/src/foundations/time.ts`
- `1-kernel/1.1-base/contracts/src/foundations/runtimeId.ts`
- `1-kernel/1.1-base/contracts/src/foundations/error.ts`
- `1-kernel/1.1-base/contracts/src/types/error.ts`
- `1-kernel/1.1-base/contracts/src/types/parameter.ts`

**Modify:**

- `1-kernel/1.1-base/contracts/src/foundations/index.ts`
- `1-kernel/1.1-base/contracts/src/index.ts`
- `1-kernel/1.1-base/contracts/src/protocol/index.ts`
- `1-kernel/1.1-base/contracts/src/types/index.ts`
- `1-kernel/1.1-base/contracts/src/types/ids.ts`
- `1-kernel/1.1-base/contracts/src/types/module.ts`
- `1-kernel/1.1-base/contracts/src/types/request.ts`
- `1-kernel/1.1-base/contracts/src/types/command.ts`
- `1-kernel/1.1-base/contracts/src/types/topology.ts`
- `1-kernel/1.1-base/contracts/src/types/compatibility.ts`
- `1-kernel/1.1-base/contracts/src/types/projection.ts`
- `1-kernel/1.1-base/contracts/dev/index.ts`

### `1-kernel/1.1-base/platform-ports`

**Create:**

- `1-kernel/1.1-base/platform-ports/src/foundations/logger.ts`
- `1-kernel/1.1-base/platform-ports/src/types/logging.ts`

**Modify:**

- `1-kernel/1.1-base/platform-ports/src/foundations/index.ts`
- `1-kernel/1.1-base/platform-ports/src/foundations/createPlatformPorts.ts`
- `1-kernel/1.1-base/platform-ports/src/index.ts`
- `1-kernel/1.1-base/platform-ports/src/types/index.ts`
- `1-kernel/1.1-base/platform-ports/src/types/ports.ts`
- `1-kernel/1.1-base/platform-ports/dev/index.ts`

### `1-kernel/1.1-base/definition-registry`

**Modify:**

- `1-kernel/1.1-base/definition-registry/src/foundations/index.ts`
- `1-kernel/1.1-base/definition-registry/src/foundations/registry.ts`
- `1-kernel/1.1-base/definition-registry/src/index.ts`
- `1-kernel/1.1-base/definition-registry/src/types/index.ts`
- `1-kernel/1.1-base/definition-registry/src/types/definition.ts`
- `1-kernel/1.1-base/definition-registry/src/types/registry.ts`
- `1-kernel/1.1-base/definition-registry/dev/index.ts`

---

### Task 1: Implement `contracts`

**Files:**

- Create: `1-kernel/1.1-base/contracts/src/foundations/time.ts`
- Create: `1-kernel/1.1-base/contracts/src/foundations/runtimeId.ts`
- Create: `1-kernel/1.1-base/contracts/src/foundations/error.ts`
- Create: `1-kernel/1.1-base/contracts/src/types/error.ts`
- Create: `1-kernel/1.1-base/contracts/src/types/parameter.ts`
- Modify: `1-kernel/1.1-base/contracts/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/contracts/src/index.ts`
- Modify: `1-kernel/1.1-base/contracts/src/protocol/index.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/index.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/ids.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/module.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/request.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/command.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/topology.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/compatibility.ts`
- Modify: `1-kernel/1.1-base/contracts/src/types/projection.ts`
- Modify: `1-kernel/1.1-base/contracts/dev/index.ts`

- [ ] **Step 1: Replace placeholder dev verification with real contract assertions**

```ts
import {
  INTERNAL_REQUEST_ID,
  createAppError,
  createCommandId,
  createRequestId,
  formatTimestampMs,
  nowTimestampMs,
  protocolVersion,
} from '../src'

const requestId = createRequestId()
const commandId = createCommandId()
const timestamp = nowTimestampMs()

if (!requestId || !commandId) {
  throw new Error('Runtime ID generation failed')
}

if (!formatTimestampMs(timestamp)) {
  throw new Error('Timestamp formatting failed')
}

const appError = createAppError(
  {
    key: 'kernel.base.contracts.dev_error',
    name: 'Dev Error',
    defaultTemplate: 'request ${requestId} failed',
    category: 'SYSTEM',
    severity: 'LOW',
  },
  {
    args: {requestId},
    context: {requestId, commandId},
  },
)

if (appError.requestId !== requestId) {
  throw new Error('AppError context binding failed')
}

console.log('[contracts-dev]', {
  protocolVersion,
  requestId,
  commandId,
  internalRequestId: INTERNAL_REQUEST_ID,
  timestamp,
})
```

- [ ] **Step 2: Run dev to verify it fails before implementation**

Run: `corepack yarn workspace @impos2/kernel-base-contracts dev`

Expected: fail with missing exports such as `createRequestId`, `createAppError`, or `INTERNAL_REQUEST_ID`

- [ ] **Step 3: Implement minimal public contracts and helpers**

```ts
// ids.ts
export type TimestampMs = number
export type RequestId = string & {readonly __brand: 'RequestId'}
export type CommandId = string & {readonly __brand: 'CommandId'}
export type SessionId = string & {readonly __brand: 'SessionId'}
export type NodeId = string & {readonly __brand: 'NodeId'}
export type EnvelopeId = string & {readonly __brand: 'EnvelopeId'}
export type DispatchId = string & {readonly __brand: 'DispatchId'}
export type ProjectionId = string & {readonly __brand: 'ProjectionId'}

export type RuntimeIdKind =
  | 'request'
  | 'command'
  | 'session'
  | 'node'
  | 'envelope'
  | 'dispatch'
  | 'projection'

export const INTERNAL_REQUEST_ID = 'INTERNAL' as RequestId
export const INTERNAL_SESSION_ID = 'INTERNAL' as SessionId
```

```ts
// foundations/time.ts
export const nowTimestampMs = (): TimestampMs => Date.now()

export const formatTimestampMs = (timestamp: TimestampMs): string => {
  const value = new Date(timestamp)
  const pad2 = (input: number) => String(input).padStart(2, '0')
  const pad3 = (input: number) => String(input).padStart(3, '0')

  return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())} ${pad3(value.getMilliseconds())}`
}
```

```ts
// foundations/runtimeId.ts
const KIND_PREFIX: Record<RuntimeIdKind, string> = {
  request: 'req',
  command: 'cmd',
  session: 'ses',
  node: 'nod',
  envelope: 'env',
  dispatch: 'dsp',
  projection: 'prj',
}

export const createRuntimeId = <TId extends string>(kind: RuntimeIdKind): TId =>
  `${KIND_PREFIX[kind]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` as TId
```

```ts
// foundations/error.ts
export const renderErrorTemplate = (
  template: string,
  args?: Record<string, unknown>,
): string =>
  template.replace(/\$\{([\s\S]+?)\}/g, (_match, key) => String(args?.[String(key).trim()] ?? ''))

export const createAppError = (
  definition: ErrorDefinition,
  input: CreateAppErrorInput = {},
): AppError => ({
  name: definition.name,
  key: definition.key,
  code: definition.code ?? definition.key,
  message: renderErrorTemplate(definition.defaultTemplate, input.args),
  category: definition.category,
  severity: definition.severity,
  createdAt: nowTimestampMs(),
  ...input.context,
  details: input.details,
})
```

- [ ] **Step 4: Implement protocol objects and module manifest contracts**

```ts
// module.ts
export interface AppModuleDependency {
  moduleName: string
  optional?: boolean
}

export interface AppModule {
  moduleName: string
  packageVersion: string
  protocolVersion?: string
  dependencies?: readonly AppModuleDependency[]
  errorDefinitions?: readonly ErrorDefinition[]
  parameterDefinitions?: readonly ParameterDefinition[]
  commands?: readonly {name: string; visibility?: 'public' | 'internal'}[]
  actors?: readonly {name: string}[]
  middlewares?: readonly {name: string; priority?: number}[]
  slices?: readonly {name: string; persistIntent?: 'never' | 'owner-only'}[]
}
```

```ts
// topology.ts / compatibility.ts / command.ts / projection.ts
export interface CompatibilityDecision {
  level: 'full' | 'degraded' | 'rejected'
  reasons: string[]
  enabledCapabilities: string[]
  disabledCapabilities: string[]
}
```

```ts
export interface CommandDispatchEnvelope {
  envelopeId: EnvelopeId
  sessionId: SessionId
  requestId: RequestId
  commandId: CommandId
  ownerNodeId: NodeId
  sourceNodeId: NodeId
  targetNodeId: NodeId
  commandName: string
  payload: unknown
  sentAt: TimestampMs
}
```

- [ ] **Step 5: Run package verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-contracts type-check
corepack yarn workspace @impos2/kernel-base-contracts dev
```

Expected:

1. `type-check` passes
2. `dev` prints generated IDs, formatted timestamp, and protocol version

---

### Task 2: Implement `platform-ports`

**Files:**

- Create: `1-kernel/1.1-base/platform-ports/src/foundations/logger.ts`
- Create: `1-kernel/1.1-base/platform-ports/src/types/logging.ts`
- Modify: `1-kernel/1.1-base/platform-ports/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/platform-ports/src/foundations/createPlatformPorts.ts`
- Modify: `1-kernel/1.1-base/platform-ports/src/index.ts`
- Modify: `1-kernel/1.1-base/platform-ports/src/types/index.ts`
- Modify: `1-kernel/1.1-base/platform-ports/src/types/ports.ts`
- Modify: `1-kernel/1.1-base/platform-ports/dev/index.ts`

- [ ] **Step 1: Replace placeholder dev verification with logger and port assertions**

```ts
import {
  createLoggerPort,
  createPlatformPorts,
  type LogEvent,
} from '../src'

const events: LogEvent[] = []

const logger = createLoggerPort({
  environmentMode: 'PROD',
  write: event => {
    events.push(event)
  },
  scope: {
    moduleName: 'kernel.base.platform-ports.dev',
    layer: 'kernel',
  },
})

logger.info({
  category: 'runtime.lifecycle',
  event: 'dev-verification',
  message: 'hello',
  data: {token: 'secret-token'},
})

const ports = createPlatformPorts({
  environmentMode: 'PROD',
  logger,
})

if (!ports.logger) {
  throw new Error('PlatformPorts logger missing')
}

if (events[0]?.security.maskingMode !== 'masked') {
  throw new Error('PROD logging should be masked')
}
```

- [ ] **Step 2: Run dev to verify it fails before implementation**

Run: `corepack yarn workspace @impos2/kernel-base-platform-ports dev`

Expected: fail with missing exports such as `createLoggerPort`, `LogEvent`, or `createPlatformPorts`

- [ ] **Step 3: Implement logging contracts and helpers**

```ts
// logging.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogEnvironmentMode = 'DEV' | 'PROD' | 'TEST'
export type LogMaskingMode = 'raw' | 'masked'

export interface LogScope {
  moduleName: string
  layer?: 'kernel' | 'ui' | 'adapter' | 'assembly' | 'mock-server'
  subsystem?: string
  component?: string
}

export interface LogEvent {
  timestamp: TimestampMs
  level: LogLevel
  category: string
  event: string
  message?: string
  scope: LogScope
  context?: {
    requestId?: RequestId
    commandId?: CommandId
    sessionId?: SessionId
    nodeId?: NodeId
    peerNodeId?: NodeId
  }
  data?: Record<string, unknown>
  security: {
    containsSensitiveRaw: boolean
    maskingMode: LogMaskingMode
  }
}
```

```ts
// logger.ts
export interface LoggerPort {
  emit(event: LogEvent): void
  debug(input: LogWriteInput): void
  info(input: LogWriteInput): void
  warn(input: LogWriteInput): void
  error(input: LogWriteInput): void
  scope(binding: Partial<LogScope>): LoggerPort
  withContext(context: LogContext): LoggerPort
}
```

- [ ] **Step 4: Implement runtime-scoped `PlatformPorts` container**

```ts
// ports.ts
export interface StateStoragePort {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  getAllKeys?(): Promise<string[]>
  clear?(): Promise<void>
}

export interface DevicePort {
  getDeviceId(): Promise<string>
  getPlatform(): Promise<string>
  getModel?(): Promise<string>
}

export interface AppControlPort {
  restartApp(): Promise<void>
  clearDataCache?(): Promise<void>
  switchServerSpace?(serverSpace: string): Promise<void>
}

export interface PlatformPorts {
  environmentMode: LogEnvironmentMode
  logger: LoggerPort
  stateStorage?: StateStoragePort
  device?: DevicePort
  appControl?: AppControlPort
  localWebServer?: LocalWebServerPort
}
```

```ts
// createPlatformPorts.ts
export const createPlatformPorts = (
  input: CreatePlatformPortsInput,
): PlatformPorts => Object.freeze({...input})
```

- [ ] **Step 5: Run package verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-platform-ports type-check
corepack yarn workspace @impos2/kernel-base-platform-ports dev
```

Expected:

1. `type-check` passes
2. `dev` verifies PROD mode logging becomes masked

---

### Task 3: Implement `definition-registry`

**Files:**

- Modify: `1-kernel/1.1-base/definition-registry/src/foundations/index.ts`
- Modify: `1-kernel/1.1-base/definition-registry/src/foundations/registry.ts`
- Modify: `1-kernel/1.1-base/definition-registry/src/index.ts`
- Modify: `1-kernel/1.1-base/definition-registry/src/types/index.ts`
- Modify: `1-kernel/1.1-base/definition-registry/src/types/definition.ts`
- Modify: `1-kernel/1.1-base/definition-registry/src/types/registry.ts`
- Modify: `1-kernel/1.1-base/definition-registry/dev/index.ts`

- [ ] **Step 1: Replace placeholder dev verification with registry assertions**

```ts
import {
  createDefinitionRegistryBundle,
} from '../src'

const registries = createDefinitionRegistryBundle()

registries.errors.register({
  key: 'kernel.base.definition-registry.dev_error',
  name: 'Dev Error',
  defaultTemplate: 'failed',
  category: 'SYSTEM',
  severity: 'LOW',
})

if (!registries.errors.has('kernel.base.definition-registry.dev_error')) {
  throw new Error('Error definition registration failed')
}
```

- [ ] **Step 2: Run dev to verify it fails before implementation**

Run: `corepack yarn workspace @impos2/kernel-base-definition-registry dev`

Expected: fail with missing exports such as `createDefinitionRegistryBundle`

- [ ] **Step 3: Implement generic keyed registry contracts**

```ts
// types/definition.ts
export interface KeyedDefinition {
  key: string
  name: string
  moduleName?: string
}
```

```ts
// types/registry.ts
export interface DefinitionRegistry<TDefinition extends KeyedDefinition> {
  readonly kind: string
  register(definition: TDefinition): TDefinition
  registerMany(definitions: readonly TDefinition[]): readonly TDefinition[]
  has(key: string): boolean
  get(key: string): TDefinition | undefined
  getOrThrow(key: string): TDefinition
  list(): readonly TDefinition[]
  snapshot(): Readonly<Record<string, TDefinition>>
}
```

- [ ] **Step 4: Implement concrete bundle factories for error and parameter definitions**

```ts
// registry.ts
export const createKeyedDefinitionRegistry = <TDefinition extends KeyedDefinition>(
  kind: string,
): DefinitionRegistry<TDefinition> => {
  const definitions = new Map<string, TDefinition>()

  return {
    kind,
    register(definition) {
      if (definitions.has(definition.key)) {
        throw new Error(`[${kind}] duplicated definition key: ${definition.key}`)
      }

      definitions.set(definition.key, definition)
      return definition
    },
    registerMany(input) {
      input.forEach(definition => this.register(definition))
      return input
    },
    has: key => definitions.has(key),
    get: key => definitions.get(key),
    getOrThrow(key) {
      const definition = definitions.get(key)

      if (!definition) {
        throw new Error(`[${kind}] definition not found: ${key}`)
      }

      return definition
    },
    list: () => [...definitions.values()],
    snapshot: () => Object.freeze(Object.fromEntries(definitions.entries())),
  }
}
```

```ts
export const createDefinitionRegistryBundle = () => ({
  errors: createKeyedDefinitionRegistry<ErrorDefinition>('error-definition'),
  parameters: createKeyedDefinitionRegistry<ParameterDefinition>('parameter-definition'),
})
```

- [ ] **Step 5: Run package verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-definition-registry type-check
corepack yarn workspace @impos2/kernel-base-definition-registry dev
```

Expected:

1. `type-check` passes
2. `dev` verifies registration, duplicate protection, and query semantics

---

### Task 4: Batch A Verification Sweep

**Files:**

- Modify: `refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md`

- [ ] **Step 1: Run final package-level verification**

Run:

```bash
corepack yarn workspace @impos2/kernel-base-contracts type-check
corepack yarn workspace @impos2/kernel-base-platform-ports type-check
corepack yarn workspace @impos2/kernel-base-definition-registry type-check
corepack yarn workspace @impos2/kernel-base-contracts dev
corepack yarn workspace @impos2/kernel-base-platform-ports dev
corepack yarn workspace @impos2/kernel-base-definition-registry dev
```

Expected:

1. all three `type-check` commands pass
2. all three `dev` commands complete without runtime assertion failures

- [ ] **Step 2: Record actual completion status in the progress doc**

```md
## Batch A completion update

1. `contracts` first-pass contract implementation completed
2. `platform-ports` first-pass contract implementation completed
3. `definition-registry` first-pass contract implementation completed
4. package-local `type-check` and `dev` verification passed
```

- [ ] **Step 3: Commit batch A**

```bash
git add \
  refactor-doc/2026-04-09-kernel-base-batch-a-implementation-plan.md \
  refactor-doc/2026-04-09-kernel-base-current-progress-and-next-plan.md \
  1-kernel/1.1-base/contracts \
  1-kernel/1.1-base/platform-ports \
  1-kernel/1.1-base/definition-registry

git commit -m "feat: implement kernel base batch a contracts"
```

---

## Self-Review

### Spec coverage

本计划已覆盖 batch A 的三块范围：

1. `contracts` 的时间、ID、错误、参数、协议对象、module manifest
2. `platform-ports` 的 structured logger 与 runtime-scoped ports
3. `definition-registry` 的 error / parameter definition registry

### Placeholder scan

已检查以下常见失败模式，当前计划中没有保留：

1. 没有 `TBD`
2. 没有 “后续补充实现”
3. 没有 “写测试” 但不写验证方式
4. 没有只写职责、不写文件路径

### Type consistency

计划中的命名已统一为：

1. `TimestampMs`
2. `RuntimeIdKind`
3. `LoggerPort`
4. `PlatformPorts`
5. `DefinitionRegistry`
6. `createDefinitionRegistryBundle`

后续实现时不得再改成其他同义名称。
