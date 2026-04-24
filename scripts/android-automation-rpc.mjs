#!/usr/bin/env node

import net from 'node:net'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PRIMARY_PORT = 18584
const DEFAULT_SECONDARY_PORT = 18585
const DEFAULT_PACKAGE = 'com.next.mixccateringassemblyrn84'
const DEFAULT_MAIN_ACTIVITY = `${DEFAULT_PACKAGE}/.MainActivity`
const DEFAULT_TIMEOUT_MS = 8000
const TCP_IDENTITY_STATE_KEY = 'kernel.base.tcp-control-runtime-v2.identity'
const TCP_SANDBOX_STATE_KEY = 'kernel.base.tcp-control-runtime-v2.sandbox'
const ADMIN_LAUNCHER_NODE_IDS = [
  'ui-integration-catering-shell:admin-launcher',
]

function resolveAdbExecutable() {
  const androidHome = process.env.ANDROID_HOME?.trim()
  return androidHome ? path.join(androidHome, 'platform-tools', 'adb') : 'adb'
}

const ADB = resolveAdbExecutable()

function fail(message, detail) {
  if (message) {
    console.error(message)
  }
  if (detail) {
    console.error(detail)
  }
  process.exit(1)
}

function logInfo(message) {
  process.stderr.write(`${message}\n`)
}

function parseJson(value, fallback = undefined) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch (error) {
    fail(`Invalid JSON: ${value}`, error instanceof Error ? error.message : String(error))
  }
}

export function parseArgs(argv) {
  const options = {
    command: 'smoke',
    serial: process.env.ANDROID_SERIAL?.trim() || '',
    hostPort: undefined,
    devicePort: undefined,
    target: 'primary',
    packageName: DEFAULT_PACKAGE,
    activity: DEFAULT_MAIN_ACTIVITY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    method: '',
    params: undefined,
    raw: false,
    ensureStarted: true,
    nodeId: '',
    value: '',
    field: '',
    deviceId: '',
    slowMs: Number(process.env.ANDROID_AUTOMATION_SLOW_MS ?? '0'),
  }

  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--serial':
        options.serial = argv[++index] ?? ''
        break
      case '--host-port':
        options.hostPort = Number(argv[++index])
        break
      case '--device-port':
        options.devicePort = Number(argv[++index])
        break
      case '--target':
        options.target = argv[++index] ?? 'primary'
        break
      case '--package':
        options.packageName = argv[++index] ?? DEFAULT_PACKAGE
        break
      case '--activity':
        options.activity = argv[++index] ?? DEFAULT_MAIN_ACTIVITY
        break
      case '--timeout':
        options.timeoutMs = Number(argv[++index] ?? DEFAULT_TIMEOUT_MS)
        break
      case '--params':
        options.params = parseJson(argv[++index], {})
        break
      case '--raw':
        options.raw = true
        break
      case '--no-start':
        options.ensureStarted = false
        break
      case '--device-id':
        options.deviceId = argv[++index] ?? ''
        break
      case '--slow-ms':
        options.slowMs = Number(argv[++index] ?? 0)
        break
      default:
        positional.push(arg)
        break
    }
  }

  options.command = positional[0] ?? 'smoke'
  if (options.command === 'call') {
    options.method = positional[1] ?? ''
    if (options.params === undefined) {
      options.params = parseJson(positional[2], {})
    }
  } else if (options.command === 'press') {
    options.nodeId = positional[1] ?? ''
  } else if (options.command === 'type-virtual') {
    options.field = positional[1] ?? ''
    options.value = positional[2] ?? ''
  } else if (options.command === 'activate-device') {
    options.field = positional[1] ?? ''
    options.value = positional[2] ?? ''
    if (options.params === undefined) {
      options.params = {}
    }
  } else if (options.command === 'wait-activated') {
    options.field = positional[1] ?? ''
  } else if (options.command === 'admin-login') {
    options.value = positional[1] ?? ''
  }

  return options
}

function runAdb(args, {allowFailure = false, capture = true} = {}) {
  const serial = OPTIONS.serial ? ['-s', OPTIONS.serial] : []
  const result = spawnSync(ADB, [...serial, ...args], {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
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
  return {
    status: result.status ?? 0,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  }
}

function resolveDeviceSerial() {
  if (OPTIONS.serial) {
    return OPTIONS.serial
  }
  const output = runAdb(['devices']).stdout
  const devices = output
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split('\t'))
    .filter(parts => parts[1] === 'device')
    .map(parts => parts[0])
  if (devices.length === 0) {
    fail('No connected Android device/emulator found')
  }
  return devices[0]
}

function getTargetPort(target) {
  return target === 'secondary' ? DEFAULT_SECONDARY_PORT : DEFAULT_PRIMARY_PORT
}

function getResolvedPorts() {
  const devicePort = OPTIONS.devicePort ?? getTargetPort(OPTIONS.target)
  const hostPort = OPTIONS.hostPort ?? devicePort
  return {hostPort, devicePort}
}

function ensureAppStarted() {
  if (!OPTIONS.ensureStarted) {
    return
  }
  runAdb(['shell', 'am', 'start', '-n', OPTIONS.activity])
}

function setupForward(hostPort, devicePort) {
  runAdb(['forward', `tcp:${hostPort}`, `tcp:${devicePort}`])
  logInfo(`forwarded tcp:${hostPort} -> tcp:${devicePort}`)
}

function removeForward(hostPort) {
  runAdb(['forward', '--remove', `tcp:${hostPort}`], {allowFailure: true})
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function maybeSlowDown() {
  if (OPTIONS.slowMs > 0) {
    await delay(OPTIONS.slowMs)
  }
}

function sendRpc({host, port, method, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS}) {
  return new Promise((resolve, reject) => {
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      params,
    })
    const socket = net.createConnection({host, port})
    let buffer = ''
    let settled = false

    const done = (error, value) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) {
        reject(error)
        return
      }
      resolve(value)
    }

    socket.setTimeout(timeoutMs, () => {
      done(new Error(`socket timeout after ${timeoutMs}ms for ${method}`))
    })

    socket.on('connect', () => {
      socket.write(`${request}\n`)
    })

    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) {
        return
      }
      const line = buffer.slice(0, newlineIndex).trim()
      if (!line) {
        return
      }
      try {
        done(null, JSON.parse(line))
      } catch (error) {
        done(error)
      }
    })

    socket.on('end', () => {
      if (!settled) {
        done(new Error(`socket closed before response for ${method}`))
      }
    })

    socket.on('close', () => {
      if (!settled) {
        done(new Error(`socket closed before response for ${method}`))
      }
    })

    socket.on('error', error => {
      done(error)
    })
  })
}

export function unwrapJsonRpcResponse(response, context = 'json-rpc request') {
  if (response?.error) {
    const message = response.error.message || `${context} failed`
    const error = new Error(message)
    error.code = response.error.code
    error.data = response.error.data
    error.response = response
    throw error
  }
  return response?.result
}

async function waitForServer(host, port, timeoutMs) {
  const startedAt = Date.now()
  let lastError = ''
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const hello = await sendRpc({
        host,
        port,
        method: 'session.hello',
        timeoutMs: Math.min(1500, timeoutMs),
      })
      return hello
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      await delay(300)
    }
  }
  throw new Error(`automation host not ready on ${host}:${port}; lastError=${lastError}`)
}

async function callMethod(method, params = {}) {
  const {hostPort} = getResolvedPorts()
  return await sendRpc({
    host: DEFAULT_HOST,
    port: hostPort,
    method,
    params,
    timeoutMs: OPTIONS.timeoutMs,
  })
}

async function callMethodResult(method, params = {}) {
  return unwrapJsonRpcResponse(await callMethod(method, params), method)
}

export function normalizeVirtualKey(key) {
  const upper = String(key).toUpperCase()
  if (upper === ' ') {
    return 'space'
  }
  return upper
}

function formatAdminPasswordHour(date) {
  const year = `${date.getFullYear()}`
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  return `${year}${month}${day}${hour}`
}

export function deriveAdminPassword(deviceId, date = new Date()) {
  const seed = `${deviceId}${formatAdminPasswordHour(date)}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 131 + seed.charCodeAt(index)) >>> 0
  }
  const numeric = `${hash}${seed.length * 97}`
  return numeric.slice(-6).padStart(6, '0')
}

export function parseAndroidDate(value) {
  const date = new Date(String(value ?? '').trim())
  return Number.isNaN(date.getTime()) ? null : date
}

export function isLiveAutomationNode(node) {
  return !!node && node.stale !== true
}

export function buildVirtualKeyboardSequence(fieldNodeId, value, options = {}) {
  if (!fieldNodeId) {
    throw new Error('type-virtual requires <fieldNodeId> <value>')
  }
  const target = options.target ?? OPTIONS.target
  const timeoutMs = options.timeoutMs ?? OPTIONS.timeoutMs
  return [
    {
      method: 'ui.performAction',
      params: {
        target,
        nodeId: fieldNodeId,
        action: 'press',
      },
    },
    {
      method: 'wait.forNode',
      params: {
        target,
        testID: 'ui-base-virtual-keyboard',
        timeoutMs,
      },
    },
    {
      method: 'ui.performAction',
      params: {
        target,
        nodeId: 'ui-base-virtual-keyboard:key:clear',
        action: 'press',
      },
    },
    ...String(value).split('').map(key => ({
      method: 'ui.performAction',
      params: {
        target,
        nodeId: `ui-base-virtual-keyboard:key:${normalizeVirtualKey(key)}`,
        action: 'press',
      },
    })),
    {
      method: 'ui.performAction',
      params: {
        target,
        nodeId: 'ui-base-virtual-keyboard:key:enter',
        action: 'press',
      },
    },
    {
      method: 'wait.forIdle',
      params: {
        target,
        timeoutMs,
      },
    },
  ]
}

export function buildActivateDeviceSequence(sandboxId, activationCode, options = {}) {
  if (!sandboxId || !activationCode) {
    throw new Error('activate-device requires <sandboxId> <activationCode>')
  }
  const target = options.target ?? OPTIONS.target
  const timeoutMs = options.timeoutMs ?? OPTIONS.timeoutMs
  return [
    ...buildVirtualKeyboardSequence(
      'ui-base-terminal-activate-device:sandbox',
      sandboxId,
      {target, timeoutMs},
    ),
    ...buildVirtualKeyboardSequence(
      'ui-base-terminal-activate-device:input',
      activationCode,
      {target, timeoutMs},
    ),
    {
      method: 'ui.performAction',
      params: {
        target,
        nodeId: 'ui-base-terminal-activate-device:submit',
        action: 'press',
      },
    },
    {
      method: 'wait.forIdle',
      params: {
        target,
        timeoutMs,
      },
    },
  ]
}

export function buildWaitForActivatedSequence(expectedSandboxId, options = {}) {
  const target = options.target ?? OPTIONS.target
  const timeoutMs = options.timeoutMs ?? OPTIONS.timeoutMs
  const steps = [
    {
      method: 'wait.forState',
      params: {
        target,
        path: [TCP_IDENTITY_STATE_KEY, 'activationStatus'],
        equals: 'ACTIVATED',
        timeoutMs,
      },
    },
  ]

  if (expectedSandboxId) {
    steps.push({
      method: 'wait.forState',
      params: {
        target,
        path: [TCP_SANDBOX_STATE_KEY, 'sandboxId'],
        equals: expectedSandboxId,
        timeoutMs,
      },
    })
  }

  steps.push(
    {
      method: 'runtime.selectState',
      params: {
        target,
        path: [TCP_IDENTITY_STATE_KEY, 'terminalId'],
      },
    },
    {
      method: 'runtime.selectState',
      params: {
        target,
        path: [TCP_SANDBOX_STATE_KEY, 'sandboxId'],
      },
    },
  )

  return steps
}

async function pressNode(nodeId) {
  if (!nodeId) {
    fail('press requires <nodeId>')
  }
  return await callMethodResult('ui.performAction', {
    target: OPTIONS.target,
    nodeId,
    action: 'press',
  })
}

async function readNode(nodeId) {
  return await callMethodResult('ui.getNode', {
    target: OPTIONS.target,
    nodeId,
  })
}

async function waitForNodeValue(fieldNodeId, predicate, timeoutMs, description) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const node = await readNode(fieldNodeId)
    if (predicate(node)) {
      return node
    }
    await delay(50)
  }
  throw new Error(`NODE_VALUE_WAIT_TIMEOUT:${description}`)
}

async function waitForNodeText(nodeId, predicate, timeoutMs, description) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const node = await readNode(nodeId)
    if (predicate(String(node?.text ?? ''), node)) {
      return node
    }
    await delay(50)
  }
  throw new Error(`NODE_TEXT_WAIT_TIMEOUT:${description}`)
}

async function typeVirtualValue(fieldNodeId, value) {
  if (!fieldNodeId) {
    fail('type-virtual requires <fieldNodeId> <value>')
  }

  const timeoutMs = OPTIONS.timeoutMs
  await pressNode(fieldNodeId)
  await callMethodResult('wait.forNode', {
    target: OPTIONS.target,
    testID: 'ui-base-virtual-keyboard',
    timeoutMs,
  })
  await maybeSlowDown()
  await pressNode('ui-base-virtual-keyboard:key:clear')
  await waitForNodeValue(
    fieldNodeId,
    node => String(node?.value ?? '') === '',
    timeoutMs,
    `${fieldNodeId}:clear`,
  )
  await maybeSlowDown()

  let expectedValue = ''
  for (const key of String(value).split('')) {
    await pressNode(`ui-base-virtual-keyboard:key:${normalizeVirtualKey(key)}`)
    expectedValue += key
    await waitForNodeValue(
      fieldNodeId,
      node => {
        const actualValue = String(node?.value ?? node?.text ?? '')
        return actualValue.includes(expectedValue) || actualValue.length >= expectedValue.length
      },
      timeoutMs,
      `${fieldNodeId}:${expectedValue}`,
    )
    await maybeSlowDown()
  }

  await pressNode('ui-base-virtual-keyboard:key:enter')
  await maybeSlowDown()
  await callMethodResult('wait.forIdle', {
    target: OPTIONS.target,
    timeoutMs,
  })
  return await readNode(fieldNodeId)
}

async function activateDeviceFlow({sandboxId, activationCode}) {
  if (!sandboxId || !activationCode) {
    fail('activate-device requires <sandboxId> <activationCode>')
  }

  await typeVirtualValue('ui-base-terminal-activate-device:sandbox', sandboxId)
  await typeVirtualValue('ui-base-terminal-activate-device:input', activationCode)
  const submit = await pressNode('ui-base-terminal-activate-device:submit')
  const idle = await callMethodResult('wait.forIdle', {
    target: OPTIONS.target,
    timeoutMs: OPTIONS.timeoutMs,
  })

  const activation = await waitForActivated(sandboxId)
  return {submit, idle, activation}
}

async function waitForActivated(expectedSandboxId) {
  const steps = buildWaitForActivatedSequence(expectedSandboxId, {
    target: OPTIONS.target,
    timeoutMs: OPTIONS.timeoutMs,
  })
  let terminalId = null
  let sandboxId = null
  for (const step of steps) {
    const result = await callMethodResult(step.method, step.params)
    if (JSON.stringify(step.params?.path) === JSON.stringify([TCP_IDENTITY_STATE_KEY, 'terminalId'])) {
      terminalId = result ?? null
    }
    if (JSON.stringify(step.params?.path) === JSON.stringify([TCP_SANDBOX_STATE_KEY, 'sandboxId'])) {
      sandboxId = result ?? null
    }
  }

  return {
    activationStatus: 'ACTIVATED',
    terminalId,
    sandboxId,
  }
}

async function resolveDeviceId() {
  if (OPTIONS.deviceId) {
    return OPTIONS.deviceId
  }
  const node = await readNode('ui-base-admin-popup:device-id')
  const value = node?.value ?? node?.text
  const deviceId = typeof value === 'string' ? value.trim() : ''
  if (!deviceId) {
    throw new Error('ADMIN_DEVICE_ID_NOT_FOUND')
  }
  return deviceId
}

function readAndroidDate() {
  const output = runAdb(['shell', 'date', '+%Y-%m-%dT%H:%M:%S%z'], {allowFailure: true}).stdout
  const date = parseAndroidDate(output)
  if (date) {
    return date
  }
  logInfo(`unable to parse Android date "${output}", falling back to host time`)
  return new Date()
}

async function readOptionalNode(nodeId) {
  try {
    return await readNode(nodeId)
  } catch {
    return null
  }
}


async function resolveFirstLiveNode(nodeIds) {
  for (const nodeId of nodeIds) {
    const node = await readOptionalNode(nodeId)
    if (isLiveAutomationNode(node)) {
      return node
    }
  }
  return null
}

async function adminLoginFlow(password = '') {
  const existingPanel = await readOptionalNode('ui-base-admin-popup:panel')
  if (isLiveAutomationNode(existingPanel)) {
    return {alreadyLoggedIn: true, panel: existingPanel}
  }
  const launcher = await resolveFirstLiveNode(ADMIN_LAUNCHER_NODE_IDS)
  if (!launcher?.nodeId) {
    throw new Error('ADMIN_LAUNCHER_NOT_FOUND')
  }
  await pressNode(launcher.nodeId)
  await maybeSlowDown()
  await callMethodResult('wait.forNode', {
    target: OPTIONS.target,
    testID: 'ui-base-admin-popup:login',
    timeoutMs: OPTIONS.timeoutMs,
  })
  const deviceId = await resolveDeviceId()
  const resolvedPassword = password || deriveAdminPassword(deviceId, readAndroidDate())
  await typeVirtualValue('ui-base-admin-popup:password', resolvedPassword)
  await pressNode('ui-base-admin-popup:submit')
  await maybeSlowDown()
  const panel = await callMethodResult('wait.forNode', {
    target: OPTIONS.target,
    testID: 'ui-base-admin-popup:panel',
    timeoutMs: OPTIONS.timeoutMs,
  })
  return {deviceId, password: resolvedPassword, panel}
}

async function deactivateDeviceFlow() {
  const login = await adminLoginFlow(OPTIONS.value)
  await pressNode('ui-base-admin-popup:tab:terminal')
  await maybeSlowDown()
  await callMethodResult('wait.forNode', {
    target: OPTIONS.target,
    testID: 'ui-base-admin-section:terminal',
    timeoutMs: OPTIONS.timeoutMs,
  })
  await pressNode('ui-base-admin-section:terminal:deactivate')
  await maybeSlowDown()
  const screen = await callMethodResult('wait.forScreen', {
    target: OPTIONS.target,
    partKey: 'ui.base.terminal.activate-device',
    timeoutMs: OPTIONS.timeoutMs,
  })
  const message = await waitForNodeText(
    'ui-base-terminal-activate-device:message',
    text => text.length > 0,
    OPTIONS.timeoutMs,
    'deactivate-message',
  )
  return {login, screen, message}
}

function printOutput(value) {
  if (OPTIONS.raw && typeof value === 'string') {
    console.log(value)
    return
  }
  console.log(JSON.stringify(value, null, 2))
}

async function runSmoke() {
  const {hostPort, devicePort} = getResolvedPorts()
  ensureAppStarted()
  setupForward(hostPort, devicePort)
  const hello = await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
  const info = await callMethod('runtime.getInfo', {target: OPTIONS.target})
  const tree = await callMethod('ui.getTree', {target: OPTIONS.target})
  const idle = await callMethod('wait.forIdle', {target: OPTIONS.target, timeoutMs: 3000})

  const result = {
    serial: OPTIONS.serial,
    target: OPTIONS.target,
    hostPort,
    devicePort,
    hello,
    info,
    treeNodeCount: Array.isArray(tree?.result) ? tree.result.length : undefined,
    idle,
  }
  printOutput(result)
}

export async function main() {
  OPTIONS.serial = resolveDeviceSerial()

  switch (OPTIONS.command) {
    case 'forward': {
      const {hostPort, devicePort} = getResolvedPorts()
      setupForward(hostPort, devicePort)
      return
    }
    case 'remove-forward': {
      const {hostPort} = getResolvedPorts()
      removeForward(hostPort)
      logInfo(`removed tcp:${hostPort}`)
      return
    }
    case 'hello': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      printOutput(await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs))
      return
    }
    case 'call': {
      if (!OPTIONS.method) {
        fail('Usage: node scripts/android-automation-rpc.mjs call <method> [jsonParams]')
      }
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await callMethod(OPTIONS.method, OPTIONS.params ?? {}))
      return
    }
    case 'press': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await pressNode(OPTIONS.nodeId))
      return
    }
    case 'type-virtual': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await typeVirtualValue(OPTIONS.field, OPTIONS.value))
      return
    }
    case 'activate-device': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await activateDeviceFlow({
        sandboxId: OPTIONS.field,
        activationCode: OPTIONS.value,
      }))
      return
    }
    case 'admin-login': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await adminLoginFlow(OPTIONS.value))
      return
    }
    case 'deactivate-device': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await deactivateDeviceFlow())
      return
    }
    case 'wait-activated': {
      const {hostPort, devicePort} = getResolvedPorts()
      ensureAppStarted()
      setupForward(hostPort, devicePort)
      await waitForServer(DEFAULT_HOST, hostPort, OPTIONS.timeoutMs)
      printOutput(await waitForActivated(OPTIONS.field || undefined))
      return
    }
    case 'smoke':
      await runSmoke()
      return
    default:
      fail(`Unknown command: ${OPTIONS.command}`)
  }
}

const OPTIONS = parseArgs(process.argv.slice(2))
const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isEntrypoint) {
  main().catch(error => {
    fail(error instanceof Error ? error.message : String(error))
  })
}
