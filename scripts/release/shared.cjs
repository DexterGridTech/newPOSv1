const fs = require('fs')
const path = require('path')

function getRepoRoot() {
  return process.cwd()
}

function resolveRepoPath(...segments) {
  return path.join(getRepoRoot(), ...segments)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8')
}

function updateJsonFile(filePath, updater) {
  const current = readJson(filePath)
  const next = updater(current)
  writeJson(filePath, next)
  return next
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function getManifestPath(appId) {
  const manifestMap = {
    'assembly-android-mixc-retail-rn84v2': resolveRepoPath('4-assembly/android/mixc-retail-rn84v2/release.manifest.json'),
    'assembly-android-mixc-retail-rn84': resolveRepoPath('4-assembly/android/mixc-retail-assembly-rn84/release.manifest.json'),
    'assembly-electron-mixc-retail-v1': resolveRepoPath('4-assembly/electron/mixc-retail-v1/release.manifest.json'),
  }

  const manifestPath = manifestMap[appId]
  if (!manifestPath) {
    throw new Error(`unsupported app id: ${appId}`)
  }
  assertFileExists(manifestPath, 'release manifest')
  return manifestPath
}

function getPackageJsonPathByAppId(appId) {
  const map = {
    'assembly-android-mixc-retail-rn84v2': resolveRepoPath('4-assembly/android/mixc-retail-rn84v2/package.json'),
    'assembly-android-mixc-retail-rn84': resolveRepoPath('4-assembly/android/mixc-retail-assembly-rn84/package.json'),
    'assembly-electron-mixc-retail-v1': resolveRepoPath('4-assembly/electron/mixc-retail-v1/package.json'),
  }
  const packageJsonPath = map[appId]
  if (!packageJsonPath) {
    throw new Error(`unsupported app id: ${appId}`)
  }
  assertFileExists(packageJsonPath, 'package.json')
  return packageJsonPath
}

function getTrackedPackagePathsByAppId(appId) {
  const shared = [
    '1-kernel/1.1-cores/base/package.json',
    '1-kernel/1.1-cores/communication/package.json',
    '1-kernel/1.1-cores/interconnection/package.json',
    '1-kernel/1.1-cores/navigation/package.json',
    '1-kernel/1.1-cores/task/package.json',
    '1-kernel/1.1-cores/terminal/package.json',
    '1-kernel/1.2-modules/mixc-user-login/package.json',
    '2-ui/2.3-integrations/mixc-retail/package.json',
  ]

  const perApp = {
    'assembly-android-mixc-retail-rn84v2': [...shared, '3-adapter/android/adapterPure/package.json'],
    'assembly-android-mixc-retail-rn84': [
      '1-kernel/1.1-base/contracts/package.json',
      '1-kernel/1.1-base/platform-ports/package.json',
      '1-kernel/1.1-base/runtime-shell-v2/package.json',
      '1-kernel/1.1-base/tcp-control-runtime-v2/package.json',
      '1-kernel/1.1-base/topology-runtime-v3/package.json',
      '1-kernel/1.1-base/transport-runtime/package.json',
      '1-kernel/1.1-base/ui-runtime-v2/package.json',
      '1-kernel/server-config-v2/package.json',
      '2-ui/2.1-base/admin-console/package.json',
      '2-ui/2.1-base/input-runtime/package.json',
      '2-ui/2.1-base/runtime-react/package.json',
      '2-ui/2.1-base/terminal-console/package.json',
      '2-ui/2.3-integration/retail-shell/package.json',
      '3-adapter/android/adapter-android-v2/package.json',
    ],
    'assembly-electron-mixc-retail-v1': [...shared, '3-adapter/electron/adapterV1/package.json'],
  }

  const result = perApp[appId]
  if (!result) {
    throw new Error(`unsupported app id: ${appId}`)
  }
  return result
}

function collectWorkspacePackageVersions(appId) {
  const workspacePackagePaths = getTrackedPackagePathsByAppId(appId)
  const versions = {}
  for (const relativePath of workspacePackagePaths) {
    const absolutePath = resolveRepoPath(relativePath)
    if (!fs.existsSync(absolutePath)) {
      continue
    }
    const pkg = readJson(absolutePath)
    versions[pkg.name] = pkg.version
  }
  return versions
}

function printUsageAndExit() {
  console.log('Usage: node <script> --app <appId> [--version <semver>] [--build-number <number>] [--channel <name>]')
  process.exit(1)
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    index += 1
  }
  return args
}

module.exports = {
  assertFileExists,
  collectWorkspacePackageVersions,
  getManifestPath,
  getTrackedPackagePathsByAppId,
  getPackageJsonPathByAppId,
  parseArgs,
  printUsageAndExit,
  readJson,
  readText,
  resolveRepoPath,
  updateJsonFile,
  writeJson,
  writeText,
}
