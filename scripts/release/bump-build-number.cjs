const {
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
  const nextBuildNumber = args['build-number'] ? Number(args['build-number']) : Number(current.buildNumber) + 1
  if (!Number.isInteger(nextBuildNumber) || nextBuildNumber <= 0) {
    throw new Error(`invalid build number: ${args['build-number']}`)
  }

  const next = {
    ...current,
    buildNumber: nextBuildNumber,
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] bumped build number: ${appId} -> ${nextBuildNumber}`)
}

main()
