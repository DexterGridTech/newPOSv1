import net from 'node:net'
import {spawn, spawnSync} from 'node:child_process'
import {existsSync, mkdirSync, openSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'

export const scriptDir = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(scriptDir, '..')
export const androidAutomationScriptPath = resolve(repoRoot, 'scripts/android-automation-rpc.mjs')
export const portForwardScriptPath = resolve(repoRoot, 'scripts/setup-android-port-forwarding.mjs')

export const DEFAULT_PACKAGE_NAME = 'com.next.mixccateringassemblyrn84'
export const DEFAULT_PLATFORM_BASE_URL = 'http://127.0.0.1:5810'
export const DEFAULT_ADMIN_BASE_URL = 'http://127.0.0.1:5830'
export const DEFAULT_SANDBOX_ID = 'sandbox-kernel-base-test'
export const DEFAULT_TIMEOUT_MS = 45_000

const DEFAULT_ACTIVITY = `${DEFAULT_PACKAGE_NAME}/.MainActivity`

export const sleep = delay

export function logStep(message) {
  process.stderr.write(`[admin-mall-master-data-e2e] ${message}\n`)
}

export function fail(message, detail) {
  const error = new Error(detail ? `${message}\n${detail}` : message)
  error.shortMessage = message
  throw error
}

export function parseCommonArgs(argv, defaults = {}) {
  const options = {
    primarySerial: process.env.ANDROID_PRIMARY_SERIAL?.trim() || '',
    secondarySerial: process.env.ANDROID_SECONDARY_SERIAL?.trim() || '',
    platformBaseUrl: process.env.MOCK_TERMINAL_PLATFORM_BASE_URL?.trim() || DEFAULT_PLATFORM_BASE_URL,
    adminBaseUrl: process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_BASE_URL?.trim() || DEFAULT_ADMIN_BASE_URL,
    sandboxId: DEFAULT_SANDBOX_ID,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    packageName: DEFAULT_PACKAGE_NAME,
    activity: DEFAULT_ACTIVITY,
    ...defaults,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--primary-serial':
        options.primarySerial = argv[++index] ?? ''
        break
      case '--secondary-serial':
        options.secondarySerial = argv[++index] ?? ''
        break
      case '--platform-base-url':
        options.platformBaseUrl = argv[++index] ?? options.platformBaseUrl
        break
      case '--admin-base-url':
        options.adminBaseUrl = argv[++index] ?? options.adminBaseUrl
        break
      case '--sandbox-id':
        options.sandboxId = argv[++index] ?? options.sandboxId
        break
      case '--timeout':
        options.timeoutMs = Number(argv[++index] ?? options.timeoutMs)
        break
      case '--package':
        options.packageName = argv[++index] ?? options.packageName
        break
      case '--activity':
        options.activity = argv[++index] ?? options.activity
        break
      default:
        if (arg.startsWith('--')) {
          options[arg.slice(2)] = true
        }
        break
    }
  }

  return options
}

function resolveAdbExecutable() {
  const androidHome = process.env.ANDROID_HOME?.trim()
  return androidHome ? resolve(androidHome, 'platform-tools/adb') : 'adb'
}

const ADB = resolveAdbExecutable()

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.inherit ? 'inherit' : 'pipe',
  })
  if (result.error) {
    fail(`Failed to run ${command} ${args.join(' ')}`, result.error.message)
  }
  if (!options.allowFailure && result.status !== 0) {
    fail(
      `${command} ${args.join(' ')} failed`,
      [result.stdout, result.stderr].filter(Boolean).join('\n'),
    )
  }
  return result
}

export function runAdb(serial, args, options = {}) {
  const serialArgs = serial ? ['-s', serial] : []
  return runCommand(ADB, [...serialArgs, ...args], options)
}

export function listAndroidDevices() {
  const output = runAdb('', ['devices']).stdout
  return output
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/))
    .filter(parts => parts[1] === 'device')
    .map(parts => parts[0])
}

export function resolveDeviceTopology(options) {
  const devices = listAndroidDevices()
  const primarySerial = options.primarySerial || devices[0] || ''
  const secondarySerial = options.secondarySerial || devices.find(device => device !== primarySerial) || ''
  if (!primarySerial) {
    fail('No Android emulator/device found for primary terminal')
  }
  return {
    primarySerial,
    secondarySerial,
    devices,
  }
}

export function primaryEndpoint(primarySerial) {
  return {
    role: 'primary',
    serial: primarySerial,
    target: 'primary',
    hostPort: 18584,
    devicePort: 18584,
  }
}

export function secondaryEndpoint(primarySerial, secondarySerial) {
  if (secondarySerial) {
    return {
      role: 'secondary',
      serial: secondarySerial,
      target: 'primary',
      hostPort: 18586,
      devicePort: 18584,
    }
  }
  return {
    role: 'secondary',
    serial: primarySerial,
    target: 'secondary',
    hostPort: 18585,
    devicePort: 18585,
  }
}

export function rpcCall(endpoint, method, params = {}, options = {}) {
  const args = [
    androidAutomationScriptPath,
    'call',
    method,
    '--serial',
    endpoint.serial,
    '--target',
    endpoint.target,
    '--timeout',
    String(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    '--params',
    JSON.stringify({
      target: endpoint.target,
      ...params,
    }),
  ]
  if (endpoint.hostPort) {
    args.push('--host-port', String(endpoint.hostPort))
  }
  if (endpoint.devicePort) {
    args.push('--device-port', String(endpoint.devicePort))
  }
  if (options.noStart !== false) {
    args.push('--no-start')
  }

  const result = runCommand(process.execPath, args, {
    allowFailure: options.allowFailure,
  })
  if (result.status !== 0 && options.allowFailure) {
    return {
      ok: false,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  const raw = result.stdout.trim()
  if (!raw) {
    fail(`Automation RPC returned empty output: ${method}`, result.stderr)
  }
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    fail(
      `Automation RPC returned invalid JSON: ${method}`,
      `${error instanceof Error ? error.message : String(error)}\n${raw}`,
    )
  }
  if (payload.error) {
    fail(`Automation RPC failed: ${method}`, JSON.stringify(payload.error, null, 2))
  }
  return payload.result
}

export function dispatchCommand(endpoint, commandName, payload = {}, options = {}) {
  return rpcCall(endpoint, 'command.dispatch', {
    commandName,
    payload,
  }, options)
}

export function getCurrentScreen(endpoint, options = {}) {
  return rpcCall(endpoint, 'runtime.getCurrentScreen', {}, options)
}

export function getNode(endpoint, nodeId, options = {}) {
  return rpcCall(endpoint, 'ui.getNode', {nodeId}, options)
}

export function getState(endpoint, path, options = {}) {
  return rpcCall(endpoint, 'runtime.selectState', {path}, options)
}

export async function waitFor(predicate, timeoutMs, description, intervalMs = 500) {
  const startedAt = Date.now()
  let lastError = null
  let lastValue = null
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastValue = await predicate()
      if (lastValue) {
        return lastValue
      }
    } catch (error) {
      lastError = error
    }
    await delay(intervalMs)
  }
  fail(
    `${description} timed out after ${timeoutMs}ms`,
    lastError instanceof Error ? lastError.stack ?? lastError.message : JSON.stringify(lastValue),
  )
}

export async function waitForRpc(endpoint, method, params, timeoutMs) {
  return await waitFor(
    () => {
      const result = rpcCall(endpoint, method, params, {
        allowFailure: true,
        timeoutMs,
      })
      return result?.ok === false ? null : result
    },
    timeoutMs,
    `${endpoint.role} ${method}`,
  )
}

export async function waitForState(endpoint, path, predicate, timeoutMs, description) {
  return await waitFor(async () => {
    const value = getState(endpoint, path, {timeoutMs})
    return predicate(value) ? value : null
  }, timeoutMs, description)
}

export async function waitForScreenPart(endpoint, partKey, timeoutMs) {
  return await waitFor(async () => {
    const screen = getCurrentScreen(endpoint, {timeoutMs})
    return screen?.screen?.partKey === partKey ? screen : null
  }, timeoutMs, `${endpoint.role} screen ${partKey}`)
}

export async function waitForNodeText(endpoint, nodeId, expectedText, timeoutMs) {
  return await waitFor(async () => {
    const node = getNode(endpoint, nodeId, {timeoutMs})
    return node?.text === expectedText ? node : null
  }, timeoutMs, `${endpoint.role} node ${nodeId} text ${expectedText}`)
}

export async function requestJson(baseUrl, pathname, init = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    fail(
      `HTTP ${init.method ?? 'GET'} ${pathname} failed`,
      payload?.error?.message ?? `${response.status} ${response.statusText}`,
    )
  }
  return payload?.data ?? payload
}

export async function prepareKernelBaseTestPlatform(baseUrl) {
  return await requestJson(baseUrl, '/mock-debug/kernel-base-test/prepare', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function ensureHealth(baseUrl, serviceName) {
  const payload = await requestJson(baseUrl, '/health')
  if (payload?.status !== 'ok') {
    fail(`${serviceName} health check failed`, JSON.stringify(payload))
  }
  return payload
}

export async function isTcpListening(port, host = '127.0.0.1') {
  return await new Promise(resolve => {
    const socket = net.createConnection({host, port}, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.setTimeout(500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export function startDetachedYarnScript(scriptName, logPath) {
  mkdirSync(dirname(logPath), {recursive: true})
  writeFileSync(logPath, `\n\n=== ${new Date().toISOString()} ${scriptName} ===\n`, {flag: 'a'})
  const logFd = openSync(logPath, 'a')
  const child = spawn('corepack', ['yarn', scriptName], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })
  child.unref()
  return child.pid
}

export async function ensureService(input) {
  const listening = await isTcpListening(input.port)
  if (!listening) {
    const pid = startDetachedYarnScript(input.scriptName, input.logPath)
    logStep(`started ${input.name} with pid ${pid}; log=${input.logPath}`)
  } else {
    logStep(`${input.name} port ${input.port} is already listening`)
  }

  if (input.healthBaseUrl) {
    await waitFor(
      async () => {
        try {
          await ensureHealth(input.healthBaseUrl, input.name)
          return true
        } catch {
          return false
        }
      },
      input.timeoutMs,
      `${input.name} health`,
    )
    logStep(`${input.name} health is ok`)
    return
  }

  await waitFor(
    () => isTcpListening(input.port),
    input.timeoutMs,
    `${input.name} port ${input.port}`,
  )
  logStep(`${input.name} port ${input.port} is ready`)
}

export function setupAndroidPortForwarding(primarySerial) {
  const env = {
    ...process.env,
    ANDROID_TOPOLOGY_HOST_DEVICE_ID: primarySerial,
  }
  runCommand(process.execPath, [portForwardScriptPath, '--topology-host'], {
    env,
    inherit: true,
  })
}

export function clearHotUpdateMarkers(serial, packageName = DEFAULT_PACKAGE_NAME) {
  runAdb(serial, ['shell', 'am', 'force-stop', packageName], {allowFailure: true})
  runAdb(serial, [
    'shell',
    'run-as',
    packageName,
    'rm',
    '-f',
    'files/hot-updates/active-marker.json',
    'files/hot-updates/boot-marker.json',
    'files/hot-updates/rollback-marker.json',
  ], {allowFailure: true})
}

export function startAndroidApp(serial, packageName = DEFAULT_PACKAGE_NAME) {
  runAdb(serial, ['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1'], {
    allowFailure: true,
  })
}

export function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

export function assertTruthy(value, label) {
  if (!value) {
    fail(`${label}: expected truthy value`, JSON.stringify(value))
  }
}

export function priceText(price) {
  return `¥${price}`
}

export function fileExists(path) {
  return existsSync(path)
}
