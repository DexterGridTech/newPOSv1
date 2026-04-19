import { afterEach, describe, expect, it } from 'vitest'
import { createMockTerminalPlatformTestServer } from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('mock-terminal-platform hot update version reports', () => {
  it('records version history and updates runtime facts for drift views', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000001',
        deviceFingerprint: 'device-version-report-001',
        deviceInfo: { id: 'device-version-report-001', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string } }
    const terminalId = activationPayload.data.terminalId

    const reportResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/${terminalId}/version-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        appId: 'assembly-android-mixc-retail-rn84',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        bundleVersion: '1.0.0+ota.9',
        source: 'hot-update',
        packageId: 'pkg-test',
        releaseId: 'release-test',
        state: 'RUNNING',
      }),
    })

    expect(reportResponse.status).toBe(201)

    const historyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/terminals/${terminalId}/version-history?sandboxId=${sandboxId}`)
    const historyPayload = await historyResponse.json() as { data: Array<{ bundleVersion: string; source: string }> }
    expect(historyPayload.data[0]).toMatchObject({
      bundleVersion: '1.0.0+ota.9',
      source: 'hot-update',
    })

    const driftResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/version-drift?sandboxId=${sandboxId}`)
    const driftPayload = await driftResponse.json() as { data: Array<{ terminalId: string; bundleVersion: string; source: string }> }
    expect(driftPayload.data.some(item => item.terminalId === terminalId && item.bundleVersion === '1.0.0+ota.9' && item.source === 'hot-update')).toBe(true)
  })
})
