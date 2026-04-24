#!/usr/bin/env node

import {prepareActivation} from './mock-platform-prepare-activation.mjs'
import {
  DEFAULT_TIMEOUT_MS,
  clearHotUpdateMarkers,
  dispatchCommand,
  ensureHealth,
  ensureService,
  getCurrentScreen,
  getState,
  logStep,
  parseCommonArgs,
  prepareKernelBaseTestPlatform,
  primaryEndpoint,
  repoRoot,
  requestJson,
  resolveDeviceTopology,
  secondaryEndpoint,
  setupAndroidPortForwarding,
  sleep,
  startAndroidApp,
  waitForRpc,
  waitForScreenPart,
  waitForState,
  runCommand,
} from './admin-mall-tenant-master-data-e2e-support.mjs'

const options = parseCommonArgs(process.argv.slice(2), {
  resetToActivation: false,
  relaunchApp: false,
  cleanHotUpdate: false,
  ensureActivated: false,
  activationCode: '',
})

for (const arg of process.argv.slice(2)) {
  if (arg === '--reset-to-activation') {
    options.resetToActivation = true
  }
  if (arg === '--relaunch-app') {
    options.relaunchApp = true
  }
  if (arg === '--clean-hot-update') {
    options.cleanHotUpdate = true
  }
  if (arg === '--ensure-activated') {
    options.ensureActivated = true
  }
}
for (let index = 0; index < process.argv.length; index += 1) {
  if (process.argv[index] === '--activation-code') {
    options.activationCode = process.argv[index + 1] ?? ''
  }
}

const logDir = `${repoRoot}/.omx/logs`

async function normalizeTopology(primary, secondary) {
  if (secondary.serial === primary.serial && secondary.target === 'secondary') {
    logStep('single-device dual-screen topology detected; skip external slave locator rewrite')
    return
  }

  logStep('forcing secondary locator to 10.0.2.2:18889 for dual-emulator topology')
  dispatchCommand(secondary, 'kernel.base.topology-runtime-v3.set-master-locator', {
    masterLocator: {
      masterNodeId: getState(primary, ['kernel.base.topology-runtime-v3.context', 'localNodeId']) ?? 'master:unknown',
      masterDeviceId: getState(primary, ['kernel.base.tcp-control-runtime-v2.identity', 'deviceFingerprint']) ?? '',
      serverAddress: [{address: 'ws://10.0.2.2:18889/mockMasterServer/ws'}],
      httpBaseUrl: 'http://10.0.2.2:18889/mockMasterServer',
      addedAt: Date.now(),
    },
  })
  dispatchCommand(secondary, 'kernel.base.topology-runtime-v3.restart-topology-connection', {})

  await waitForState(
    secondary,
    ['kernel.base.topology-runtime-v3.sync', 'status'],
    value => value === 'active',
    options.timeoutMs,
    'secondary topology sync active',
  )
}

async function maybeRelaunch(topology) {
  if (!options.cleanHotUpdate && !options.relaunchApp) {
    for (const endpoint of topology) {
      logStep(`bringing app to foreground on ${endpoint.role} (${endpoint.serial})`)
      startAndroidApp(endpoint.serial, options.packageName)
    }
    await Promise.all(topology.map(endpoint => waitForRpc(endpoint, 'runtime.getInfo', {}, options.timeoutMs)))
    return
  }

  for (const endpoint of topology) {
    if (options.cleanHotUpdate) {
      logStep(`clearing hot-update markers on ${endpoint.role} (${endpoint.serial})`)
      clearHotUpdateMarkers(endpoint.serial, options.packageName)
    }
    logStep(`relaunching app on ${endpoint.role} (${endpoint.serial})`)
    startAndroidApp(endpoint.serial, options.packageName)
  }

  await Promise.all(topology.map(endpoint => waitForRpc(endpoint, 'runtime.getInfo', {}, options.timeoutMs)))
  await sleep(2_000)
}

async function maybeResetToActivation(primary, secondary) {
  if (!options.resetToActivation) {
    return
  }
  logStep('resetting tcp-control on primary to restore activation screen')
  dispatchCommand(primary, 'kernel.base.tcp-control-runtime-v2.reset-tcp-control', {})
  await waitForScreenPart(primary, 'ui.base.terminal.activate-device', options.timeoutMs)
  await waitForScreenPart(secondary, 'ui.base.terminal.activate-device-secondary', options.timeoutMs)
}

async function maybeEnsureActivated(primary, secondary) {
  if (!options.ensureActivated) {
    return
  }

  const currentStatus = getState(primary, ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus'])
  const tdpSessionStatus = getState(primary, ['kernel.base.tdp-sync-runtime-v2.session', 'status'])
  const tdpDisconnectReason = getState(primary, ['kernel.base.tdp-sync-runtime-v2.session', 'disconnectReason'])
  if (currentStatus === 'ACTIVATED') {
    if (tdpSessionStatus === 'READY') {
      logStep('terminal is already activated and TDP session is READY; skip activation')
      return
    }
    logStep(`terminal is activated but TDP is ${String(tdpSessionStatus)}; resetting for rebind (${String(tdpDisconnectReason ?? 'no reason')})`)
    dispatchCommand(primary, 'kernel.base.tcp-control-runtime-v2.reset-tcp-control', {})
    await waitForScreenPart(primary, 'ui.base.terminal.activate-device', options.timeoutMs)
    await waitForScreenPart(secondary, 'ui.base.terminal.activate-device-secondary', options.timeoutMs)
  }

  if (currentStatus !== 'UNACTIVATED') {
    logStep(`activation status is ${String(currentStatus)}; resetting to activation first`)
    dispatchCommand(primary, 'kernel.base.tcp-control-runtime-v2.reset-tcp-control', {})
    await waitForScreenPart(primary, 'ui.base.terminal.activate-device', options.timeoutMs)
    await waitForScreenPart(secondary, 'ui.base.terminal.activate-device-secondary', options.timeoutMs)
  }

  const activation = await prepareActivation({
    baseUrl: options.platformBaseUrl,
    sandboxId: options.sandboxId,
  })
  const activationCode = options.activationCode || activation.activationCode
  logStep(`activating terminal with code ${activationCode}`)

  const activateScriptArgs = [
    'scripts/android-automation-rpc.mjs',
    'activate-device',
    options.sandboxId,
    activationCode,
    '--serial',
    primary.serial,
    '--target',
    primary.target,
    '--timeout',
    String(options.timeoutMs),
  ]
  runCommand(process.execPath, activateScriptArgs)

  await waitForScreenPart(primary, 'ui.business.catering-master-data-workbench.primary-workbench', options.timeoutMs)
  await waitForScreenPart(secondary, 'ui.business.catering-master-data-workbench.secondary-workbench', options.timeoutMs)
  await waitForState(
    primary,
    ['kernel.base.tdp-sync-runtime-v2.session', 'status'],
    value => value === 'READY',
    options.timeoutMs,
    'primary TDP session ready after activation',
  )
}

async function main() {
  await ensureService({
    name: 'mock-terminal-platform',
    scriptName: 'mock:platform:dev',
    port: 5810,
    healthBaseUrl: options.platformBaseUrl,
    logPath: `${logDir}/mock-terminal-platform.dev.log`,
    timeoutMs: options.timeoutMs,
  })
  await ensureService({
    name: 'mock-admin-mall-tenant-console',
    scriptName: 'mock:admin-mall-tenant-console:dev',
    port: 5830,
    healthBaseUrl: options.adminBaseUrl,
    logPath: `${logDir}/mock-admin-mall-tenant-console.dev.log`,
    timeoutMs: options.timeoutMs,
  })
  await ensureService({
    name: 'metro',
    scriptName: 'assembly:android-mixc-retail-rn84:metro',
    port: 8081,
    logPath: `${logDir}/assembly-android-metro.log`,
    timeoutMs: options.timeoutMs,
  })

  await ensureHealth(options.platformBaseUrl, 'mock-terminal-platform')
  await ensureHealth(options.adminBaseUrl, 'mock-admin-mall-tenant-console')

  logStep('preparing kernel-base-test sandbox baseline on mock-terminal-platform')
  await prepareKernelBaseTestPlatform(options.platformBaseUrl)

  logStep('rebuilding admin projection outbox from aligned authority baseline')
  await requestJson(options.adminBaseUrl, '/api/v1/diagnostics/projections/rebuild', {
    method: 'POST',
    headers: {
      'x-sandbox-id': options.sandboxId,
    },
    body: JSON.stringify({}),
  })

  const devices = resolveDeviceTopology(options)
  const primary = primaryEndpoint(devices.primarySerial)
  const secondary = secondaryEndpoint(devices.primarySerial, devices.secondarySerial)

  logStep('restoring adb reverse/forward and topology host bridge')
  setupAndroidPortForwarding(primary.serial)
  await maybeRelaunch([primary, secondary])
  await normalizeTopology(primary, secondary)
  await maybeResetToActivation(primary, secondary)
  await maybeEnsureActivated(primary, secondary)

  const primaryScreen = getCurrentScreen(primary)
  const secondaryScreen = getCurrentScreen(secondary)
  const activationStatus = getState(primary, ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus'])
  const terminalId = getState(primary, ['kernel.base.tcp-control-runtime-v2.identity', 'terminalId']) ?? null

  console.log(JSON.stringify({
    success: true,
    platformBaseUrl: options.platformBaseUrl,
    adminBaseUrl: options.adminBaseUrl,
    primarySerial: primary.serial,
    secondarySerial: secondary.serial,
    activationStatus,
    terminalId,
    primaryScreen: primaryScreen?.screen?.partKey ?? null,
    secondaryScreen: secondaryScreen?.screen?.partKey ?? null,
  }, null, 2))
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
