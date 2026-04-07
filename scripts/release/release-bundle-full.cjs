const {execSync} = require('child_process')
const {parseArgs, printUsageAndExit} = require('./shared.cjs')

function run(command) {
  console.log(`[release] run: ${command}`)
  execSync(command, {stdio: 'inherit'})
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

  if (appId === 'assembly-android-mixc-retail-rn84v2') {
    run('corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84v2 type-check')
    run("bash -lc 'source ~/.zshrc && cd 4-assembly/android/mixc-retail-rn84v2/android && rm -rf app/build/generated/assets/react/release app/build/generated/sourcemaps/react/release app/build/intermediates/assets/release && ./gradlew createBundleReleaseJsAndAssets --rerun-tasks'")
    run(`node scripts/release/finalize-release-manifest.cjs --app ${appId}`)
    return
  }

  if (appId === 'assembly-electron-mixc-retail-v1') {
    run('corepack yarn workspace @impos2/assembly-electron-mixc-retail-v1 type-check')
    console.log('[release] electron OTA build pipeline not implemented yet; manifest and version state are prepared.')
    return
  }

  throw new Error(`unsupported app id for bundle release: ${appId}`)
}

main()
