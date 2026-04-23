const {execSync} = require('child_process')
const {parseArgs, printUsageAndExit} = require('./shared.cjs')

function run(command) {
  console.log(`[release] run: ${command}`)
  execSync(command, {stdio: 'inherit'})
}

function getLocalReleaseCommand(appId) {
  if (appId === 'assembly-android-mixc-retail-rn84') {
    return "bash -lc 'cd 4-assembly/android/mixc-retail-assembly-rn84 && ../../../node_modules/.bin/tsc --noEmit && cd android && rm -rf app/build/generated/assets/react/release app/build/generated/sourcemaps/react/release app/build/intermediates/assets/release && ./gradlew createBundleReleaseJsAndAssets --rerun-tasks'"
  }

  throw new Error(`unsupported app id for bundle release: ${appId}`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  const channel = typeof args.channel === 'string' ? args.channel : 'production'

  if (!appId) {
    printUsageAndExit()
  }

  run(`node scripts/release/bump-bundle-version.cjs --app ${appId} --channel ${channel}`)
  run(`node scripts/release/prepare-release-manifest.cjs --app ${appId} --channel ${channel}`)
  run(`node scripts/release/inject-git-metadata.cjs --app ${appId}`)
  run(`node scripts/release/validate-release-manifest.cjs --app ${appId}`)
  run(`node scripts/release/generate-assembly-release-info.cjs --app ${appId}`)
  run(getLocalReleaseCommand(appId))
  run(`node scripts/release/finalize-release-manifest.cjs --app ${appId}`)
}

main()
