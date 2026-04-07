const path = require('path')
const {
  getManifestPath,
  parseArgs,
  printUsageAndExit,
  readJson,
  writeText,
} = require('./shared.cjs')

function getOutputPath(appId) {
  return path.join(process.cwd(), 'ai-result', `${new Date().toISOString().slice(0, 10)}-${appId}-release-note.md`)
}

function toMarkdown(manifest) {
  const pkgLines = Object.entries(manifest.targetPackages || {})
    .map(([name, version]) => `- ${name}: ${version}`)
    .join('\n')

  const artifactEntries = Object.entries(manifest.artifacts || {})
    .map(([name, info]) => {
      if (!info) {
        return `- ${name}: missing`
      }
      return `- ${name}: ${info.path}, size=${info.size}, sha256=${info.sha256 ?? 'n/a'}`
    })
    .join('\n')

  return `# Release Note\n\n- appId: ${manifest.appId}\n- platform: ${manifest.platform}\n- assemblyVersion: ${manifest.assemblyVersion}\n- buildNumber: ${manifest.buildNumber}\n- bundleVersion: ${manifest.bundleVersion}\n- runtimeVersion: ${manifest.runtimeVersion}\n- channel: ${manifest.channel}\n- minSupportedAppVersion: ${manifest.minSupportedAppVersion}\n- git.commit: ${manifest.git?.commit ?? 'unknown'}\n- git.branch: ${manifest.git?.branch ?? 'unknown'}\n- updatedAt: ${manifest.updatedAt}\n\n## Target Packages\n${pkgLines || '- none'}\n\n## Artifacts\n${artifactEntries || '- none'}\n`
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const appId = args.app
  if (!appId) {
    printUsageAndExit()
  }

  const manifest = readJson(getManifestPath(appId))
  const outputPath = getOutputPath(appId)
  writeText(outputPath, toMarkdown(manifest))
  console.log(`[release] generated release note: ${outputPath}`)
}

main()
