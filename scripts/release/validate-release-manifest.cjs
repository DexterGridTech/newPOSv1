const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
} = require('./shared.cjs')

const SEMVER_RE = /^\d+\.\d+\.\d+$/
const BUNDLE_RE = /^\d+\.\d+\.\d+\+ota\.\d+$/
const CHANNELS = new Set(['development', 'dev', 'test', 'staging', 'production'])

function compareSemver(left, right) {
  const l = left.split('.').map(Number)
  const r = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (l[index] > r[index]) return 1
    if (l[index] < r[index]) return -1
  }
  return 0
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifest = readJson(getManifestPath(appId))
  const errors = []

  if (manifest.appId !== appId) {
    errors.push(`appId mismatch: expected ${appId}, got ${manifest.appId}`)
  }
  if (!SEMVER_RE.test(String(manifest.assemblyVersion))) {
    errors.push(`invalid assemblyVersion: ${manifest.assemblyVersion}`)
  }
  if (!Number.isInteger(manifest.buildNumber) || manifest.buildNumber <= 0) {
    errors.push(`invalid buildNumber: ${manifest.buildNumber}`)
  }
  if (!BUNDLE_RE.test(String(manifest.bundleVersion))) {
    errors.push(`invalid bundleVersion: ${manifest.bundleVersion}`)
  }
  if (!CHANNELS.has(String(manifest.channel))) {
    errors.push(`invalid channel: ${manifest.channel}`)
  }
  if (!SEMVER_RE.test(String(manifest.minSupportedAppVersion))) {
    errors.push(`invalid minSupportedAppVersion: ${manifest.minSupportedAppVersion}`)
  }
  if (SEMVER_RE.test(String(manifest.assemblyVersion)) && SEMVER_RE.test(String(manifest.minSupportedAppVersion))) {
    if (compareSemver(manifest.minSupportedAppVersion, manifest.assemblyVersion) > 0) {
      errors.push(`minSupportedAppVersion ${manifest.minSupportedAppVersion} cannot be greater than assemblyVersion ${manifest.assemblyVersion}`)
    }
  }

  const expectedBundlePrefix = `${manifest.assemblyVersion}+ota.`
  if (typeof manifest.bundleVersion !== 'string' || !manifest.bundleVersion.startsWith(expectedBundlePrefix)) {
    errors.push(`bundleVersion ${manifest.bundleVersion} must start with ${expectedBundlePrefix}`)
  }

  const expectedRuntimePrefix = `${String(appId).replace(/^assembly-/, '')}@`
  if (typeof manifest.runtimeVersion !== 'string' || !manifest.runtimeVersion.startsWith(expectedRuntimePrefix)) {
    errors.push(`runtimeVersion ${manifest.runtimeVersion} must start with ${expectedRuntimePrefix}`)
  }

  if (!manifest.targetPackages || typeof manifest.targetPackages !== 'object' || Array.isArray(manifest.targetPackages)) {
    errors.push('targetPackages must be an object')
  }

  if (errors.length > 0) {
    console.error('[release] manifest validation failed:')
    errors.forEach(item => console.error(`- ${item}`))
    process.exit(1)
  }

  console.log(`[release] manifest validation passed: ${appId}`)
}

main()
