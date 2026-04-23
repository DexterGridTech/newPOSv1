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

  const manifestPath = getManifestPath(appId)
  const manifest = readJson(manifestPath)
  const packageJsonPath = getPackageJsonPathByAppId(appId)

  updateJsonFile(packageJsonPath, current => ({
    ...current,
    version: manifest.assemblyVersion,
  }))

  console.log(`[release] synced package version from manifest: ${appId} -> ${manifest.assemblyVersion}`)
}

main()
