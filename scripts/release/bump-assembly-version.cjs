const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeJson,
} = require('./shared.cjs')

function normalizeRuntimeVersion(appId, assemblyVersion) {
  const identity = appId.replace(/^assembly-/, '')
  const [major, minor = '0'] = String(assemblyVersion).split('.')
  return `${identity}@${major}.${minor}`
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  const version = args.version

  if (!appId || !version) {
    printUsageAndExit()
  }

  const manifestPath = getManifestPath(appId)
  const current = readJson(manifestPath)
  const next = {
    ...current,
    assemblyVersion: version,
    minSupportedAppVersion: version,
    bundleVersion: `${version}+ota.0`,
    runtimeVersion: normalizeRuntimeVersion(appId, version),
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] bumped assembly version: ${appId} -> ${version}`)
}

main()
