const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeJson,
} = require('./shared.cjs')

function bumpBundleVersion(currentBundleVersion, assemblyVersion) {
  const prefix = `${assemblyVersion}+ota.`
  if (!currentBundleVersion.startsWith(prefix)) {
    return `${assemblyVersion}+ota.1`
  }

  const seq = Number(currentBundleVersion.slice(prefix.length))
  const nextSeq = Number.isFinite(seq) ? seq + 1 : 1
  return `${assemblyVersion}+ota.${nextSeq}`
}

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
    bundleVersion: bumpBundleVersion(current.bundleVersion, current.assemblyVersion),
    channel: typeof args.channel === 'string' ? args.channel : current.channel,
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] bumped bundle version: ${appId} -> ${next.bundleVersion}`)
}

main()
