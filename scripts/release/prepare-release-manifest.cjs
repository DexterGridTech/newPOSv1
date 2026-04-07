const {
  collectWorkspacePackageVersions,
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeJson,
} = require('./shared.cjs')

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifestPath = getManifestPath(appId)
  const current = readJson(manifestPath)
  const next = {
    ...current,
    channel: typeof args.channel === 'string' ? args.channel : current.channel,
    targetPackages: collectWorkspacePackageVersions(appId),
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] prepared manifest: ${manifestPath}`)
}

main()
