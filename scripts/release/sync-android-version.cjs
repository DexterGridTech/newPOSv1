const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  readText,
  resolveRepoPath,
  writeText,
} = require('./shared.cjs')

function replaceOne(content, matcher, replacement, label) {
  if (!matcher.test(content)) {
    throw new Error(`failed to find ${label}`)
  }
  matcher.lastIndex = 0
  return content.replace(matcher, replacement)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifest = readJson(getManifestPath(appId))
  if (manifest.platform !== 'android') {
    throw new Error(`app is not android: ${appId}`)
  }

  const buildGradlePath = resolveRepoPath('4-assembly/android/mixc-retail-rn84v2/android/app/build.gradle')
  const current = readText(buildGradlePath)
  let next = current
  next = replaceOne(next, /versionCode\s+\d+/, `versionCode ${manifest.buildNumber}`, 'versionCode')
  next = replaceOne(next, /versionName\s+"[^"]+"/, `versionName "${manifest.assemblyVersion}"`, 'versionName')

  writeText(buildGradlePath, next)
  console.log(`[release] synced android gradle version: ${manifest.assemblyVersion} (${manifest.buildNumber})`)
}

main()
