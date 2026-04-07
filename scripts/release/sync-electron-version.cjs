const {
  getManifestPath,
  getPackageJsonPathByAppId,
  parseArgs,
  printUsageAndExit,
  readJson,
  updateJsonFile,
} = require('./shared.cjs')

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifest = readJson(getManifestPath(appId))
  if (manifest.platform !== 'electron') {
    throw new Error(`app is not electron: ${appId}`)
  }

  const packageJsonPath = getPackageJsonPathByAppId(appId)
  updateJsonFile(packageJsonPath, current => ({
    ...current,
    version: manifest.assemblyVersion,
  }))

  console.log(`[release] synced electron package version: ${manifest.assemblyVersion}`)
}

main()
