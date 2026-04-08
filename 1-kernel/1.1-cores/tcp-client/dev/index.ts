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
import {createFileStateStorage, readFileStateStorageSnapshot, resetFileStateStorage} from '../../shared-dev/fileStateStorage'
import {kernelCoreTcpClientModule, kernelCoreTcpClientCommands} from '../src'
import {
  selectTcpBindingSnapshot,
  selectTcpCredentialSnapshot,
  selectTcpIdentitySnapshot,
  selectTcpRuntimeState,
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

interface TaskInstancesResponse {
  success: boolean
  data: Array<{
    instanceId: string
    terminalId: string
    status: string
    deliveryStatus: string
  }>
}

interface TaskTraceResponse {
  success: boolean
  data: {
    instance: {
      instance_id?: string
      status?: string
      deliveryStatus?: string
      delivery_status?: string
      result?: unknown
    }
  }
}

type DevPhase = 'full' | 'seed' | 'verify'

interface SeedSummary {
  terminalId: string
  accessToken: string
  refreshToken: string
}

interface VerifySummary {
  terminalId: string
  persistedKeyCount: number
}

const TCP_DEV_STORAGE = path.join(
  process.cwd(),
  'ai-result',
  'dev-storage',
  'tcp-client.dev.storage.json',
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

async function createApp() {
  const appConfig: ApplicationConfig = {
    serverSpace: devServerSpace,
    environment: {
      deviceId: 'tcp-client-dev-device',
      production: false,
      screenMode: ScreenMode.DESKTOP,
      displayCount: 1,
      displayIndex: 0,
    },
    preInitiatedState: {},
    module: kernelCoreTcpClientModule,
  }

  registerStateStorage(createFileStateStorage({filePath: TCP_DEV_STORAGE}))
  const {store, persistor} = await ApplicationManager.getInstance().generateStore(appConfig)
  ApplicationManager.getInstance().init()
  await wait(150)
  return {store, persistor}
}

async function seedPhase(): Promise<SeedSummary> {
  const health = await fetch('http://127.0.0.1:5810/health')
  assert(health.ok, `mock-terminal-platform health check failed: ${health.status}`)

  resetFileStateStorage(TCP_DEV_STORAGE)
  const {store, persistor} = await createApp()

  const activationBatch = await requestJson<ActivationBatchResponse>(
    'http://127.0.0.1:5810/api/v1/admin/activation-codes/batch',
    {
      method: 'POST',
      body: JSON.stringify({count: 1}),
    },
  )
  const activationCode = activationBatch.data.codes[0]
  assert(activationCode, 'no activation code returned from mock-terminal-platform')

  const activateRequestId = `tcp-activate-${Date.now()}`
  await runCommandAndWait(
    activateRequestId,
    'kernel.core.tcpClient.activateTerminal',
    () => kernelCoreTcpClientCommands.activateTerminal({activationCode}).execute(activateRequestId),
  )

  const activatedState = store.getState()
  const identity = selectTcpIdentitySnapshot(activatedState as RootState)
  const credential = selectTcpCredentialSnapshot(activatedState as RootState)
  const binding = selectTcpBindingSnapshot(activatedState as RootState)
  const runtime = selectTcpRuntimeState(activatedState as RootState)

  assert(identity.activationStatus === 'ACTIVATED', `activationStatus mismatch: ${identity.activationStatus}`)
  assert(identity.terminalId, 'terminalId missing after activation')
  assert(credential.status === 'READY', `credential status mismatch: ${credential.status}`)
  assert(credential.accessToken, 'accessToken missing after activation')
  assert(credential.refreshToken, 'refreshToken missing after activation')
  assert(binding.platformId, 'platformId missing after activation')
  assert(binding.tenantId, 'tenantId missing after activation')
  assert(binding.brandId, 'brandId missing after activation')
  assert(binding.projectId, 'projectId missing after activation')
  assert(binding.storeId, 'storeId missing after activation')
  assert(binding.profileId, 'profileId missing after activation')
  assert(binding.templateId, 'templateId missing after activation')
  assert(runtime.lastActivationRequestId?.value, 'activation request id missing')

  const previousAccessToken = credential.accessToken
  const refreshRequestId = `tcp-refresh-${Date.now()}`
  await runCommandAndWait(
    refreshRequestId,
    'kernel.core.tcpClient.refreshCredential',
    () => kernelCoreTcpClientCommands.refreshCredential(undefined).execute(refreshRequestId),
  )

  const refreshedState = store.getState()
  const refreshedCredential = selectTcpCredentialSnapshot(refreshedState as RootState)
  const refreshedRuntime = selectTcpRuntimeState(refreshedState as RootState)
  assert(refreshedCredential.accessToken, 'accessToken missing after refresh')
  assert(refreshedCredential.accessToken !== previousAccessToken, 'accessToken did not change after refresh')
  assert(refreshedRuntime.lastRefreshRequestId?.value, 'lastRefreshRequestId missing')

  const release = await requestJson<TaskReleaseResponse>(
    'http://127.0.0.1:5810/api/v1/admin/tasks/releases',
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'tcp-client-dev',
        taskType: 'CONFIG_PUBLISH',
        sourceType: 'CONFIG',
        sourceId: 'tcp-client-dev',
        priority: 1,
        targetTerminalIds: [identity.terminalId],
        payload: {
          configVersion: 'tcp-client-dev',
        },
      }),
    },
  )
  assert(release.data.release.releaseId, 'task release not created')

  const instances = await requestJson<TaskInstancesResponse>('http://127.0.0.1:5810/api/v1/admin/tasks/instances')
  const instance = instances.data.find(item => item.terminalId === identity.terminalId)
  assert(instance, `task instance not found for terminal ${identity.terminalId}`)

  const reportRequestId = `tcp-report-${Date.now()}`
  await runCommandAndWait(
    reportRequestId,
    'kernel.core.tcpClient.reportTaskResult',
    () => kernelCoreTcpClientCommands.reportTaskResult({
      terminalId: identity.terminalId!,
      instanceId: instance.instanceId,
      status: 'COMPLETED',
      result: {source: 'tcp-client-dev'},
    }).execute(reportRequestId),
  )

  const reportedState = store.getState()
  const reportedRuntime = selectTcpRuntimeState(reportedState as RootState)
  assert(reportedRuntime.lastTaskReportRequestId?.value, 'lastTaskReportRequestId missing')
  assert(reportedRuntime.lastError?.value == null, 'tcp runtime lastError should be empty')

  const trace = await requestJson<TaskTraceResponse>(
    `http://127.0.0.1:5810/api/v1/admin/tasks/instances/${instance.instanceId}/trace`,
  )
  const traceStatus = trace.data.instance.status
  assert(traceStatus === 'COMPLETED', `task trace status mismatch: ${traceStatus}`)

  await persistor.flush()
  await persistor.pause()

  console.log('[tcp-client/dev][seed] terminalId:', identity.terminalId)
  console.log('[tcp-client/dev][seed] credentialStatus:', refreshedCredential.status)
  console.log('[tcp-client/dev][seed] binding profile/template:', binding.profileId ?? 'n/a', binding.templateId ?? 'n/a')
  console.log('[tcp-client/dev][seed] storage file:', TCP_DEV_STORAGE)

  return {
    terminalId: identity.terminalId!,
    accessToken: refreshedCredential.accessToken!,
    refreshToken: refreshedCredential.refreshToken!,
  }
}

async function verifyPhase(expected?: SeedSummary): Promise<VerifySummary> {
  const {store, persistor} = await createApp()
  await wait(250)

  const rehydratedState = store.getState() as RootState
  const identity = selectTcpIdentitySnapshot(rehydratedState)
  const credential = selectTcpCredentialSnapshot(rehydratedState)
  const binding = selectTcpBindingSnapshot(rehydratedState)
  const runtime = selectTcpRuntimeState(rehydratedState)

  assert(identity.activationStatus === 'ACTIVATED', `rehydrated activationStatus mismatch: ${identity.activationStatus}`)
  assert(identity.terminalId, 'rehydrated terminalId missing')
  assert(credential.status === 'READY', `rehydrated credential status mismatch: ${credential.status}`)
  assert(credential.accessToken, 'rehydrated accessToken missing')
  assert(credential.refreshToken, 'rehydrated refreshToken missing')
  assert(binding.platformId, 'rehydrated platformId missing')
  assert(binding.tenantId, 'rehydrated tenantId missing')
  assert(binding.brandId, 'rehydrated brandId missing')
  assert(binding.projectId, 'rehydrated projectId missing')
  assert(binding.storeId, 'rehydrated storeId missing')
  assert(binding.profileId, 'rehydrated profileId missing')
  assert(binding.templateId, 'rehydrated templateId missing')
  assert(runtime.bootstrapped.value === true, 'runtime bootstrapped should be rebuilt on restart')
  assert(runtime.lastActivationRequestId == null, 'runtime request ids should not be persisted')
  assert(runtime.lastRefreshRequestId == null, 'runtime refresh request id should not be persisted')
  assert(runtime.lastTaskReportRequestId == null, 'runtime task report request id should not be persisted')
  assert(runtime.lastError == null, 'runtime error should not be persisted')

  if (expected) {
    assert(identity.terminalId === expected.terminalId, 'terminalId mismatch after restart')
    assert(credential.accessToken === expected.accessToken, 'accessToken mismatch after restart')
    assert(credential.refreshToken === expected.refreshToken, 'refreshToken mismatch after restart')
  }

  await persistor.flush()
  await persistor.pause()

  const storageSnapshot = readFileStateStorageSnapshot(TCP_DEV_STORAGE)
  const persistedKeys = Object.keys(storageSnapshot)
  assert(persistedKeys.some(key => key.includes('tcpIdentity')), 'tcpIdentity key missing in persisted storage')
  assert(persistedKeys.some(key => key.includes('tcpCredential')), 'tcpCredential key missing in persisted storage')
  assert(persistedKeys.some(key => key.includes('tcpBinding')), 'tcpBinding key missing in persisted storage')
  assert(!persistedKeys.some(key => key.includes('tcpRuntime')), 'tcpRuntime should not be persisted')

  console.log('[tcp-client/dev][verify] terminalId:', identity.terminalId)
  console.log('[tcp-client/dev][verify] persisted keys:', persistedKeys.join(', '))

  return {
    terminalId: identity.terminalId,
    persistedKeyCount: persistedKeys.length,
  }
}

function runChildPhase(phase: Exclude<DevPhase, 'full'>) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, __filename], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TCP_CLIENT_DEV_PHASE: phase,
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
  resetFileStateStorage(TCP_DEV_STORAGE)
  const seedOutput = await runChildPhase('seed')
  const seedSummary = extractJsonLine<SeedSummary>(seedOutput, 'TCP_DEV_SEED_SUMMARY ')
  const verifyOutput = await runChildPhase('verify')
  const verifySummary = extractJsonLine<VerifySummary>(verifyOutput, 'TCP_DEV_VERIFY_SUMMARY ')

  assert(verifySummary.terminalId === seedSummary.terminalId, 'terminalId mismatch across tcp restart phases')
  console.log('[tcp-client/dev] restart verified terminalId:', verifySummary.terminalId)
  console.log('[tcp-client/dev] storage file:', TCP_DEV_STORAGE)
}

async function run() {
  const phase = (process.env.TCP_CLIENT_DEV_PHASE as DevPhase | undefined) ?? 'full'

  if (phase === 'seed') {
    const summary = await seedPhase()
    console.log(`TCP_DEV_SEED_SUMMARY ${JSON.stringify(summary)}`)
    return
  }

  if (phase === 'verify') {
    const summary = await verifyPhase()
    console.log(`TCP_DEV_VERIFY_SUMMARY ${JSON.stringify(summary)}`)
    return
  }

  await runFull()
}

void run().catch(error => {
  console.error('[tcp-client/dev] failed:', error)
  process.exit(1)
})
