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

  it('keeps primary and secondary drift entries separately for the same terminal', async () => {
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
        deviceFingerprint: 'device-version-report-002',
        deviceInfo: { id: 'device-version-report-002', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string } }
    const terminalId = activationPayload.data.terminalId

    await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/${terminalId}/version-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        displayIndex: 0,
        displayRole: 'primary',
        appId: 'assembly-android-mixc-retail-rn84',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        bundleVersion: '1.0.0+ota.9',
        source: 'hot-update',
        packageId: 'pkg-primary',
        releaseId: 'release-primary',
        state: 'RUNNING',
      }),
    })

    await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/${terminalId}/version-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        displayIndex: 0,
        displayRole: 'secondary',
        appId: 'assembly-android-mixc-retail-rn84',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        bundleVersion: '1.0.0+ota.9',
        source: 'hot-update',
        packageId: 'pkg-secondary',
        releaseId: 'release-secondary',
        state: 'RUNNING',
      }),
    })

    const driftResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/version-drift?sandboxId=${sandboxId}`)
    const driftPayload = await driftResponse.json() as {
      data: Array<{ terminalId: string; displayRole: string; packageId: string | null }>
    }

    expect(driftPayload.data.filter(item => item.terminalId === terminalId)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        terminalId,
        displayRole: 'primary',
        packageId: 'pkg-primary',
      }),
      expect.objectContaining({
        terminalId,
        displayRole: 'secondary',
        packageId: 'pkg-secondary',
      }),
    ]))
  })

  it('prefers the latest primary-role report over stale single-role history for the same display bucket', async () => {
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
        deviceFingerprint: 'device-version-report-003',
        deviceInfo: { id: 'device-version-report-003', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string } }
    const terminalId = activationPayload.data.terminalId

    await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/${terminalId}/version-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        displayIndex: 0,
        displayRole: 'single',
        appId: 'assembly-android-mixc-retail-rn84',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        bundleVersion: '1.0.0+ota.7',
        source: 'hot-update',
        packageId: 'pkg-single',
        releaseId: 'release-single',
        state: 'RUNNING',
      }),
    })

    await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/${terminalId}/version-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        displayIndex: 0,
        displayRole: 'primary',
        appId: 'assembly-android-mixc-retail-rn84',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        runtimeVersion: 'android-mixc-retail-rn84@1.0',
        bundleVersion: '1.0.0+ota.8',
        source: 'hot-update',
        packageId: 'pkg-primary-current',
        releaseId: 'release-primary-current',
        state: 'RUNNING',
      }),
    })

    const driftResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/version-drift?sandboxId=${sandboxId}`)
    const driftPayload = await driftResponse.json() as {
      data: Array<{ terminalId: string; displayRole: string; bundleVersion: string; packageId: string | null }>
    }

    expect(driftPayload.data.filter(item => item.terminalId === terminalId)).toEqual([
      expect.objectContaining({
        terminalId,
        displayRole: 'primary',
        bundleVersion: '1.0.0+ota.8',
        packageId: 'pkg-primary-current',
      }),
    ])
  })
})
