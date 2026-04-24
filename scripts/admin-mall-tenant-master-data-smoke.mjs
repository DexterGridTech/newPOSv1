#!/usr/bin/env node

import {
  assertEqual,
  assertTruthy,
  DEFAULT_TIMEOUT_MS,
  ensureHealth,
  fail,
  getCurrentScreen,
  getNode,
  getState,
  isTcpListening,
  logStep,
  parseCommonArgs,
  priceText,
  primaryEndpoint,
  requestJson,
  resolveDeviceTopology,
  secondaryEndpoint,
  waitForNodeText,
  waitForRpc,
  waitForScreenPart,
  waitForState,
} from './admin-mall-tenant-master-data-e2e-support.mjs'

const PRIMARY_WORKBENCH_PART = 'ui.business.catering-master-data-workbench.primary-workbench'
const SECONDARY_WORKBENCH_PART = 'ui.business.catering-master-data-workbench.secondary-workbench'
const TITLE_NODE_ID = 'ui-business-catering-master-data-workbench:title'
const LIVE_PRODUCT_NAME_NODE_ID = 'ui-business-catering-master-data-workbench:live-product-name'
const LIVE_PRODUCT_PRICE_NODE_ID = 'ui-business-catering-master-data-workbench:live-product-price'

const options = parseCommonArgs(process.argv.slice(2), {
  timeoutMs: DEFAULT_TIMEOUT_MS,
})

async function assertServiceHealth() {
  logStep('checking mock-terminal-platform health')
  await ensureHealth(options.platformBaseUrl, 'mock-terminal-platform')

  logStep('checking mock-admin-mall-tenant-console health')
  await ensureHealth(options.adminBaseUrl, 'mock-admin-mall-tenant-console')

  logStep('checking metro port 8081')
  const metroReady = await isTcpListening(8081)
  assertTruthy(metroReady, 'metro port 8081')
}

function readNodeText(endpoint, nodeId) {
  const node = getNode(endpoint, nodeId, {timeoutMs: options.timeoutMs})
  return typeof node?.text === 'string' ? node.text : ''
}

async function assertRuntime(endpoint) {
  logStep(`checking automation socket for ${endpoint.role} (${endpoint.serial})`)
  const info = await waitForRpc(endpoint, 'runtime.getInfo', {}, options.timeoutMs)
  assertTruthy(info, `${endpoint.role} runtime info`)
  return info
}

async function assertWorkbenchScreens(primary, secondary) {
  logStep('checking primary and secondary workbench screen parts')
  await waitForScreenPart(primary, PRIMARY_WORKBENCH_PART, options.timeoutMs)
  await waitForScreenPart(secondary, SECONDARY_WORKBENCH_PART, options.timeoutMs)

  const primaryScreen = getCurrentScreen(primary, {timeoutMs: options.timeoutMs})
  const secondaryScreen = getCurrentScreen(secondary, {timeoutMs: options.timeoutMs})
  assertEqual(primaryScreen?.screen?.partKey, PRIMARY_WORKBENCH_PART, 'primary screen part')
  assertEqual(secondaryScreen?.screen?.partKey, SECONDARY_WORKBENCH_PART, 'secondary screen part')

  logStep('checking workbench titles')
  await waitForNodeText(primary, TITLE_NODE_ID, '餐饮主数据工作台 · PRIMARY', options.timeoutMs)
  await waitForNodeText(secondary, TITLE_NODE_ID, '餐饮主数据工作台 · SECONDARY', options.timeoutMs)
}

async function assertTdpReady(primary) {
  logStep('checking primary TDP session READY')
  return await waitForState(
    primary,
    ['kernel.base.tdp-sync-runtime-v2.session', 'status'],
    value => value === 'READY',
    options.timeoutMs,
    'primary TDP session READY',
  )
}

function extractDemoProductExpectation(demoChange) {
  const data = typeof demoChange?.document?.payload?.data === 'object' && demoChange.document.payload.data !== null
    ? demoChange.document.payload.data
    : {}
  const productName = typeof data.product_name === 'string' ? data.product_name : ''
  const basePrice = data.base_price

  assertEqual(demoChange?.projection?.topicKey, 'catering.product.profile', 'demo projection topic')
  assertEqual(demoChange?.projection?.scopeType, 'BRAND', 'demo projection scope type')
  assertEqual(demoChange?.projection?.itemKey, 'product-salmon-bowl', 'demo projection item key')
  assertTruthy(productName, 'demo product name')
  assertTruthy(basePrice !== null && basePrice !== undefined, 'demo product base_price')

  return {
    productName,
    productPriceText: priceText(basePrice),
    basePrice,
  }
}

async function publishDemoChange() {
  logStep('applying admin demo master-data change')
  const demoChange = await requestJson(options.adminBaseUrl, '/api/v1/master-data/demo-change', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const expected = extractDemoProductExpectation(demoChange)

  logStep('checking pending projection outbox contains the demo change')
  const pending = await requestJson(options.adminBaseUrl, '/api/v1/projection-outbox?status=PENDING')
  const matchedPending = Array.isArray(pending)
    ? pending.find(item => item?.sourceEventId === demoChange.projection.sourceEventId)
    : null
  assertTruthy(matchedPending, 'pending outbox item for demo projection')

  logStep('publishing projection outbox through mock-terminal-platform TDP')
  const publishResult = await requestJson(options.adminBaseUrl, '/api/v1/projection-outbox/publish', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assertTruthy(Number(publishResult?.published ?? 0) >= 1, 'published projection count')
  assertEqual(Number(publishResult?.failed ?? 0), 0, 'failed projection count')

  return {
    demoChange,
    expected,
    publishResult,
  }
}

async function assertLiveUiChange(endpoint, expected) {
  logStep(`waiting ${endpoint.role} UI live product ${expected.productName} ${expected.productPriceText}`)
  const nameNode = await waitForNodeText(
    endpoint,
    LIVE_PRODUCT_NAME_NODE_ID,
    expected.productName,
    options.timeoutMs,
  )
  const priceNode = await waitForNodeText(
    endpoint,
    LIVE_PRODUCT_PRICE_NODE_ID,
    expected.productPriceText,
    options.timeoutMs,
  )
  return {
    nameText: nameNode?.text ?? null,
    priceText: priceNode?.text ?? null,
  }
}

async function main() {
  await assertServiceHealth()

  const devices = resolveDeviceTopology(options)
  const primary = primaryEndpoint(devices.primarySerial)
  const secondary = secondaryEndpoint(devices.primarySerial, devices.secondarySerial)

  const [primaryInfo, secondaryInfo] = await Promise.all([
    assertRuntime(primary),
    assertRuntime(secondary),
  ])

  await assertWorkbenchScreens(primary, secondary)
  const tdpSessionStatus = await assertTdpReady(primary)
  const terminalId = getState(primary, ['kernel.base.tcp-control-runtime-v2.identity', 'terminalId'])

  const {expected, publishResult} = await publishDemoChange()

  const [primaryLive, secondaryLive] = await Promise.all([
    assertLiveUiChange(primary, expected),
    assertLiveUiChange(secondary, expected),
  ])

  console.log(JSON.stringify({
    success: true,
    platformBaseUrl: options.platformBaseUrl,
    adminBaseUrl: options.adminBaseUrl,
    primarySerial: primary.serial,
    secondarySerial: secondary.serial,
    topology: secondary.serial === primary.serial ? 'single-device-dual-screen' : 'dual-device-single-screen',
    terminalId,
    tdpSessionStatus,
    primaryScreen: getCurrentScreen(primary)?.screen?.partKey ?? null,
    secondaryScreen: getCurrentScreen(secondary)?.screen?.partKey ?? null,
    primaryTitle: readNodeText(primary, TITLE_NODE_ID),
    secondaryTitle: readNodeText(secondary, TITLE_NODE_ID),
    expectedProductName: expected.productName,
    expectedProductPrice: expected.productPriceText,
    primaryLive,
    secondaryLive,
    publishResult,
    primaryRuntime: {
      target: primaryInfo?.target ?? null,
      displayContext: primaryInfo?.displayContext ?? null,
      currentScreen: primaryInfo?.currentScreen ?? null,
    },
    secondaryRuntime: {
      target: secondaryInfo?.target ?? null,
      displayContext: secondaryInfo?.displayContext ?? null,
      currentScreen: secondaryInfo?.currentScreen ?? null,
    },
  }, null, 2))
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
