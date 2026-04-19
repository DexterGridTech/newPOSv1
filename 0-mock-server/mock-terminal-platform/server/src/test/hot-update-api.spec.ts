import { afterEach, describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createMockTerminalPlatformTestServer } from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

const dosTime = 0
const dosDate = 0

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

const crc32 = (buffer: Buffer) => {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

const writeUInt16 = (value: number) => {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

const writeUInt32 = (value: number) => {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

const createZip = (entries: Array<{ name: string; content: Buffer | string }>) => {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content)
    const compressed = deflateRawSync(content)
    const crc = crc32(content)
    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(8),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(crc),
      writeUInt32(compressed.length),
      writeUInt32(content.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ])
    localParts.push(localHeader, compressed)
    centralParts.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(8),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(crc),
      writeUInt32(compressed.length),
      writeUInt32(content.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name,
    ]))
    offset += localHeader.length + compressed.length
  }

  const local = Buffer.concat(localParts)
  const central = Buffer.concat(centralParts)
  return Buffer.concat([
    local,
    central,
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(central.length),
    writeUInt32(local.length),
    writeUInt16(0),
  ])
}

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')

const createHotUpdateZip = () => {
  const payload = Buffer.from('console.log("hot update bundle");\n')
  const manifest = {
    manifestVersion: 1,
    appId: 'assembly-android-mixc-retail-rn84',
    platform: 'android',
    product: 'mixc-retail',
    channel: 'development',
    bundleVersion: '1.0.0+ota.9',
    runtimeVersion: 'android-mixc-retail-rn84@1.0',
    assemblyVersion: '1.0.0',
    buildNumber: 1000001,
    builtAt: '2026-04-18T00:00:00.000Z',
    git: {
      commit: 'test-commit',
      branch: 'test',
      dirty: false,
    },
    compatibility: {
      appId: 'assembly-android-mixc-retail-rn84',
      platform: 'android',
      product: 'mixc-retail',
      runtimeVersion: 'android-mixc-retail-rn84@1.0',
      channel: 'development',
    },
    package: {
      type: 'full-js-bundle',
      entry: 'payload/index.android.bundle',
      compression: 'zip',
      size: payload.length,
      sha256: sha256(payload),
    },
    install: {
      strategy: 'replace-bundle',
      requiresRuntimeRestart: true,
      maxRetainedPackages: 2,
    },
    restart: {
      mode: 'manual',
      operatorInstruction: 'test restart',
    },
    rollout: {
      defaultStrategy: 'manual-policy',
      notes: 'test rollout',
    },
    security: {
      hashAlgorithm: 'sha256',
    },
    releaseNotes: ['test release'],
  }

  return createZip([
    { name: 'manifest/hot-update-manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'payload/index.android.bundle', content: payload },
  ])
}

const createElectronHotUpdateZip = () => {
  const entry = Buffer.from('console.log("primary renderer");\n')
  const main = Buffer.from('console.log("main");\n')
  const secondary = Buffer.from('console.log("secondary renderer");\n')
  const manifest = {
    manifestVersion: 1,
    appId: 'assembly-electron-mixc-retail-v1',
    platform: 'electron',
    product: 'mixc-retail',
    channel: 'test',
    bundleVersion: '1.1.0+ota.2',
    runtimeVersion: 'electron-mixc-retail-v1@1.1',
    assemblyVersion: '1.1.0',
    buildNumber: 1000002,
    builtAt: '2026-04-19T00:00:00.000Z',
    git: {
      commit: 'test-commit-electron',
      branch: 'test',
      dirty: false,
    },
    compatibility: {
      appId: 'assembly-electron-mixc-retail-v1',
      platform: 'electron',
      product: 'mixc-retail',
      runtimeVersion: 'electron-mixc-retail-v1@1.1',
      minAssemblyVersion: '1.1.0',
      maxAssemblyVersion: '1.1.0',
      minBuildNumber: 1000002,
      maxBuildNumber: 1000002,
      allowedChannels: ['test'],
    },
    package: {
      type: 'electron-webpack-bundle',
      entry: 'payload/renderer/primary_window/index.js',
      compression: 'zip',
      size: entry.length,
      sha256: sha256(entry),
      files: [
        {
          path: 'payload/renderer/primary_window/index.js',
          size: entry.length,
          sha256: sha256(entry),
        },
        {
          path: 'payload/main/index.js',
          size: main.length,
          sha256: sha256(main),
        },
        {
          path: 'payload/renderer/secondary_window/index.js',
          size: secondary.length,
          sha256: sha256(secondary),
        },
      ],
    },
    install: {
      strategy: 'replace-bundle',
      requiresRuntimeRestart: true,
      maxRetainedPackages: 2,
    },
    restart: {
      mode: 'manual',
      operatorInstruction: 'test restart',
    },
    rollout: {
      defaultStrategy: 'manual-policy',
    },
    security: {
      hashAlgorithm: 'sha256',
    },
    releaseNotes: ['test electron release'],
  }

  return createZip([
    { name: 'manifest/hot-update-manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'payload/renderer/primary_window/index.js', content: entry },
    { name: 'payload/main/index.js', content: main },
    { name: 'payload/renderer/secondary_window/index.js', content: secondary },
  ])
}

const json = async <T>(response: Response): Promise<T> => response.json() as Promise<T>

describe('mock-terminal-platform hot update api', () => {
  it('uploads a hot update zip, exposes download url, and publishes desired through group policy', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await json<{ data: { sandboxId: string } }>(prepareResponse)
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000001',
        deviceFingerprint: 'device-hot-update-api-001',
        deviceInfo: {
          id: 'device-hot-update-api-001',
          model: 'Mixc Retail Android RN84',
          platform: 'android',
          runtimeInfo: {
            assemblyAppId: 'assembly-android-mixc-retail-rn84',
            runtimeVersion: 'android-mixc-retail-rn84@1.0',
            bundleVersion: '1.0.0+ota.0',
            assemblyVersion: '1.0.0',
          },
        },
      }),
    })
    const activationPayload = await json<{
      data: {
        terminalId: string
        binding: {
          projectId: string
        }
      }
    }>(activationResponse)
    const terminalId = activationPayload.data.terminalId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'hot-update-project',
        name: 'Hot Update Project',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            projectId: [activationPayload.data.binding.projectId],
          },
        },
      }),
    })
    const groupPayload = await json<{ data: { groupId: string } }>(groupResponse)
    expect(groupResponse.status).toBe(201)

    const recomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId, scopeType: 'TERMINAL', scopeKeys: [terminalId] }),
    })
    expect(recomputeResponse.status).toBe(200)

    const zip = createHotUpdateZip()
    const uploadResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/packages/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        fileName: 'hot-update-test.zip',
        contentBase64: zip.toString('base64'),
      }),
    })
    const uploadPayload = await json<{
      data: {
        packageId: string
        sha256: string
        manifestSha256: string
        manifest: {
          appId: string
          bundleVersion: string
          packageId: string
          package: {
            entry: string
          }
        }
      }
    }>(uploadResponse)

    expect(uploadResponse.status).toBe(201)
    expect(uploadPayload.data.sha256).toBe(sha256(zip))
    expect(uploadPayload.data.manifest).toMatchObject({
      appId: 'assembly-android-mixc-retail-rn84',
      bundleVersion: '1.0.0+ota.9',
      packageId: uploadPayload.data.packageId,
    })
    expect(uploadPayload.data.manifest.package.entry).toBe('payload/index.android.bundle')

    const releaseResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/releases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        packageId: uploadPayload.data.packageId,
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        createdBy: 'vitest',
        restart: {
          mode: 'manual',
          operatorInstruction: 'test restart',
        },
      }),
    })
    const releasePayload = await json<{ data: { releaseId: string; desiredPayload: { packageUrl: string } } }>(releaseResponse)
    expect(releaseResponse.status).toBe(201)
    expect(releasePayload.data.desiredPayload.packageUrl).toContain(`/api/v1/hot-updates/packages/${uploadPayload.data.packageId}/download`)

    const releaseListResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/releases?sandboxId=${sandboxId}`)
    const releaseListPayload = await json<{
      data: Array<{
        releaseId: string
        packageSummary?: {
          packageId: string
          bundleVersion: string
        } | null
      }>
    }>(releaseListResponse)
    expect(releaseListPayload.data.find(item => item.releaseId === releasePayload.data.releaseId)?.packageSummary).toMatchObject({
      packageId: uploadPayload.data.packageId,
      bundleVersion: '1.0.0+ota.9',
    })

    const activateResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/releases/${releasePayload.data.releaseId}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId }),
    })
    const activatePayload = await json<{ data: { status: string; policyId: string; materializedTerminalCount: number } }>(activateResponse)
    expect(activateResponse.status).toBe(200)
    expect(activatePayload.data.status).toBe('ACTIVE')
    expect(activatePayload.data.policyId).toContain('policy_')
    expect(activatePayload.data.materializedTerminalCount).toBe(1)

    const snapshotResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`)
    const snapshotPayload = await json<{
      data: Array<{
        topic: string
        itemKey: string
        payload: {
          releaseId?: string
          packageId?: string
          manifestSha256?: string
          rollout?: { mode: string }
        }
      }>
    }>(snapshotResponse)
    const desired = snapshotPayload.data.find(item => item.topic === 'terminal.hot-update.desired' && item.itemKey === 'main')
    expect(desired?.payload).toMatchObject({
      releaseId: releasePayload.data.releaseId,
      packageId: uploadPayload.data.packageId,
      manifestSha256: uploadPayload.data.manifestSha256,
      rollout: { mode: 'active' },
    })

    const packageResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/packages/${uploadPayload.data.packageId}?sandboxId=${sandboxId}`)
    const packagePayload = await json<{ data: { downloadUrl: string } }>(packageResponse)
    const downloadResponse = await fetch(`${server.getHttpBaseUrl()}${packagePayload.data.downloadUrl}`)
    const downloaded = Buffer.from(await downloadResponse.arrayBuffer())
    expect(downloadResponse.status).toBe(200)
    expect(sha256(downloaded)).toBe(sha256(zip))
  })

  it('accepts multi-file package.files manifests and validates every declared payload file', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await json<{ data: { sandboxId: string } }>(prepareResponse)
    const sandboxId = preparePayload.data.sandboxId

    const zip = createElectronHotUpdateZip()
    const uploadResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/packages/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        fileName: 'hot-update-electron-test.zip',
        contentBase64: zip.toString('base64'),
      }),
    })
    const uploadPayload = await json<{
      data: {
        packageId: string
        manifest: {
          appId: string
          package: {
            type: string
            files?: Array<{ path: string }>
          }
        }
      }
    }>(uploadResponse)

    expect(uploadResponse.status).toBe(201)
    expect(uploadPayload.data.manifest.appId).toBe('assembly-electron-mixc-retail-v1')
    expect(uploadPayload.data.manifest.package.type).toBe('electron-webpack-bundle')
    expect(uploadPayload.data.manifest.package.files?.map(item => item.path)).toEqual([
      'payload/renderer/primary_window/index.js',
      'payload/main/index.js',
      'payload/renderer/secondary_window/index.js',
    ])
  })
})
