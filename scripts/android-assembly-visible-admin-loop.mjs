#!/usr/bin/env node

import {spawnSync} from 'node:child_process'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {
  prepareActivation,
  resolveDefaultMockTerminalPlatformBaseUrl,
} from './mock-platform-prepare-activation.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const androidAutomationScriptPath = resolve(repoRoot, 'scripts/android-automation-rpc.mjs')

const DEFAULT_PACKAGE_NAME = 'com.next.mixcretailassemblyrn84'
const DEFAULT_MAIN_ACTIVITY = `${DEFAULT_PACKAGE_NAME}/.MainActivity`
const DEFAULT_TIMEOUT_MS = Number(process.env.ASSEMBLY_VISIBLE_AUTOMATION_TIMEOUT_MS ?? '15000')
const DEFAULT_SLOW_MS = Number(process.env.ASSEMBLY_VISIBLE_AUTOMATION_SLOW_MS ?? '500')
const DEFAULT_FINAL_PAUSE_MS = Number(process.env.ASSEMBLY_VISIBLE_AUTOMATION_FINAL_PAUSE_MS ?? '5000')
const DEFAULT_TARGET = 'primary'
const ACTIVATION_STATUS_PATH = ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus']
const TERMINAL_ID_PATH = ['kernel.base.tcp-control-runtime-v2.identity', 'terminalId']
const CREDENTIAL_STATUS_PATH = ['kernel.base.tcp-control-runtime-v2.credential', 'status']

function fail(message, detail) {
  if (message) {
    console.error(message)
  }
  if (detail) {
    console.error(detail)
  }
  process.exit(1)
}

function logStep(message) {
  process.stderr.write(`[assembly-visible-admin-loop] ${message}\n`)
}

function parseArgs(argv) {
  const options = {
    serial: process.env.ANDROID_SERIAL?.trim() || '',
    target: DEFAULT_TARGET,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    slowMs: DEFAULT_SLOW_MS,
    finalPauseMs: DEFAULT_FINAL_PAUSE_MS,
    packageName: DEFAULT_PACKAGE_NAME,
    activity: DEFAULT_MAIN_ACTIVITY,
    baseUrl: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--serial':
        options.serial = argv[++index] ?? ''
        break
      case '--target':
        options.target = argv[++index] ?? DEFAULT_TARGET
        break
      case '--timeout':
        options.timeoutMs = Number(argv[++index] ?? DEFAULT_TIMEOUT_MS)
        break
      case '--slow-ms':
        options.slowMs = Number(argv[++index] ?? DEFAULT_SLOW_MS)
        break
      case '--final-pause-ms':
        options.finalPauseMs = Number(argv[++index] ?? DEFAULT_FINAL_PAUSE_MS)
        break
      case '--package':
        options.packageName = argv[++index] ?? DEFAULT_PACKAGE_NAME
        break
      case '--activity':
        options.activity = argv[++index] ?? DEFAULT_MAIN_ACTIVITY
        break
      case '--base-url':
        options.baseUrl = argv[++index] ?? ''
        break
      default:
        break
    }
  }

  return options
}

function runAdb(args, {allowFailure = false} = {}) {
  const serialArgs = OPTIONS.serial ? ['-s', OPTIONS.serial] : []
  const result = spawnSync('adb', [...serialArgs, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) {
    fail(`Failed to run adb ${args.join(' ')}`, result.error.message)
  }
  if (!allowFailure && result.status !== 0) {
    fail(
      `adb ${args.join(' ')} failed`,
      [result.stdout, result.stderr].filter(Boolean).join('\n'),
    )
  }
  return result
}

function readAdbStdout(args, options = {}) {
  return runAdb(args, options).stdout.trim()
}

function ensureAdbReverseForPort(port) {
  runAdb(['reverse', `tcp:${port}`, `tcp:${port}`])
}

async function ensureMockPlatformHealthy(baseUrl) {
  const response = await fetch(new URL('/health', baseUrl))
  if (!response.ok) {
    throw new Error(`mock platform health check failed: ${response.status} ${response.statusText}`)
  }
  const payload = await response.json().catch(() => null)
  if (!payload?.success || payload?.data?.status !== 'ok') {
    throw new Error(`mock platform health payload invalid: ${JSON.stringify(payload)}`)
  }
}

function buildAutomationArgs(command, {
  positional = [],
  params,
  ensureStarted = false,
  target = OPTIONS.target,
} = {}) {
  const args = [androidAutomationScriptPath, command]
  if (OPTIONS.serial) {
    args.push('--serial', OPTIONS.serial)
  }
  args.push(
    '--timeout',
    String(OPTIONS.timeoutMs),
    '--target',
    target,
    '--package',
    OPTIONS.packageName,
    '--activity',
    OPTIONS.activity,
    '--slow-ms',
    String(OPTIONS.slowMs),
  )
  if (!ensureStarted) {
    args.push('--no-start')
  }
  if (params !== undefined) {
    args.push('--params', JSON.stringify(params))
  }
  args.push(...positional)
  return args
}

function runAutomationCommand(command, input = {}) {
  const result = spawnSync(
    process.execPath,
    buildAutomationArgs(command, input),
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )
  if (result.error) {
    fail(`Automation command failed: ${command}`, result.error.message)
  }
  if (result.status !== 0) {
    fail(
      `Automation command failed: ${command}`,
      [result.stdout, result.stderr].filter(Boolean).join('\n'),
    )
  }
  const output = result.stdout.trim()
  if (!output) {
    return null
  }
  try {
    return JSON.parse(output)
  } catch (error) {
    fail(
      `Automation command returned invalid JSON: ${command}`,
      error instanceof Error ? `${error.message}\n${output}` : String(error),
    )
  }
}

function unwrapJsonRpcResult(response, method) {
  if (response?.error) {
    fail(
      `Automation RPC failed: ${method}`,
      JSON.stringify(response.error, null, 2),
    )
  }
  return response?.result
}

function callRpcResult(method, params, {ensureStarted = false} = {}) {
  const response = runAutomationCommand('call', {
    ensureStarted,
    positional: [method],
    params,
  })
  return unwrapJsonRpcResult(response, method)
}

function callRpcResultOnTarget(target, method, params = {}, {ensureStarted = false} = {}) {
  const response = runAutomationCommand('call', {
    ensureStarted,
    target,
    positional: [method],
    params: {
      target,
      ...params,
    },
  })
  return unwrapJsonRpcResult(response, `${target}:${method}`)
}

function assertSecondaryActivityVisible(label) {
  const activityDump = readAdbStdout(['shell', 'dumpsys', 'activity', 'activities'])
  if (!activityDump.includes(`${OPTIONS.packageName}/.SecondaryActivity`)) {
    fail(`${label}: SecondaryActivity is not present in activity stack`)
  }
  if (!activityDump.includes('displayId=2')) {
    fail(`${label}: displayId=2 is not present in activity dump`)
  }
  const secondaryPid = readAdbStdout(
    ['shell', 'pidof', `${OPTIONS.packageName}:secondary`],
    {allowFailure: true},
  )
  if (!secondaryPid) {
    fail(`${label}: secondary process is not alive`)
  }
  return {secondaryPid}
}

function readSecondaryActivityProof() {
  const activityDump = readAdbStdout(['shell', 'dumpsys', 'activity', 'activities'])
  const secondaryPid = readAdbStdout(
    ['shell', 'pidof', `${OPTIONS.packageName}:secondary`],
    {allowFailure: true},
  )
  return {
    hasActivity: activityDump.includes(`${OPTIONS.packageName}/.SecondaryActivity`),
    hasDisplay2: activityDump.includes('displayId=2'),
    secondaryPid,
  }
}

function readSecondaryAutomationProof() {
  const hello = runAutomationCommand('hello', {
    ensureStarted: false,
    target: 'secondary',
  })
  const treeResponse = runAutomationCommand('call', {
    ensureStarted: false,
    target: 'secondary',
    positional: ['ui.getTree'],
    params: {
      target: 'secondary',
    },
  })
  const tree = treeResponse ? unwrapJsonRpcResult(treeResponse, 'secondary ui.getTree') : null
  const activity = readSecondaryActivityProof()
  return {
    hello,
    treeResponse,
    treeNodeCount: Array.isArray(tree) ? tree.length : 0,
    activity,
  }
}

function assertSecondaryAutomationAlive(label) {
  const proof = readSecondaryAutomationProof()
  if (proof.treeNodeCount === 0) {
    fail(`${label}: secondary automation tree is empty`, JSON.stringify(proof, null, 2))
  }
  if (!proof.activity.hasActivity) {
    fail(`${label}: SecondaryActivity is not present in activity stack`, JSON.stringify(proof, null, 2))
  }
  if (!proof.activity.hasDisplay2) {
    fail(`${label}: displayId=2 is not present in activity dump`, JSON.stringify(proof, null, 2))
  }
  if (!proof.activity.secondaryPid) {
    fail(`${label}: secondary process is not alive`, JSON.stringify(proof, null, 2))
  }

  return {
    hello: proof.hello,
    treeNodeCount: proof.treeNodeCount,
    activity: {secondaryPid: proof.activity.secondaryPid},
  }
}

function assertSecondaryAlive(label) {
  const proof = assertSecondaryAutomationAlive(label)
  logStep(`${label}: secondary alive pid=${proof.activity.secondaryPid} treeNodes=${proof.treeNodeCount}`)
  return proof
}

async function waitForSecondaryAlive(label) {
  const startedAt = Date.now()
  let latestProof = null
  while (Date.now() - startedAt < OPTIONS.timeoutMs) {
    latestProof = readSecondaryAutomationProof()
    if (
      latestProof.treeNodeCount > 0 &&
      latestProof.activity.hasActivity &&
      latestProof.activity.hasDisplay2 &&
      latestProof.activity.secondaryPid
    ) {
      logStep(`${label}: secondary alive pid=${latestProof.activity.secondaryPid} treeNodes=${latestProof.treeNodeCount}`)
      return latestProof
    }
    await delay(Math.max(300, Math.min(OPTIONS.slowMs, 1000)))
  }
  fail(`${label}: secondary automation did not become ready`, JSON.stringify(latestProof, null, 2))
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function expectTextPrefix(actual, expectedPrefix, label) {
  if (typeof actual !== 'string' || !actual.startsWith(expectedPrefix)) {
    fail(`${label}: expected prefix ${JSON.stringify(expectedPrefix)}, got ${JSON.stringify(actual)}`)
  }
}

function expectTruthy(value, label) {
  if (!value) {
    fail(`${label}: expected truthy value`, JSON.stringify(value))
  }
}

function getNode(target, nodeId) {
  return callRpcResultOnTarget(target, 'ui.getNode', {nodeId})
}

function getStateValue(target, path) {
  return callRpcResultOnTarget(target, 'runtime.selectState', {path})
}

function waitForScreen(target, partKey) {
  return callRpcResultOnTarget(target, 'wait.forScreen', {
    partKey,
    timeoutMs: OPTIONS.timeoutMs,
  })
}

function assertPreActivationUi() {
  expectEqual(
    waitForScreen('primary', 'ui.base.terminal.activate-device')?.screen?.partKey,
    'ui.base.terminal.activate-device',
    'pre-activation primary screen',
  )
  expectEqual(
    waitForScreen('secondary', 'ui.base.terminal.activate-device-secondary')?.screen?.partKey,
    'ui.base.terminal.activate-device-secondary',
    'pre-activation secondary screen',
  )

  expectEqual(
    getNode('primary', 'ui-base-terminal-activate-device:title')?.text,
    '设备激活',
    'pre-activation primary title',
  )
  expectEqual(
    getNode('secondary', 'ui-base-terminal-activate-device-secondary:title')?.text,
    '等待主屏完成设备激活',
    'pre-activation secondary title',
  )
  expectEqual(
    getNode('secondary', 'ui-base-terminal-activate-device-secondary:display-mode')?.value,
    'SECONDARY',
    'pre-activation secondary displayMode',
  )
  expectTruthy(
    getNode('secondary', 'ui-base-terminal-activate-device-secondary:device-id')?.value,
    'pre-activation secondary deviceId',
  )

  expectEqual(
    getStateValue('primary', ACTIVATION_STATUS_PATH),
    'UNACTIVATED',
    'pre-activation primary activationStatus',
  )
  expectEqual(
    getStateValue('secondary', ACTIVATION_STATUS_PATH),
    'UNACTIVATED',
    'pre-activation secondary activationStatus',
  )
  expectEqual(
    getStateValue('secondary', ['kernel.base.topology-runtime-v3.context', 'displayMode']),
    'SECONDARY',
    'pre-activation secondary topology displayMode',
  )
}

function assertActivatedUi(terminalId) {
  expectEqual(
    waitForScreen('primary', 'ui.business.catering-master-data-workbench.primary-workbench')?.screen?.partKey,
    'ui.business.catering-master-data-workbench.primary-workbench',
    'activated primary screen',
  )
  expectEqual(
    waitForScreen('secondary', 'ui.business.catering-master-data-workbench.secondary-workbench')?.screen?.partKey,
    'ui.business.catering-master-data-workbench.secondary-workbench',
    'activated secondary screen',
  )

  expectTextPrefix(
    getNode('primary', 'ui-business-catering-master-data-workbench:title')?.text,
    '欢迎进入零售终端',
    'activated primary title',
  )
  expectTextPrefix(
    getNode('secondary', 'ui-business-catering-master-data-workbench:title')?.text,
    '欢迎来到万象城',
    'activated secondary title',
  )
  expectEqual(
    getNode('primary', 'ui-business-catering-master-data-workbench:terminal-id')?.value,
    terminalId,
    'activated primary terminalId',
  )
  expectEqual(
    getNode('secondary', 'ui-business-catering-master-data-workbench:terminal-id')?.value,
    terminalId,
    'activated secondary terminalId',
  )

  expectEqual(
    getStateValue('primary', ACTIVATION_STATUS_PATH),
    'ACTIVATED',
    'activated primary activationStatus',
  )
  expectEqual(
    getStateValue('secondary', ACTIVATION_STATUS_PATH),
    'ACTIVATED',
    'activated secondary activationStatus',
  )
  expectEqual(
    getStateValue('secondary', TERMINAL_ID_PATH),
    terminalId,
    'activated secondary terminalId state',
  )
}

function assertDeactivatedUi() {
  expectEqual(
    waitForScreen('primary', 'ui.base.terminal.activate-device')?.screen?.partKey,
    'ui.base.terminal.activate-device',
    'deactivated primary screen',
  )
  expectEqual(
    waitForScreen('secondary', 'ui.base.terminal.activate-device-secondary')?.screen?.partKey,
    'ui.base.terminal.activate-device-secondary',
    'deactivated secondary screen',
  )

  expectEqual(
    getNode('primary', 'ui-base-terminal-activate-device:title')?.text,
    '设备激活',
    'deactivated primary title',
  )
  expectEqual(
    getNode('secondary', 'ui-base-terminal-activate-device-secondary:title')?.text,
    '等待主屏完成设备激活',
    'deactivated secondary title',
  )
  expectEqual(
    getNode('secondary', 'ui-base-terminal-activate-device-secondary:display-mode')?.value,
    'SECONDARY',
    'deactivated secondary displayMode',
  )

  expectEqual(
    getStateValue('primary', ACTIVATION_STATUS_PATH),
    'UNACTIVATED',
    'deactivated primary activationStatus',
  )
  expectEqual(
    getStateValue('secondary', ACTIVATION_STATUS_PATH),
    'UNACTIVATED',
    'deactivated secondary activationStatus',
  )
  expectEqual(
    getStateValue('primary', CREDENTIAL_STATUS_PATH),
    'EMPTY',
    'deactivated primary credentialStatus',
  )
  expectEqual(
    getStateValue('secondary', CREDENTIAL_STATUS_PATH),
    'EMPTY',
    'deactivated secondary credentialStatus',
  )
}

async function waitFor(predicate, timeoutMs, description) {
  const startedAt = Date.now()
  let lastValue = null
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await predicate()
    if (lastValue) {
      return lastValue
    }
    await delay(300)
  }
  throw new Error(`${description} timeout after ${timeoutMs}ms; lastValue=${JSON.stringify(lastValue)}`)
}

async function listTerminals(baseUrl, sandboxId) {
  const url = new URL('/api/v1/admin/terminals', baseUrl)
  url.searchParams.set('sandboxId', sandboxId)
  return await waitFor(async () => {
    try {
      const response = await fetch(url)
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        return null
      }
      return payload.data
    } catch {
      return null
    }
  }, Math.max(3_000, Math.min(OPTIONS.timeoutMs, 8_000)), 'list terminals availability')
}

async function waitForTerminalLifecycle(baseUrl, sandboxId, terminalId, lifecycleStatus, timeoutMs) {
  return await waitFor(async () => {
    const terminals = await listTerminals(baseUrl, sandboxId)
    return terminals.find(item =>
      item.terminalId === terminalId && item.lifecycleStatus === lifecycleStatus,
    ) ?? null
  }, timeoutMs, `terminal lifecycle ${lifecycleStatus}`)
}

async function ensureStartState() {
  const currentStatus = callRpcResult('runtime.selectState', {
    target: OPTIONS.target,
    path: ACTIVATION_STATUS_PATH,
  })

  if (currentStatus === 'UNACTIVATED') {
    return
  }

  if (currentStatus !== 'ACTIVATED') {
    fail(
      'Unsupported starting activation status for visible admin loop',
      JSON.stringify({activationStatus: currentStatus}),
    )
  }

  logStep('normalizing app state back to activation screen')
  runAutomationCommand('deactivate-device', {
    positional: [],
  })
  callRpcResult('wait.forState', {
    target: OPTIONS.target,
    path: CREDENTIAL_STATUS_PATH,
    equals: 'EMPTY',
    timeoutMs: OPTIONS.timeoutMs,
  })
  await delay(Math.max(500, OPTIONS.slowMs))
}

async function main() {
  const baseUrl = OPTIONS.baseUrl || resolveDefaultMockTerminalPlatformBaseUrl()
  const runtimeBaseUrl = new URL(baseUrl)

  if (runtimeBaseUrl.hostname === '127.0.0.1' || runtimeBaseUrl.hostname === 'localhost') {
    logStep(`ensuring adb reverse for mock platform port ${runtimeBaseUrl.port || '80'}`)
    ensureAdbReverseForPort(Number(runtimeBaseUrl.port || (runtimeBaseUrl.protocol === 'https:' ? 443 : 80)))
  }

  logStep('ensuring adb reverse for Metro port 8081')
  runAdb(['reverse', 'tcp:8081', 'tcp:8081'], {allowFailure: true})

  logStep(`checking mock platform health at ${baseUrl}`)
  await ensureMockPlatformHealthy(baseUrl)

  logStep('preparing activation code from mock platform')
  const activation = await prepareActivation({baseUrl})

  logStep('connecting to automation host and bringing app to foreground')
  runAutomationCommand('hello', {
    ensureStarted: true,
  })
  await waitForSecondaryAlive('before flow')

  await ensureStartState()
  assertSecondaryAlive('after normalize')
  assertPreActivationUi()

  logStep(`activating sandbox ${activation.sandboxId} on visible emulator UI`)
  runAutomationCommand('activate-device', {
    positional: [activation.sandboxId, activation.activationCode],
  })
  assertSecondaryAlive('after activation submit')

  callRpcResult('wait.forScreen', {
    target: OPTIONS.target,
    partKey: 'ui.business.catering-master-data-workbench.primary-workbench',
    timeoutMs: OPTIONS.timeoutMs,
  })

  const terminalId = callRpcResult('runtime.selectState', {
    target: OPTIONS.target,
    path: TERMINAL_ID_PATH,
  })
  if (!terminalId) {
    fail('Terminal ID not found after activation')
  }
  assertActivatedUi(terminalId)

  logStep(`waiting for server terminal ${terminalId} to become ACTIVE`)
  await waitForTerminalLifecycle(
    baseUrl,
    activation.sandboxId,
    terminalId,
    'ACTIVE',
    OPTIONS.timeoutMs,
  )

  await delay(Math.max(500, OPTIONS.slowMs))
  assertSecondaryAlive('after server active proof')

  logStep('opening admin popup and deactivating terminal through visible UI')
  runAutomationCommand('deactivate-device')
  assertSecondaryAlive('after deactivation submit')

  callRpcResult('wait.forState', {
    target: OPTIONS.target,
    path: ACTIVATION_STATUS_PATH,
    equals: 'UNACTIVATED',
    timeoutMs: OPTIONS.timeoutMs,
  })
  callRpcResult('wait.forState', {
    target: OPTIONS.target,
    path: CREDENTIAL_STATUS_PATH,
    equals: 'EMPTY',
    timeoutMs: OPTIONS.timeoutMs,
  })
  callRpcResult('wait.forScreen', {
    target: OPTIONS.target,
    partKey: 'ui.base.terminal.activate-device',
    timeoutMs: OPTIONS.timeoutMs,
  })

  logStep(`waiting for server terminal ${terminalId} to become DEACTIVATED`)
  await waitForTerminalLifecycle(
    baseUrl,
    activation.sandboxId,
    terminalId,
    'DEACTIVATED',
    OPTIONS.timeoutMs,
  )
  assertDeactivatedUi()

  if (OPTIONS.finalPauseMs > 0) {
    assertSecondaryAlive('before final hold')
    logStep(`holding final screen for ${OPTIONS.finalPauseMs}ms`)
    await delay(OPTIONS.finalPauseMs)
    assertSecondaryAlive('after final hold')
  }

  console.log(JSON.stringify({
    success: true,
    serial: OPTIONS.serial || null,
    target: OPTIONS.target,
    sandboxId: activation.sandboxId,
    activationCode: activation.activationCode,
    terminalId,
    baseUrl,
  }, null, 2))
}

const OPTIONS = parseArgs(process.argv.slice(2))

main().catch(error => {
  fail(
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? error.stack : undefined,
  )
})
