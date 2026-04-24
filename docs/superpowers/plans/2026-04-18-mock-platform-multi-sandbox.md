# Mock Platform Multi-Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mock-terminal-platform`, `tcp-control-runtime-v2`, and `tdp-sync-runtime-v2` fully sandbox-explicit so one server process can safely host multiple independent sandboxes at once.

**Architecture:** The implementation removes server-global sandbox business reads, makes every HTTP/WS call carry explicit `sandboxId`, treats admin current-sandbox as UI-only default state, and persists sandbox truth on the client so TCP/TDP recovery remains correct. The work is split into server core, admin web, TCP client runtime, TDP client runtime, and isolation/recovery verification.

**Runtime decision:** For dual-screen / multi-process product scenarios, the first implementation follows the stricter path from the spec: the primary process owns TCP/TDP connection responsibilities, and secondary processes only consume synchronized business state. Because of that decision, `tcpSandbox` remains local persistent truth in the process that owns TCP/TDP connectivity and does not need cross-process sync in this phase.

**Tech Stack:** Express, ws, Drizzle/SQLite, React/Vite, Redux Toolkit, runtime-shell-v2, transport-runtime, Vitest

---

## File Map

### Server core

- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
  Route parsing and API contract enforcement for explicit `sandboxId`.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts`
  Keep sandbox CRUD/runtime-context helpers and add reusable sandbox validation helpers.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts`
  Make all TCP service entry points explicit about sandbox ownership.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
  Make all TDP data-plane behavior explicit about sandbox ownership.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`
  Require `sandboxId` in query + handshake and validate before session registration.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts`
  Make online session lookup sandbox-aware.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/fault/service.ts`
  Remove hidden sandbox lookup.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/master-data/service.ts`
  Remove hidden sandbox lookup.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/export/service.ts`
  Remove hidden sandbox lookup.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/export/importService.ts`
  Remove hidden sandbox lookup.
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/audit.ts`
  Keep audit writes sandbox-explicit.

### Admin web

- Modify: `0-mock-server/mock-terminal-platform/web/src/api.ts`
  Inject explicit sandbox ID into every request.
- Modify: `0-mock-server/mock-terminal-platform/web/src/App.tsx`
  Treat current sandbox as request default and clear stale detail state on switch.
- Modify: `0-mock-server/mock-terminal-platform/web/src/types.ts`
  Add request/response fields that now explicitly surface sandbox ownership.

### TCP client runtime

- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/state.ts`
  Add dedicated sandbox state type.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/api.ts`
  Add `sandboxId` to terminal-facing HTTP request contracts.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/index.ts`
  Export new sandbox slice.
- Create: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts`
  Persistent sandbox truth source.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/stateKeys.ts`
  Add state key for sandbox slice.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/tcpControl.ts`
  Add sandbox selectors.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/index.ts`
  Export sandbox selectors.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/commands/index.ts`
  Add sandbox-bearing activation payload and optional sandbox switch command.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/activationActor.ts`
  Require user-entered sandbox ID and persist it on success.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/credentialActor.ts`
  Send persisted sandbox ID on refresh.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/deactivationActor.ts`
  Send persisted sandbox ID on deactivation.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/taskReportActor.ts`
  Send persisted sandbox ID on task result reporting.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/index.ts`
  Register any new sandbox-switch/reset actor.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/httpService.ts`
  Carry sandbox ID on all HTTP service calls.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/index.ts`
  Export sandbox slice/selectors/commands.

### TDP client runtime

- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
  Add `sandboxId` to TDP handshake protocol.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/socketBinding.ts`
  Add `sandboxId` to WS query shape.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/httpService.ts`
  Add `sandboxId` to snapshot/changes HTTP calls.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
  Read sandbox truth from the same integrated runtime store that mounts both TCP and TDP modules before HTTP/WS connect.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/bootstrapActor.ts`
  Fail bootstrap/recovery if sandbox truth is missing when credentials exist.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/sessionConnectionActor.ts`
  Enforce sandbox-aware connection lifecycle.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/index.ts`
  Register any new reset handling needed for sandbox switch.

### Verification

- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness.ts`
  Make platform/admin helpers sandbox-explicit.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts`
  Verify activation and control-plane calls persist and reuse sandbox ID.
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts`
  Verify restart recovery includes sandbox truth.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts`
  Make platform/admin helpers and snapshot/changes helpers sandbox-explicit.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`
  Verify TDP HTTP/WS uses explicit sandbox ID.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts`
  Verify reconnect remains pinned to the same sandbox.
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`
  Verify TDP restart recovery requires persisted sandbox truth.
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-multi-sandbox-isolation.spec.ts`
  Verify projection isolation across two concurrent sandboxes.
- Create: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-multi-sandbox-isolation.spec.ts`
  Verify TCP/admin isolation across sandboxes.

## Tasks

### Task 1: Add server-side sandbox resolver and remove hidden sandbox reads from TCP/TDP core paths

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`
- Test: `0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer.ts`
- Create: `0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts`

- [ ] **Step 1: Write the failing server-side request test for missing sandboxId**

Add `0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts` and verify terminal-facing routes reject missing sandbox ID immediately.

```ts
it('rejects activate terminal when sandboxId is missing', async () => {
  const server = createMockTerminalPlatformTestServer()
  await server.start()
  const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      activationCode: '123456789012',
      deviceFingerprint: 'demo-pos',
      deviceInfo: { id: 'demo-pos' },
    }),
  })
  const payload = await response.json()
  expect(response.status).toBe(400)
  expect(payload.error?.message ?? '').toMatch(/sandbox/i)
  await server.close()
})
```

- [ ] **Step 2: Run the focused server-side test to verify it fails**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts`

Expected: FAIL because the server routes do not yet reject missing sandbox ID cleanly.

- [ ] **Step 3: Add reusable sandbox validation helpers to sandbox service**

In `0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts`, add explicit helper functions and keep `getCurrentSandboxId()` out of business callers.

```ts
export const assertSandboxExists = (sandboxId: string) => {
  const sandbox = getSandboxById(sandboxId)
  if (!sandbox) {
    throw new Error('沙箱不存在')
  }
  return sandbox
}

export const assertSandboxUsable = (sandboxId: string) => {
  const sandbox = assertSandboxExists(sandboxId)
  if (sandbox.status !== 'ACTIVE') {
    throw new Error('只能使用启用中的沙箱')
  }
  return sandbox
}
```

- [ ] **Step 4: Change TCP/TDP service signatures to accept explicit sandboxId**

In `0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts` and `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`, replace direct `getCurrentSandboxId()` calls in public service entrypoints with explicit parameters.

```ts
export const listTerminals = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(terminalsTable).where(eq(terminalsTable.sandboxId, sandboxId)).all()
}

export const activateTerminal = (input: {
  sandboxId: string
  activationCode: string
  deviceFingerprint: string
  deviceInfo: Record<string, unknown>
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  // existing activation logic...
}
```

- [ ] **Step 5: Update routes to parse sandboxId explicitly instead of relying on current sandbox**

In `0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts`, require sandbox ID on terminal/TDP APIs and pass it through.

```ts
router.post('/api/v1/terminals/activate', (req, res) => {
  const sandboxId = req.body?.sandboxId
  if (!sandboxId) {
    return fail(res, 'SANDBOX_ID_REQUIRED', 400)
  }
  try {
    const result = activateTerminal({
      sandboxId,
      activationCode: req.body?.activationCode,
      deviceFingerprint: req.body?.deviceFingerprint,
      deviceInfo: req.body?.deviceInfo,
    })
    return created(res, result)
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : '激活失败')
  }
})
```

- [ ] **Step 6: Run the focused server-side test again**

Run: `corepack yarn vitest run 0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/server/src/modules/sandbox/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts 0-mock-server/mock-terminal-platform/server/src/test/sandbox-api.spec.ts
git commit -m "Require explicit sandbox context in server TCP/TDP entrypoints"
```

### Task 2: Make TDP WebSocket registration sandbox-safe

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts`
- Modify: `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`
- Test: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`

- [ ] **Step 1: Write the failing TDP handshake test for explicit sandbox ownership**

Add a test in `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts` that expects handshake failure when sandbox ID is missing or mismatched.

```ts
expect(sessionState?.status).not.toBe('READY')
expect(sessionState?.lastError?.message ?? '').toMatch(/sandbox/i)
```

- [ ] **Step 2: Run the focused TDP roundtrip test to verify it fails**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`

Expected: FAIL because WS query and handshake do not yet carry sandbox ID.

- [ ] **Step 3: Add sandboxId to TDP server/client WS protocol**

In `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts`, require sandbox ID in handshake payload.

```ts
type HandshakeMessage = {
  type: 'HANDSHAKE'
  data: {
    sandboxId: string
    terminalId: string
    appVersion: string
    lastCursor?: number
    protocolVersion?: string
    capabilities?: string[]
    subscribedTopics?: string[]
  }
}
```

- [ ] **Step 4: Prevent pre-validation sessions from entering the online registry**

In `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts`, validate query sandbox ID, handshake sandbox ID, terminal ID, and token ownership before calling `registerOnlineSession`.

```ts
const querySandboxId = url.searchParams.get('sandboxId')
if (!querySandboxId) {
  sendErrorAndClose(socket, 'SANDBOX_ID_REQUIRED', '缺少 sandboxId')
  return
}
if (payload.sandboxId !== querySandboxId) {
  sendErrorAndClose(socket, 'SANDBOX_ID_MISMATCH', '握手 sandboxId 与连接参数不一致')
  return
}
const auth = validateTerminalAccessToken({
  sandboxId: querySandboxId,
  terminalId,
  token,
})
```

- [ ] **Step 5: Make the online session registry sandbox-aware**

In `0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts`, add sandbox-aware lookup helpers.

```ts
export const listOnlineSessionsBySandboxTerminalId = (sandboxId: string, terminalId: string) =>
  Array.from(sessionsById.values()).filter((item) => item.sandboxId === sandboxId && item.terminalId === terminalId)
```

- [ ] **Step 6: Update TDP push paths to use sandbox-aware session lookup**

In `0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts`, replace terminal-only push routing with sandbox + terminal routing.

```ts
const sessions = listOnlineSessionsBySandboxTerminalId(sandboxId, terminalId)
```

- [ ] **Step 7: Run the focused TDP roundtrip test again**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`

Expected: still FAIL, but now because client runtime has not yet started sending sandbox ID.

- [ ] **Step 8: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsProtocol.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsServer.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/wsSessionRegistry.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts
git commit -m "Isolate TDP websocket sessions by sandbox and terminal"
```

### Task 3: Make admin web requests fully sandbox-explicit

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/web/src/api.ts`
- Modify: `0-mock-server/mock-terminal-platform/web/src/App.tsx`
- Modify: `0-mock-server/mock-terminal-platform/web/src/types.ts`

- [ ] **Step 1: Add a failing admin API smoke assertion**

In `0-mock-server/mock-terminal-platform/web/src/api.ts`, temporarily add a runtime guard that throws when a sandbox-scoped request is issued without sandbox ID.

```ts
function requireSandboxId(sandboxId?: string) {
  if (!sandboxId) {
    throw new Error('sandboxId is required')
  }
  return sandboxId
}
```

- [ ] **Step 2: Update the API layer to inject sandboxId into every scoped request**

In `0-mock-server/mock-terminal-platform/web/src/api.ts`, move to a sandbox-scoped client shape. Every sandbox-scoped endpoint must go through this wrapper; no page code should call raw `request()` for sandbox-bound APIs.

```ts
export const createSandboxScopedApi = (getSandboxId: () => string) => ({
  getTerminals: () => request<TerminalItem[]>(`/api/v1/admin/terminals?sandboxId=${encodeURIComponent(requireSandboxId(getSandboxId()))}`),
  getSessions: () => request<SessionItem[]>(`/api/v1/admin/tdp/sessions?sandboxId=${encodeURIComponent(requireSandboxId(getSandboxId()))}`),
  createTaskRelease: (payload: Record<string, unknown>) =>
    request('/api/v1/admin/tasks/releases', {
      method: 'POST',
      body: JSON.stringify({
        sandboxId: requireSandboxId(getSandboxId()),
        ...payload,
      }),
    }),
  upsertProjection: (payload: Record<string, unknown>) =>
    request('/api/v1/admin/tdp/projections/upsert', {
      method: 'POST',
      body: JSON.stringify({
        sandboxId: requireSandboxId(getSandboxId()),
        ...payload,
      }),
    }),
  forceCloseSession: (sessionId: string, payload: Record<string, unknown>) =>
    request(`/api/v1/admin/tdp/sessions/${sessionId}/force-close`, {
      method: 'POST',
      body: JSON.stringify({
        sandboxId: requireSandboxId(getSandboxId()),
        ...payload,
      }),
    }),
})
```

- [ ] **Step 3: Thread current sandbox state through the app shell**

In `0-mock-server/mock-terminal-platform/web/src/App.tsx`, instantiate the scoped API from selected sandbox state and clear stale details on switch.

```ts
const currentSandboxId = runtimeContext?.currentSandboxId ?? ''
const sandboxApi = useMemo(() => createSandboxScopedApi(() => currentSandboxId), [currentSandboxId])

useEffect(() => {
  setTaskTrace(null)
  setTerminalSnapshot(null)
  setTerminalChanges(null)
}, [currentSandboxId])
```

- [ ] **Step 4: Update web response types that now expose sandbox ownership**

In `0-mock-server/mock-terminal-platform/web/src/types.ts`, add `sandboxId` to sandbox-scoped entities where the server now surfaces it.

```ts
export interface SessionItem {
  sessionId: string
  sandboxId: string
  terminalId: string
  status: string
}
```

- [ ] **Step 5: Type-check the web app**

Run: `corepack yarn workspace @next/mock-terminal-platform-web type-check`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/web/src/api.ts 0-mock-server/mock-terminal-platform/web/src/App.tsx 0-mock-server/mock-terminal-platform/web/src/types.ts
git commit -m "Send explicit sandbox ids from admin web requests"
```

### Task 4: Persist sandbox truth in `tcp-control-runtime-v2`

**Files:**
- Create: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/index.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/stateKeys.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/state.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/types/api.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/tcpControl.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/index.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/commands/index.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/activationActor.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/credentialActor.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/deactivationActor.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/taskReportActor.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/httpService.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/src/index.ts`
- Test: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts`
- Test: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts`

- [ ] **Step 1: Write the failing sandbox persistence assertions**

Add assertions in the TCP live tests that sandbox ID is required, stored, and restored.

```ts
expect(selectTcpSandboxId(runtime.getState())).toBe(platform.prepare.sandboxId)
```

- [ ] **Step 2: Run the focused TCP tests to verify failure**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts`

Expected: FAIL because no sandbox slice or selector exists.

- [ ] **Step 3: Create the persistent sandbox slice**

Add `1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts`.

```ts
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import {TCP_SANDBOX_STATE_KEY} from '../../foundations/stateKeys'

type TcpSandboxState = {
  sandboxId?: string
}

const initialState: TcpSandboxState = {}

const slice = createSlice({
  name: TCP_SANDBOX_STATE_KEY,
  initialState,
  reducers: {
    setSandboxId: (_state, action: PayloadAction<string>) => ({ sandboxId: action.payload }),
    clearSandboxId: () => initialState,
  },
})

export const tcpSandboxV2Actions = slice.actions

export const tcpSandboxV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpSandboxState> = {
  name: TCP_SANDBOX_STATE_KEY,
  reducer: slice.reducer,
  persistIntent: 'owner-only',
  syncIntent: 'isolated',
  persistence: [{ kind: 'field', stateKey: 'sandboxId', flushMode: 'immediate' }],
}
```

This `syncIntent: 'isolated'` is intentional for the chosen runtime strategy in this plan:

1. primary owns TCP/TDP connectivity
2. secondary does not establish its own TCP/TDP connection in this phase
3. if product requirements later demand secondary-owned connectivity, sandbox truth propagation must be redesigned before changing this slice contract

- [ ] **Step 4: Wire the new state key, selectors, and exports**

Update `stateKeys.ts`, `features/slices/index.ts`, `selectors/tcpControl.ts`, `selectors/index.ts`, and `src/index.ts`.

```ts
export const TCP_SANDBOX_STATE_KEY = `${moduleName}.sandbox`

export const selectTcpSandboxState = (state: Record<string, unknown>) =>
  state[TCP_SANDBOX_STATE_KEY] as TcpSandboxState | undefined

export const selectTcpSandboxId = (state: Record<string, unknown>) =>
  selectTcpSandboxState(state)?.sandboxId
```

- [ ] **Step 5: Add sandboxId to API and command contracts**

In `types/api.ts` and `features/commands/index.ts`, require sandbox ID for activation and send it for later HTTP calls.

```ts
export interface ActivateTerminalApiRequest {
  sandboxId: string
  activationCode: string
  deviceFingerprint: string
  deviceInfo: TcpDeviceInfo
}

export interface RefreshTerminalCredentialApiRequest {
  sandboxId: string
  refreshToken: string
}
```

- [ ] **Step 6: Update actors to persist and reuse sandbox truth with explicit source rules**

In `activationActor.ts`, read sandbox ID from user-entered command payload and persist it on success.

```ts
const sandboxId = actorContext.command.payload.sandboxId
if (!sandboxId) {
  throw createAppError(tcpControlV2ErrorDefinitions.bootstrapHydrationFailed, {
    args: { error: 'sandbox id is missing' },
  })
}
actorContext.dispatchAction(tcpSandboxV2Actions.setSandboxId(sandboxId))
```

In `credentialActor.ts`, `deactivationActor.ts`, and `taskReportActor.ts`, read sandbox ID only from persisted runtime state and fail-fast if it is missing.

```ts
const sandboxId = selectTcpSandboxId(actorContext.getState())
if (!sandboxId) {
  throw createAppError(tcpControlV2ErrorDefinitions.bootstrapHydrationFailed, {
    args: { error: 'sandbox id is missing' },
  })
}
```

- [ ] **Step 7: Update the HTTP service binder to include sandboxId on all calls**

In `foundations/httpService.ts`, pass sandbox ID through request bodies.

```ts
return http.envelope(refreshCredentialEndpoint, {
  body: request,
}, {
  errorDefinition: tcpControlV2ErrorDefinitions.refreshFailed,
  fallbackMessage: TCP_CONTROL_V2_HTTP_FALLBACK_MESSAGE,
})
```

Where `request` now already contains `sandboxId`.

- [ ] **Step 8: Run the focused TCP tests again**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/tcpSandbox.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/slices/index.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/stateKeys.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/types/state.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/types/api.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/tcpControl.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/selectors/index.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/commands/index.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/activationActor.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/credentialActor.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/deactivationActor.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/features/actors/taskReportActor.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/foundations/httpService.ts 1-kernel/1.1-base/tcp-control-runtime-v2/src/index.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts
git commit -m "Persist sandbox truth in tcp control runtime"
```

### Task 5: Make `tdp-sync-runtime-v2` consume sandbox truth from TCP runtime

**Files:**
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/socketBinding.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/httpService.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/bootstrapActor.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/sessionConnectionActor.ts`
- Test: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts`
- Test: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts`
- Test: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`

- [ ] **Step 1: Add failing assertions for sandbox-aware TDP connect/reconnect**

In the TDP live tests, assert that sandbox ID is required for snapshot/changes and reconnect remains in the same sandbox.

```ts
expect(selectTdpSessionState(runtime.getState())?.lastError?.message ?? '').toMatch(/sandbox/i)
```

- [ ] **Step 2: Run the focused TDP tests to verify failure**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`

Expected: FAIL because the TDP runtime still omits sandbox ID.

- [ ] **Step 3: Add sandboxId to the TDP protocol and socket query**

In `types/protocol.ts` and `foundations/socketBinding.ts`:

```ts
type TdpClientMessage =
  | {
      type: 'HANDSHAKE'
      data: {
        sandboxId: string
        terminalId: string
        appVersion: string
        lastCursor?: number
        protocolVersion?: string
      }
    }
```

```ts
handshake: {
  query: typed<{sandboxId: string; terminalId: string; token: string}>('kernel.base.tdp-sync-runtime-v2.socket.query'),
  headers: typed<Record<string, string>>('kernel.base.tdp-sync-runtime-v2.socket.headers'),
},
```

- [ ] **Step 4: Add sandboxId to TDP HTTP service calls**

In `foundations/httpService.ts`, change request contracts to include sandbox ID.

```ts
async getSnapshot(sandboxId, terminalId) {
  return http.envelope(snapshotEndpoint, {
    path: { terminalId },
    query: { sandboxId },
  }, ...)
}
```

- [ ] **Step 5: Read sandbox truth from the integrated runtime store before connect**

In `foundations/sessionConnectionRuntime.ts`, read `selectTcpSandboxId(state)` from the same kernel runtime store instance that mounts both TCP and TDP modules together. This plan does not rely on cross-runtime or cross-process store reads.

```ts
const sandboxId = selectTcpSandboxId(state)
if (!sandboxId) {
  throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
    args: { error: 'sandbox id is missing' },
  })
}
```

- [ ] **Step 6: Send sandboxId in WS query and handshake**

In `sessionConnectionRuntime.ts`:

```ts
await socketBinding.socketRuntime.connect(socketBinding.profileName, {
  query: {
    sandboxId,
    terminalId,
    token: accessToken,
  },
})

const handshakeMessage: TdpClientMessage = {
  type: 'HANDSHAKE',
  data: {
    sandboxId,
    terminalId,
    appVersion: packageVersion,
    lastCursor: selectTdpSyncState(state)?.lastCursor,
    protocolVersion,
  },
}
```

- [ ] **Step 7: Run the focused TDP tests again**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add 1-kernel/1.1-base/tdp-sync-runtime-v2/src/types/protocol.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/socketBinding.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/httpService.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/foundations/sessionConnectionRuntime.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/bootstrapActor.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/src/features/actors/sessionConnectionActor.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-roundtrip.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-reconnect.spec.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-restart-recovery.spec.ts
git commit -m "Make TDP runtime sandbox-explicit"
```

### Task 6: Add multi-sandbox isolation coverage for TDP and TCP/admin paths

**Files:**
- Create: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-multi-sandbox-isolation.spec.ts`
- Create: `1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-multi-sandbox-isolation.spec.ts`
- Modify: `1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness.ts`
- Modify: `1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts`

- [ ] **Step 1: Create the failing TDP dual-sandbox isolation spec**

Add a new TDP scenario that prepares two sandboxes, activates two runtimes, and asserts projection isolation.

```ts
expect(clientAProjection).toMatchObject({ rollout: 'A' })
expect(clientBProjection).toMatchObject({ rollout: 'B' })
expect(clientAProjection).not.toEqual(clientBProjection)
```

- [ ] **Step 2: Create the failing TCP/admin cross-sandbox isolation spec**

Add a new TCP/admin scenario that tries to operate on a resource across sandbox boundaries and expects a mismatch error. Use a real helper shape that can exist in the live harness.

```ts
await expect(
  platform.admin.forceCloseSession(sessionIdFromSandboxB, {
    sandboxId: sandboxA.sandboxId,
    reason: 'cross-sandbox negative test',
  }),
).rejects.toThrow(/sandbox/i)
```

- [ ] **Step 3: Extend live harnesses to support multiple prepared sandboxes**

In both live harness files, add helpers that can create or select multiple sandboxes instead of assuming a single prepared one.

```ts
const prepareSandbox = async (baseUrl: string) =>
  fetchJson<{sandboxId: string; preparedAt: number}>(`${baseUrl}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
```

- [ ] **Step 4: Run the two new isolation tests to verify failure**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-multi-sandbox-isolation.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-multi-sandbox-isolation.spec.ts`

Expected: FAIL until the helpers and server checks fully isolate sandboxes end to end.

- [ ] **Step 5: Adjust any remaining service/helper paths until the isolation specs pass**

Use the new tests to remove leftover terminal-only or current-sandbox-based paths. Typical fixes belong in:

```ts
0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts
0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts
0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts
```

- [ ] **Step 6: Run the new isolation tests again**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-multi-sandbox-isolation.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-multi-sandbox-isolation.spec.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add 1-kernel/1.1-base/tdp-sync-runtime-v2/test/scenarios/tdp-sync-runtime-v2-live-multi-sandbox-isolation.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-multi-sandbox-isolation.spec.ts 1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/helpers/liveHarness.ts 0-mock-server/mock-terminal-platform/server/src/modules/admin/routes.ts 0-mock-server/mock-terminal-platform/server/src/modules/tcp/service.ts 0-mock-server/mock-terminal-platform/server/src/modules/tdp/service.ts
git commit -m "Add live multi-sandbox isolation coverage"
```

### Task 7: Run full regression and update docs

**Files:**
- Modify: `0-mock-server/mock-terminal-platform/docs/README.md`
- Modify: `0-mock-server/mock-terminal-platform/docs/给开发的进阶手册.md`
- Modify: `0-mock-server/mock-terminal-platform/docs/给测试的联调用例手册.md`
- Modify: `0-mock-server/mock-terminal-platform/docs/后台使用手册.md`

- [ ] **Step 1: Update API examples to include sandboxId everywhere**

Update the following sections explicitly:

1. `0-mock-server/mock-terminal-platform/docs/README.md`
   Update the HTTP API overview and TDP WebSocket examples to include `sandboxId`.
2. `0-mock-server/mock-terminal-platform/docs/给开发的进阶手册.md`
   Update the terminal activation section, token refresh section, and TDP connection section with explicit `sandboxId`.
3. `0-mock-server/mock-terminal-platform/docs/给测试的联调用例手册.md`
   Update all curl examples and test steps so every server call shows `sandboxId`.
4. `0-mock-server/mock-terminal-platform/docs/后台使用手册.md`
   Update admin operation examples to explain that current sandbox is UI default only and all requests still carry `sandboxId`.

Add explicit examples in docs for:

```bash
curl -X POST http://127.0.0.1:5810/api/v1/terminals/activate \
  -H 'Content-Type: application/json' \
  -d '{"sandboxId":"sandbox-kernel-base-test","activationCode":"123456789012","deviceFingerprint":"demo-pos","deviceInfo":{"id":"demo-pos"}}'
```

and:

```text
ws://127.0.0.1:5810/api/v1/tdp/ws/connect?sandboxId=sandbox-kernel-base-test&terminalId=...&token=...
```

- [ ] **Step 2: Run the package test suites**

Run: `corepack yarn vitest run 1-kernel/1.1-base/tcp-control-runtime-v2/test/index.ts 1-kernel/1.1-base/tdp-sync-runtime-v2/test/index.ts`

Expected: PASS

- [ ] **Step 3: Run server and web type-check**

Run: `corepack yarn workspace @next/mock-terminal-platform-server type-check`

Expected: PASS

Run: `corepack yarn workspace @next/mock-terminal-platform-web type-check`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add 0-mock-server/mock-terminal-platform/docs/README.md 0-mock-server/mock-terminal-platform/docs/给开发的进阶手册.md 0-mock-server/mock-terminal-platform/docs/给测试的联调用例手册.md 0-mock-server/mock-terminal-platform/docs/后台使用手册.md
git commit -m "Document sandbox-explicit mock platform APIs"
```

## Self-Review

### Spec coverage

This plan covers:

1. server-global sandbox removal
2. HTTP explicit sandbox contract
3. WS query + handshake sandbox contract
4. admin web explicit sandbox propagation
5. client activation sandbox input and persistence
6. TCP/TDP restart recovery correctness
7. dual-sandbox TDP isolation
8. cross-sandbox TCP/admin isolation

Potential follow-up after this plan, not required for completion:

1. a dedicated UI command for sandbox switching in real product UI if the activation screen needs a richer sandbox selector
2. a separate auth redesign if sandbox metadata should ever be embedded in tokens

### Placeholder scan

The plan intentionally avoids `TODO`/`TBD` placeholders and names concrete files, tests, and commands for each task.

### Type consistency

The plan consistently uses:

1. `sandboxId`
2. `TcpSandboxState`
3. `selectTcpSandboxId`
4. `listOnlineSessionsBySandboxTerminalId`
5. explicit sandbox-carrying TCP and TDP request contracts
