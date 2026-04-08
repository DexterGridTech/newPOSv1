import path from 'node:path'
import {spawn} from 'node:child_process'
import {
  ActorSystem,
  type AppError,
  ApplicationManager,
  type ApplicationConfig,
  registerStateStorage,
  ScreenMode,
  type RootState,
} from '@impos2/kernel-core-base'
// @ts-ignore
import {devServerSpace} from '@impos2/kernel-server-config'
import {
  kernelCoreTcpClientCommands,
  selectTcpCredentialSnapshot,
  selectTcpIdentitySnapshot,
} from '@impos2/kernel-core-tcp-client'
import {createFileStateStorage, readFileStateStorageSnapshot, resetFileStateStorage} from '../../shared-dev/fileStateStorage'
import {kernelCoreTdpClientModule, kernelCoreTdpClientCommands, tdpHttpService} from '../src'
import {
  selectTdpCommandInboxState,
  selectTdpControlSignalsState,
  selectTdpProjectionState,
  selectTdpSessionState,
  selectTdpSyncState,
} from '../src/selectors'

interface ActivationBatchResponse {
  success: boolean
  data: {
    count: number
    codes: string[]
  }
}

interface TaskReleaseResponse {
  success: boolean
  data: {
    release: {
      releaseId: string
    }
  }
}

interface TdpSessionsResponse {
  success: boolean
  data: Array<{
    sessionId: string
    terminalId: string
    disconnectedAt?: number | null
    lastAckedRevision: number | null
    lastAppliedRevision: number | null
    highWatermark: number
    ackLag: number
    applyLag: number
  }>
}

interface TdpAdminSignalResponse {
  success: boolean
  data: {
    sessionId: string
    messageType: 'EDGE_DEGRADED' | 'SESSION_REHOME_REQUIRED' | 'ERROR'
  }
}

type DevPhase = 'full' | 'seed' | 'verify'

interface SeedSummary {
  terminalId: string
  lastCursor: number
  lastAppliedRevision: number
}

interface VerifySummary {
  terminalId: string
  rehydratedCursor: number
  syncMode: 'incremental' | 'full'
}

const TDP_DEV_STORAGE = path.join(
  process.cwd(),
  'ai-result',
  'dev-storage',
  'tdp-client.dev.storage.json',
)
const TSX_CLI = require.resolve('tsx/cli')

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`)
  }
  return response.json() as Promise<T>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForCommand(commandName: string, requestId: string) {
  return new Promise<Record<string, any> | undefined>((resolve, reject) => {
    let settled = false
    const listener = {
      onCommandStart() {},
      onCommandComplete(_actor: unknown, command: {commandName: string; requestId?: string}, result?: Record<string, any>) {
        if (settled) return
        if (command.commandName === commandName && command.requestId === requestId) {
          settled = true
          resolve(result)
        }
      },
      onCommandError(_actor: unknown, command: {commandName: string; requestId?: string}, error: AppError) {
        if (settled) return
        if (command.commandName === commandName && command.requestId === requestId) {
          settled = true
          reject(error)
        }
      },
    }
    ActorSystem.getInstance().registerLifecycleListener(listener)
  })
}

async function runCommandAndWait(
  requestId: string,
  commandName: string,
  execute: () => void,
) {
  const waiting = waitForCommand(commandName, requestId)
  execute()
  return waiting
}

async function waitFor<T>(label: string, getter: () => T | undefined, timeoutMs = 10_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = getter()
    if (value !== undefined) {
      return value
    }
    await wait(100)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function waitForAsync<T>(label: string, getter: () => Promise<T | undefined>, timeoutMs = 10_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await getter()
    if (value !== undefined) {
      return value
    }
    await wait(100)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function createApp() {
  const appConfig: ApplicationConfig = {
    serverSpace: devServerSpace,
    environment: {
      deviceId: 'tdp-client-dev-device',
      production: false,
      screenMode: ScreenMode.DESKTOP,
      displayCount: 1,
      displayIndex: 0,
    },
    preInitiatedState: {},
    module: kernelCoreTdpClientModule,
  }

  registerStateStorage(createFileStateStorage({filePath: TDP_DEV_STORAGE}))
  const {store, persistor} = await ApplicationManager.getInstance().generateStore(appConfig)
  ApplicationManager.getInstance().init()
  await wait(150)
  return {store, persistor}
}

async function ensureActivated(store: {getState(): unknown}) {
  const state = store.getState() as RootState
  const identity = selectTcpIdentitySnapshot(state)
  const credential = selectTcpCredentialSnapshot(state)
  if (identity.terminalId && credential.accessToken) {
    return {identity, credential}
  }

  const activationBatch = await requestJson<ActivationBatchResponse>(
    'http://127.0.0.1:5810/api/v1/admin/activation-codes/batch',
    {
      method: 'POST',
      body: JSON.stringify({count: 1}),
    },
  )
  const activationCode = activationBatch.data.codes[0]
  assert(activationCode, 'no activation code returned for tdp-client dev')

  const activateRequestId = `tdp-activate-${Date.now()}`
  await runCommandAndWait(
    activateRequestId,
    'kernel.core.tcpClient.activateTerminal',
    () => kernelCoreTcpClientCommands.activateTerminal({activationCode}).execute(activateRequestId),
  )

  const activatedState = store.getState() as RootState
  const nextIdentity = selectTcpIdentitySnapshot(activatedState)
  const nextCredential = selectTcpCredentialSnapshot(activatedState)
  assert(nextIdentity.terminalId, 'terminalId missing after activation')
  assert(nextCredential.accessToken, 'accessToken missing after activation')
  return {identity: nextIdentity, credential: nextCredential}
}

async function connectAndWaitReady() {
  const connectRequestId = `tdp-connect-${Date.now()}`
  await runCommandAndWait(
    connectRequestId,
    'kernel.core.tdpClient.connectTdpSession',
    () => kernelCoreTdpClientCommands.connectTdpSession(undefined).execute(connectRequestId),
  )

  return waitFor('tdp READY state', () => {
    const session = selectTdpSessionState(ApplicationManager.getInstance().getStore()!.getState() as RootState)
    return session.status?.value === 'READY' ? session : undefined
  })
}

async function disconnectTdp() {
  const disconnectRequestId = `tdp-disconnect-${Date.now()}`
  await runCommandAndWait(
    disconnectRequestId,
    'kernel.core.tdpClient.disconnectTdpSession',
    () => kernelCoreTdpClientCommands.disconnectTdpSession(undefined).execute(disconnectRequestId),
  )
  await wait(200)
}

async function waitForOnlineSessionByTerminalId(terminalId: string) {
  return waitForAsync('online tdp session', async () => {
    const response = await requestJson<TdpSessionsResponse>('http://127.0.0.1:5810/api/v1/admin/tdp/sessions')
    return response.data.find(item => item.terminalId === terminalId && item.disconnectedAt == null)
  })
}

async function waitForNoOnlineSessionByTerminalId(terminalId: string, timeoutMs = 10_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const response = await requestJson<TdpSessionsResponse>('http://127.0.0.1:5810/api/v1/admin/tdp/sessions')
    const onlineSession = response.data.find(item => item.terminalId === terminalId && item.disconnectedAt == null)
    if (!onlineSession) {
      return
    }
    await wait(100)
  }
  throw new Error(`timeout waiting for no online tdp session of terminal ${terminalId}`)
}

async function waitForSessionIdChange(terminalId: string, previousSessionId: string, timeoutMs = 10_000) {
  return waitForAsync('tdp session id change', async () => {
    const response = await requestJson<TdpSessionsResponse>('http://127.0.0.1:5810/api/v1/admin/tdp/sessions')
    const onlineSession = response.data.find(
      item => item.terminalId === terminalId && item.disconnectedAt == null && item.sessionId !== previousSessionId,
    )
    return onlineSession
  }, timeoutMs)
}

async function seedPhase(): Promise<SeedSummary> {
  const health = await fetch('http://127.0.0.1:5810/health')
  assert(health.ok, `mock-terminal-platform health check failed: ${health.status}`)

  resetFileStateStorage(TDP_DEV_STORAGE)
  const {store, persistor} = await createApp()
  const {identity} = await ensureActivated(store)

  await connectAndWaitReady()
  const terminalId = identity.terminalId!

  await requestJson(
    'http://127.0.0.1:5810/api/v1/admin/tdp/projections/upsert',
    {
      method: 'POST',
      body: JSON.stringify({
        topicKey: 'config.delta',
        scopeType: 'TERMINAL',
        scopeKey: terminalId,
        payload: {
          configVersion: 'tdp-dev-v1',
          issuedBy: 'tdp-client-dev',
        },
      }),
    },
  )

  const pushedProjection = await waitFor('projection push', () => {
    const projection = selectTdpProjectionState(store.getState() as RootState)
    return projection.byTopic['config.delta']?.[Object.keys(projection.byTopic['config.delta'] ?? {})[0]]
  })
  assert(pushedProjection.payload.configVersion === 'tdp-dev-v1', 'projection payload mismatch')

  await Promise.all([
    requestJson(
      'http://127.0.0.1:5810/api/v1/admin/tdp/projections/upsert',
      {
        method: 'POST',
        body: JSON.stringify({
          topicKey: 'menu.delta',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          payload: {
            menuVersion: 'batch-a',
            itemCount: 12,
          },
        }),
      },
    ),
    requestJson(
      'http://127.0.0.1:5810/api/v1/admin/tdp/projections/upsert',
      {
        method: 'POST',
        body: JSON.stringify({
          topicKey: 'printer.delta',
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          payload: {
            printerVersion: 'batch-b',
            deviceCount: 2,
          },
        }),
      },
    ),
  ])

  const batchProjectionState = await waitFor('projection batch push', () => {
    const projection = selectTdpProjectionState(store.getState() as RootState)
    const menu = projection.byTopic['menu.delta']?.[Object.keys(projection.byTopic['menu.delta'] ?? {})[0]]
    const printer = projection.byTopic['printer.delta']?.[Object.keys(projection.byTopic['printer.delta'] ?? {})[0]]
    if (menu && printer) {
      return {menu, printer}
    }
    return undefined
  })
  assert(batchProjectionState.menu.payload.menuVersion === 'batch-a', 'menu.delta batch payload mismatch')
  assert(batchProjectionState.printer.payload.printerVersion === 'batch-b', 'printer.delta batch payload mismatch')

  const taskRelease = await requestJson<TaskReleaseResponse>(
    'http://127.0.0.1:5810/api/v1/admin/tasks/releases',
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'tdp-client-dev-remote-control',
        taskType: 'REMOTE_CONTROL',
        sourceType: 'COMMAND',
        sourceId: 'tdp-client-dev',
        priority: 1,
        targetTerminalIds: [terminalId],
        payload: {
          topicKey: 'remote.control',
          action: 'OPEN_CASH_DRAWER',
          instanceId: `inst-${Date.now()}`,
        },
      }),
    },
  )
  assert(taskRelease.data.release.releaseId, 'remote control release not created')

  const deliveredCommand = await waitFor('command inbox item', () => {
    const inbox = selectTdpCommandInboxState(store.getState() as RootState)
    const firstId = inbox.orderedIds[0]
    return firstId ? inbox.itemsById[firstId] : undefined
  })
  assert(deliveredCommand.topic === 'remote.control', `command topic mismatch: ${deliveredCommand.topic}`)

  const snapshotResponse = await tdpHttpService.getSnapshot(terminalId)
  assert(snapshotResponse.some(item => item.topic === 'config.delta'), 'http snapshot should contain config.delta projection')

  const changesResponse = await tdpHttpService.getChanges(terminalId, 0)
  assert(changesResponse.changes.some(item => item.topic === 'config.delta'), 'http changes should contain config.delta projection')
  assert(changesResponse.highWatermark >= 1, `http changes highWatermark mismatch: ${changesResponse.highWatermark}`)

  for (let index = 0; index < 4; index += 1) {
    await requestJson(
      'http://127.0.0.1:5810/api/v1/admin/tdp/projections/upsert',
      {
        method: 'POST',
        body: JSON.stringify({
          topicKey: `pagination.delta.${index}`,
          scopeType: 'TERMINAL',
          scopeKey: terminalId,
          payload: {
            pageIndex: index,
            marker: `page-${index}`,
          },
        }),
      },
    )
  }

  const pagedChanges = await tdpHttpService.getChanges(terminalId, 0, 2)
  assert(pagedChanges.hasMore === true, 'http changes should report hasMore=true when limit is smaller than available changes')
  assert(pagedChanges.changes.length === 2, `http paged changes length mismatch: ${pagedChanges.changes.length}`)
  assert(pagedChanges.nextCursor < pagedChanges.highWatermark, 'nextCursor should be behind highWatermark when hasMore=true')

  const pagedChangesNext = await tdpHttpService.getChanges(terminalId, pagedChanges.nextCursor, 100)
  const reconstructedChanges = [...pagedChanges.changes, ...pagedChangesNext.changes]
  assert(
    reconstructedChanges.some(item => item.topic === 'pagination.delta.3'),
    'paged http changes should be reconstructable across requests',
  )

  const pingRequestId = `tdp-ping-${Date.now()}`
  await runCommandAndWait(
    pingRequestId,
    'kernel.core.tdpClient.sendPing',
    () => kernelCoreTdpClientCommands.sendPing(undefined).execute(pingRequestId),
  )
  await waitFor('pong timestamp', () => {
    const session = selectTdpSessionState(store.getState() as RootState)
    return session.lastPongAt?.value
  })

  const onlineSession = await waitForOnlineSessionByTerminalId(terminalId)

  const edgeDegraded = await requestJson<TdpAdminSignalResponse>(
    `http://127.0.0.1:5810/api/v1/admin/tdp/sessions/${onlineSession.sessionId}/edge-degraded`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: 'seed-check-edge',
        nodeState: 'grace',
        gracePeriodSeconds: 45,
        alternativeEndpoints: ['ws://127.0.0.1:5811/api/v1/tdp/ws/connect'],
      }),
    },
  )
  assert(edgeDegraded.data.messageType === 'EDGE_DEGRADED', 'edge degraded signal not accepted by server')

  const degradedState = await waitFor('edge degraded state', () => {
    const state = store.getState() as RootState
    const session = selectTdpSessionState(state)
    const control = selectTdpControlSignalsState(state)
    if (
      session.status?.value === 'DEGRADED'
      && control.lastEdgeDegraded?.value?.reason === 'seed-check-edge'
    ) {
      return {session, control}
    }
    return undefined
  })
  assert(degradedState.session.nodeState?.value === 'grace', `nodeState mismatch after edge degraded: ${degradedState.session.nodeState?.value}`)
  assert(
    degradedState.session.alternativeEndpoints?.value?.includes('ws://127.0.0.1:5811/api/v1/tdp/ws/connect'),
    'alternative endpoint missing after edge degraded',
  )

  const rehomeRequired = await requestJson<TdpAdminSignalResponse>(
    `http://127.0.0.1:5810/api/v1/admin/tdp/sessions/${onlineSession.sessionId}/rehome`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: 'seed-check-rehome',
        deadline: new Date(Date.now() + 30_000).toISOString(),
        alternativeEndpoints: ['ws://127.0.0.1:5812/api/v1/tdp/ws/connect'],
      }),
    },
  )
  assert(rehomeRequired.data.messageType === 'SESSION_REHOME_REQUIRED', 'rehome signal not accepted by server')

  const rehomeState = await waitFor('rehome required state', () => {
    const state = store.getState() as RootState
    const session = selectTdpSessionState(state)
    const control = selectTdpControlSignalsState(state)
    if (
      session.status?.value === 'REHOME_REQUIRED'
      && control.lastRehomeRequired?.value?.reason === 'seed-check-rehome'
    ) {
      return {session, control}
    }
    return undefined
  })
  assert(
    rehomeState.session.alternativeEndpoints?.value?.includes('ws://127.0.0.1:5812/api/v1/tdp/ws/connect'),
    'alternative endpoint missing after rehome required',
  )

  const protocolError = await requestJson<TdpAdminSignalResponse>(
    `http://127.0.0.1:5810/api/v1/admin/tdp/sessions/${onlineSession.sessionId}/protocol-error`,
    {
      method: 'POST',
      body: JSON.stringify({
        code: 'SEED_PROTOCOL_CHECK',
        message: 'seed injected protocol error',
        details: {source: 'tdp-client-dev'},
        closeAfterSend: false,
      }),
    },
  )
  assert(protocolError.data.messageType === 'ERROR', 'protocol error signal not accepted by server')

  const protocolErrorState = await waitFor('protocol error state', () => {
    const state = store.getState() as RootState
    const session = selectTdpSessionState(state)
    const control = selectTdpControlSignalsState(state)
    const message = control.lastProtocolError?.value?.message
    if (
      session.status?.value === 'ERROR'
      && typeof message === 'string'
      && message.includes('SEED_PROTOCOL_CHECK')
    ) {
      return {session, control}
    }
    return undefined
  })
  assert(
    protocolErrorState.control.lastProtocolError?.value?.message.includes('seed injected protocol error'),
    'protocol error message mismatch',
  )

  const sessionStateBeforeReconnect = selectTdpSessionState(store.getState() as RootState)
  const reconnectBaseSessionId = sessionStateBeforeReconnect.sessionId?.value
  assert(reconnectBaseSessionId, 'sessionId missing before reconnect test')

  await requestJson(
    `http://127.0.0.1:5810/api/v1/admin/tdp/sessions/${reconnectBaseSessionId}/force-close`,
    {
      method: 'POST',
      body: JSON.stringify({
        code: 1012,
        reason: 'seed force close for reconnect',
      }),
    },
  )

  const reconnectingState = await waitFor('reconnecting state', () => {
    const nextSessionState = selectTdpSessionState(store.getState() as RootState)
    if (
      nextSessionState.status?.value === 'RECONNECTING'
      && typeof nextSessionState.reconnectAttempt?.value === 'number'
      && nextSessionState.reconnectAttempt.value >= 1
    ) {
      return nextSessionState
    }
    return undefined
  })
  assert(reconnectingState.disconnectReason?.value === 'seed force close for reconnect', 'disconnect reason mismatch during reconnect')

  const reconnectedServerSession = await waitForSessionIdChange(terminalId, reconnectBaseSessionId)
  const readyAfterReconnect = await waitFor('tdp ready after reconnect', () => {
    const nextSessionState = selectTdpSessionState(store.getState() as RootState)
    if (
      nextSessionState.status?.value === 'READY'
      && nextSessionState.sessionId?.value
      && nextSessionState.sessionId.value !== reconnectBaseSessionId
    ) {
      return nextSessionState
    }
    return undefined
  })
  assert(readyAfterReconnect.syncMode?.value === 'incremental', `expected incremental reconnect sync mode, got ${readyAfterReconnect.syncMode?.value}`)
  assert(readyAfterReconnect.sessionId?.value === reconnectedServerSession.sessionId, 'client/server session id mismatch after reconnect')

  const sessions = await waitForAsync('server session ack/apply state', async () => {
    const response = await requestJson<TdpSessionsResponse>('http://127.0.0.1:5810/api/v1/admin/tdp/sessions')
    const session = response.data.find(item => item.terminalId === terminalId)
    if (!session) return undefined
    if ((session.lastAckedRevision ?? 0) <= 0 || (session.lastAppliedRevision ?? 0) <= 0) {
      return undefined
    }
    return session
  })

  const finalState = store.getState() as RootState
  const sessionState = selectTdpSessionState(finalState)
  const syncState = selectTdpSyncState(finalState)
  const projectionState = selectTdpProjectionState(finalState)
  const commandInboxState = selectTdpCommandInboxState(finalState)
  const controlState = selectTdpControlSignalsState(finalState)

  assert(sessionState.status.value === 'READY', `tdp session status mismatch after reconnect: ${sessionState.status.value}`)
  assert(sessionState.sessionId?.value, 'tdp sessionId missing')
  assert(syncState.lastCursor?.value && syncState.lastCursor.value > 0, 'lastCursor missing')
  assert(syncState.lastAppliedRevision?.value && syncState.lastAppliedRevision.value > 0, 'lastAppliedRevision missing')
  assert(projectionState.byTopic['config.delta'], 'config.delta topic missing from projection state')
  assert(projectionState.byTopic['menu.delta'], 'menu.delta topic missing from projection state')
  assert(projectionState.byTopic['printer.delta'], 'printer.delta topic missing from projection state')
  assert(commandInboxState.orderedIds.length > 0, 'command inbox should not be empty')
  assert(controlState.lastProtocolError?.value != null, 'protocol error should be captured after injected error')
  assert(controlState.lastEdgeDegraded?.value?.reason === 'seed-check-edge', 'edge degraded signal missing from control state')
  assert(controlState.lastRehomeRequired?.value?.reason === 'seed-check-rehome', 'rehome required signal missing from control state')
  assert((sessions.lastAckedRevision ?? 0) > 0, 'server lastAckedRevision not updated')
  assert((sessions.lastAppliedRevision ?? 0) > 0, 'server lastAppliedRevision not updated')

  await disconnectTdp()
  await waitForNoOnlineSessionByTerminalId(terminalId)
  await wait(1_500)
  const sessionsAfterManualDisconnect = await requestJson<TdpSessionsResponse>('http://127.0.0.1:5810/api/v1/admin/tdp/sessions')
  assert(
    !sessionsAfterManualDisconnect.data.some(item => item.terminalId === terminalId && item.disconnectedAt == null),
    'manual disconnect should not trigger automatic reconnect',
  )
  await persistor.flush()
  await persistor.pause()

  console.log('[tdp-client/dev][seed] terminalId:', terminalId)
  console.log('[tdp-client/dev][seed] sessionId:', sessionState.sessionId?.value)
  console.log('[tdp-client/dev][seed] lastCursor:', syncState.lastCursor?.value)
  console.log('[tdp-client/dev][seed] storage file:', TDP_DEV_STORAGE)

  return {
    terminalId,
    lastCursor: syncState.lastCursor!.value,
    lastAppliedRevision: syncState.lastAppliedRevision!.value,
  }
}

async function verifyPhase(expected?: SeedSummary): Promise<VerifySummary> {
  const health = await fetch('http://127.0.0.1:5810/health')
  assert(health.ok, `mock-terminal-platform health check failed: ${health.status}`)

  const {store, persistor} = await createApp()
  const {identity, credential} = await ensureActivated(store)

  const initialState = store.getState() as RootState
  const initialSession = selectTdpSessionState(initialState)
  const initialSync = selectTdpSyncState(initialState)
  const initialProjection = selectTdpProjectionState(initialState)
  const initialInbox = selectTdpCommandInboxState(initialState)

  assert(identity.terminalId, 'rehydrated terminalId missing before tdp reconnect')
  assert(credential.accessToken, 'rehydrated accessToken missing before tdp reconnect')
  assert(initialSync.lastCursor?.value && initialSync.lastCursor.value > 0, 'rehydrated lastCursor missing')
  assert(initialSync.lastAppliedRevision?.value && initialSync.lastAppliedRevision.value > 0, 'rehydrated lastAppliedRevision missing')
  assert(initialProjection.byTopic && Object.keys(initialProjection.byTopic).length === 0, 'projection cache should not be persisted')
  assert(initialInbox.orderedIds.length === 0, 'command inbox should not be persisted')
  assert(initialSession.sessionId == null, 'tdp session runtime fields should not be persisted')

  if (expected) {
    assert(identity.terminalId === expected.terminalId, 'terminalId mismatch after restart')
    assert(initialSync.lastCursor.value === expected.lastCursor, 'lastCursor mismatch after restart')
    assert(initialSync.lastAppliedRevision.value === expected.lastAppliedRevision, 'lastAppliedRevision mismatch after restart')
  }

  const readySession = await connectAndWaitReady()
  assert(readySession.syncMode?.value === 'incremental', `expected incremental sync, got ${readySession.syncMode?.value}`)

  const afterConnectState = store.getState() as RootState
  const afterConnectSync = selectTdpSyncState(afterConnectState)
  assert(afterConnectSync.lastCursor?.value === initialSync.lastCursor?.value, 'incremental reconnect should preserve cursor when no new changes')

  await disconnectTdp()
  await persistor.flush()
  await persistor.pause()

  const storageSnapshot = readFileStateStorageSnapshot(TDP_DEV_STORAGE)
  const persistedKeys = Object.keys(storageSnapshot)
  assert(persistedKeys.some(key => key.includes('tcpIdentity')), 'tcpIdentity key missing in persisted storage')
  assert(persistedKeys.some(key => key.includes('tcpCredential')), 'tcpCredential key missing in persisted storage')
  assert(persistedKeys.some(key => key.includes('tdpSync')), 'tdpSync key missing in persisted storage')
  assert(!persistedKeys.some(key => key.includes('tdpProjection')), 'tdpProjection should not be persisted')
  assert(!persistedKeys.some(key => key.includes('tdpCommandInbox')), 'tdpCommandInbox should not be persisted')
  assert(!persistedKeys.some(key => key.includes('tdpSession')), 'tdpSession should not be persisted')

  console.log('[tdp-client/dev][verify] terminalId:', identity.terminalId)
  console.log('[tdp-client/dev][verify] rehydrated cursor:', initialSync.lastCursor?.value)
  console.log('[tdp-client/dev][verify] syncMode:', readySession.syncMode?.value)
  console.log('[tdp-client/dev][verify] persisted keys:', persistedKeys.join(', '))

  return {
    terminalId: identity.terminalId,
    rehydratedCursor: initialSync.lastCursor!.value,
    syncMode: readySession.syncMode!.value,
  }
}

function runChildPhase(phase: Exclude<DevPhase, 'full'>) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, __filename], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TDP_CLIENT_DEV_PHASE: phase,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', chunk => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`phase ${phase} failed with code ${code}\n${stderr || stdout}`))
        return
      }
      resolve(stdout)
    })
  })
}

const extractJsonLine = <T>(output: string, prefix: string): T => {
  const line = output
    .split('\n')
    .map(item => item.trim())
    .find(item => item.startsWith(prefix))
  if (!line) {
    throw new Error(`missing output line ${prefix}`)
  }
  return JSON.parse(line.slice(prefix.length).trim()) as T
}

async function runFull() {
  resetFileStateStorage(TDP_DEV_STORAGE)
  const seedOutput = await runChildPhase('seed')
  const seedSummary = extractJsonLine<SeedSummary>(seedOutput, 'TDP_DEV_SEED_SUMMARY ')
  const verifyOutput = await runChildPhase('verify')
  const verifySummary = extractJsonLine<VerifySummary>(verifyOutput, 'TDP_DEV_VERIFY_SUMMARY ')

  assert(verifySummary.terminalId === seedSummary.terminalId, 'terminalId mismatch across tdp restart phases')
  assert(verifySummary.rehydratedCursor === seedSummary.lastCursor, 'tdp cursor mismatch across restart phases')
  assert(verifySummary.syncMode === 'incremental', `expected incremental verify sync mode, got ${verifySummary.syncMode}`)

  console.log('[tdp-client/dev] restart verified terminalId:', verifySummary.terminalId)
  console.log('[tdp-client/dev] restart verified cursor:', verifySummary.rehydratedCursor)
  console.log('[tdp-client/dev] storage file:', TDP_DEV_STORAGE)
}

async function run() {
  const phase = (process.env.TDP_CLIENT_DEV_PHASE as DevPhase | undefined) ?? 'full'

  if (phase === 'seed') {
    const summary = await seedPhase()
    console.log(`TDP_DEV_SEED_SUMMARY ${JSON.stringify(summary)}`)
    return
  }

  if (phase === 'verify') {
    const summary = await verifyPhase()
    console.log(`TDP_DEV_VERIFY_SUMMARY ${JSON.stringify(summary)}`)
    return
  }

  await runFull()
}

void run().catch(error => {
  console.error('[tdp-client/dev] failed:', error)
  process.exit(1)
})
