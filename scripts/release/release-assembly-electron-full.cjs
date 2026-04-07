const {execSync} = require('child_process')
const {parseArgs, printUsageAndExit} = require('./shared.cjs')

function run(command) {
  console.log(`[release] run: ${command}`)
  execSync(command, {stdio: 'inherit'})
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  const version = args.version
  const channel = typeof args.channel === 'string' ? args.channel : 'production'

  if (!appId || !version) {
    printUsageAndExit()
  }

  run(`node scripts/release/bump-assembly-version.cjs --app ${appId} --version ${version}`)
  run(`node scripts/release/bump-build-number.cjs --app ${appId}`)
  run(`node scripts/release/prepare-release-manifest.cjs --app ${appId} --channel ${channel}`)
  run(`node scripts/release/inject-git-metadata.cjs --app ${appId}`)
  run(`node scripts/release/validate-release-manifest.cjs --app ${appId}`)
  run(`node scripts/release/sync-assembly-version.cjs --app ${appId}`)
  run(`node scripts/release/sync-electron-version.cjs --app ${appId}`)
  run(`node scripts/release/generate-assembly-release-info.cjs --app ${appId}`)
  run('corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check')
  run('corepack yarn assembly:electron-mixc-retail-v1:package')
  run(`node scripts/release/finalize-release-manifest.cjs --app ${appId}`)
}

main()
