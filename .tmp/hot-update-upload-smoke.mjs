import fs from 'node:fs'
import { createMockTerminalPlatformTestServer } from '../0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer.ts'

const server = createMockTerminalPlatformTestServer()
try {
  await server.start()
  const prepare = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
  const { data: { sandboxId } } = await prepare.json()
  const files = [
    'dist/hot-updates/hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.1.zip',
    'dist/hot-updates/hot-update-assembly-electron-mixc-retail-v1-1.1.0+ota.3.zip',
  ]
  const results = []
  for (const file of files) {
    const contentBase64 = fs.readFileSync(file).toString('base64')
    const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/hot-updates/packages/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId, fileName: file.split('/').pop(), contentBase64 }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) {
      throw new Error(`${file}: ${JSON.stringify(payload)}`)
    }
    results.push({
      file,
      packageId: payload.data.packageId,
      appId: payload.data.appId,
      bundleVersion: payload.data.bundleVersion,
      fileCount: payload.data.manifest.package.files?.length ?? 1,
      packageType: payload.data.manifest.package.type,
    })
  }
  console.log(JSON.stringify({ sandboxId, results }, null, 2))
} finally {
  await server.close()
}
