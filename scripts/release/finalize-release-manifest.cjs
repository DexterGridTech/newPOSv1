const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeJson,
} = require('./shared.cjs')

function sha256(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function fileInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  const stat = fs.statSync(filePath)
  return {
    path: path.relative(process.cwd(), filePath),
    size: stat.size,
    sha256: sha256(filePath),
    modifiedAt: stat.mtime.toISOString(),
  }
}

function collectArtifacts(appId) {
  if (appId === 'assembly-android-mixc-catering-rn84') {
    return {
      apk: fileInfo(path.join(process.cwd(), '4-assembly/android/mixc-catering-assembly-rn84/android/app/build/outputs/apk/release/app-release.apk')),
      bundle: fileInfo(path.join(process.cwd(), '4-assembly/android/mixc-catering-assembly-rn84/android/app/build/generated/assets/react/release/index.android.bundle')),
      sourceMap: fileInfo(path.join(process.cwd(), '4-assembly/android/mixc-catering-assembly-rn84/android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map')),
    }
  }

  throw new Error(`unsupported app id: ${appId}`)
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
    artifacts: collectArtifacts(appId),
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] finalized manifest artifacts: ${appId}`)
}

main()
