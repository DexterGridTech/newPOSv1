const {execSync} = require('child_process')
const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeJson,
} = require('./shared.cjs')

function readGit(command, fallback) {
  try {
    return execSync(command, {stdio: ['ignore', 'pipe', 'ignore']}).toString('utf8').trim() || fallback
  } catch (_error) {
    return fallback
  }
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
    git: {
      commit: readGit('git rev-parse HEAD', 'HEAD'),
      branch: readGit('git branch --show-current', 'local'),
    },
    updatedAt: new Date().toISOString(),
  }

  writeJson(manifestPath, next)
  console.log(`[release] injected git metadata: ${appId}`)
}

main()
