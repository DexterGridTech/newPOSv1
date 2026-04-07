const path = require('path')
const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeText,
} = require('./shared.cjs')

function getGeneratedFilePath(appId) {
  const map = {
    'assembly-android-mixc-retail-rn84v2': path.join(process.cwd(), '4-assembly/android/mixc-retail-rn84v2/src/generated/releaseInfo.ts'),
    'assembly-electron-mixc-retail-v1': path.join(process.cwd(), '4-assembly/electron/mixc-retail-v1/src/generated/releaseInfo.ts'),
  }
  const filePath = map[appId]
  if (!filePath) {
    throw new Error(`unsupported app id: ${appId}`)
  }
  return filePath
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifest = readJson(getManifestPath(appId))
  const output = `export const releaseInfo = ${JSON.stringify({
    appId: manifest.appId,
    platform: manifest.platform,
    assemblyVersion: manifest.assemblyVersion,
    buildNumber: manifest.buildNumber,
    bundleVersion: manifest.bundleVersion,
    runtimeVersion: manifest.runtimeVersion,
    channel: manifest.channel,
    minSupportedAppVersion: manifest.minSupportedAppVersion,
    git: manifest.git,
    updatedAt: manifest.updatedAt,
  }, null, 2)} as const\n`

  writeText(getGeneratedFilePath(appId), output)
  console.log(`[release] generated release info: ${appId}`)
}

main()
