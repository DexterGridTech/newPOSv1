const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')
const {execSync} = require('child_process')
const {
  getManifestPath,
  getTrackedPackagePathsByAppId,
  parseArgs,
  printUsageAndExit,
  readJson,
  resolveRepoPath,
} = require('./shared.cjs')

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function prompt(question) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout})
  return new Promise(resolve => rl.question(question, answer => {
    rl.close()
    resolve(answer.trim())
  }))
}

function promptYesNo(question, defaultValue = false) {
  const suffix = defaultValue ? ' [Y/n]: ' : ' [y/N]: '
  return prompt(`${question}${suffix}`).then(answer => {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) {
      return defaultValue
    }
    return normalized === 'y' || normalized === 'yes'
  })
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`invalid ${field}`)
  }
  return value.trim()
}

function normalizeRestartMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (['immediate', 'idle', 'manual', 'next-launch'].includes(normalized)) {
    return normalized
  }
  throw new Error(`invalid restartMode: ${String(value)}`)
}

function createZip(entries) {
  const zlib = require('zlib')
  const localParts = []
  const centralParts = []
  let offset = 0
  const crcTable = (() => {
    const table = new Uint32Array(256)
    for (let index = 0; index < 256; index += 1) {
      let value = index
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      }
      table[index] = value >>> 0
    }
    return table
  })()
  const crc32 = (buffer) => {
    let value = 0xffffffff
    for (const byte of buffer) {
      value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
    }
    return (value ^ 0xffffffff) >>> 0
  }
  const u16 = (value) => {
    const buffer = Buffer.alloc(2)
    buffer.writeUInt16LE(value, 0)
    return buffer
  }
  const u32 = (value) => {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32LE(value >>> 0, 0)
    return buffer
  }

  entries.forEach(entry => {
    const name = Buffer.from(entry.name)
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content)
    const compressed = zlib.deflateRawSync(content)
    const crc = crc32(content)
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
    ])
    localParts.push(localHeader, compressed)
    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]))
    offset += localHeader.length + compressed.length
  })

  const local = Buffer.concat(localParts)
  const central = Buffer.concat(centralParts)
  return Buffer.concat([
    local,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(local.length),
    u16(0),
  ])
}

function ensureFileExistsIn(candidates, label) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error(`${label} not found. checked: ${candidates.join(', ')}`)
}

function run(command) {
  console.log(`[hot-update] run: ${command}`)
  execSync(command, {stdio: 'inherit'})
}

function parseBooleanArg(value) {
  if (typeof value !== 'string') {
    return null
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return null
}

function getLocalBuildCommand(appId) {
  if (appId === 'assembly-android-mixc-catering-rn84') {
    return [
      'bash -lc',
      JSON.stringify([
        'cd 4-assembly/android/mixc-catering-assembly-rn84',
        '../../../node_modules/.bin/tsc --noEmit',
        'cd android',
        'rm -rf app/build/generated/assets/react/release app/build/generated/sourcemaps/react/release app/build/intermediates/assets/release',
        './gradlew createBundleReleaseJsAndAssets --rerun-tasks',
      ].join(' && ')),
    ].join(' ')
  }

  return ''
}

function resolveBundleFiles(appId) {
  if (appId === 'assembly-android-mixc-catering-rn84') {
    const entry = ensureFileExistsIn([
      resolveRepoPath('4-assembly/android/mixc-catering-assembly-rn84/android/app/build/generated/assets/react/release/index.android.bundle'),
      resolveRepoPath('4-assembly/android/mixc-catering-assembly-rn84/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle'),
    ], 'android bundle entry')
    const sourceMapCandidates = [
      resolveRepoPath('4-assembly/android/mixc-catering-assembly-rn84/android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map'),
      resolveRepoPath('4-assembly/android/mixc-catering-assembly-rn84/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map'),
    ]
    return {
      payloadType: 'full-js-bundle',
      entry,
      entryName: 'payload/index.android.bundle',
      sourceMap: sourceMapCandidates.find(candidate => fs.existsSync(candidate)) ?? null,
      sourceMapName: 'payload/source-map/index.android.bundle.map',
      extraEntries: [],
      buildCommand: getLocalBuildCommand(appId),
    }
  }

  throw new Error(`unsupported hot update packaging app: ${appId}`)
}

function walkSourceFiles(directory, files) {
  if (!fs.existsSync(directory)) {
    return
  }
  const entries = fs.readdirSync(directory, {withFileTypes: true})
  entries.forEach(entry => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files)
      return
    }
    if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
      files.push(fullPath)
    }
  })
}

function collectBundleSourceFiles(appId) {
  const roots = new Set([
    resolveRepoPath('4-assembly/android/mixc-catering-assembly-rn84'),
    ...getTrackedPackagePathsByAppId(appId).map(relativePath =>
      path.dirname(resolveRepoPath(relativePath))),
  ])

  const files = []
  roots.forEach(root => {
    walkSourceFiles(path.join(root, 'src'), files)
    ;[
      'App.tsx',
      'App.js',
      'index.ts',
      'index.tsx',
      'index.js',
      'metro.config.js',
      'babel.config.js',
      'package.json',
    ].forEach(relativePath => {
      const filePath = path.join(root, relativePath)
      if (fs.existsSync(filePath)) {
        files.push(filePath)
      }
    })
  })

  return files
}

function getStaleBuildReason(appId, bundleFiles) {
  if (!bundleFiles || !fs.existsSync(bundleFiles.entry)) {
    return null
  }

  const bundleStat = fs.statSync(bundleFiles.entry)
  let newestSource = null
  collectBundleSourceFiles(appId).forEach(filePath => {
    const stat = fs.statSync(filePath)
    if (!newestSource || stat.mtimeMs > newestSource.stat.mtimeMs) {
      newestSource = {filePath, stat}
    }
  })

  if (!newestSource) {
    return null
  }

  if (newestSource.stat.mtimeMs <= bundleStat.mtimeMs) {
    return null
  }

  return [
    `source changed after release bundle: ${path.relative(process.cwd(), newestSource.filePath)}`,
    `(${newestSource.stat.mtime.toISOString()} > ${bundleStat.mtime.toISOString()})`,
  ].join(' ')
}

function readReleaseManifestArtifacts(releaseManifest) {
  if (!releaseManifest || typeof releaseManifest !== 'object') {
    return []
  }
  const artifacts = releaseManifest.artifacts && typeof releaseManifest.artifacts === 'object'
    ? releaseManifest.artifacts
    : {}
  return Object.entries(artifacts).flatMap(([artifactName, artifact]) => {
    if (!artifact || typeof artifact !== 'object') {
      return []
    }
    return [{
      name: artifactName,
      path: typeof artifact.path === 'string' ? artifact.path : '',
      size: Number.isFinite(artifact.size) ? Number(artifact.size) : undefined,
      sha256: typeof artifact.sha256 === 'string' ? artifact.sha256 : undefined,
      modifiedAt: typeof artifact.modifiedAt === 'string' ? artifact.modifiedAt : undefined,
    }]
  }).filter(item => item.path)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    console.log('Usage: node scripts/release/package-hot-update.cjs --app <appId> [--channel <channel>] [--restartMode <mode>] [--operatorInstruction <text>] [--releaseNotes <a,b>] [--build-if-missing true|false] [--force-build true|false]')
    process.exit(0)
  }
  let appId = typeof args.app === 'string' ? args.app : ''
  if (!appId) {
    appId = await prompt('Assembly appId (例如 assembly-android-mixc-catering-rn84): ')
  }
  if (!appId) {
    printUsageAndExit()
  }

  const manifestPath = getManifestPath(appId)
  const releaseManifest = readJson(manifestPath)
  const channel = typeof args.channel === 'string' ? args.channel : (await prompt(`Channel [${releaseManifest.channel}]: `) || releaseManifest.channel)
  const restartMode = normalizeRestartMode(
    typeof args.restartMode === 'string'
      ? args.restartMode
      : (await prompt('Restart mode [manual|immediate|idle|next-launch]: ') || 'manual'),
  )
  const operatorInstruction = typeof args.operatorInstruction === 'string'
    ? args.operatorInstruction
    : (await prompt('Operator instruction [cashier idle restart]: ') || 'cashier idle restart')
  const releaseNotesRaw = typeof args.releaseNotes === 'string'
    ? args.releaseNotes
    : await prompt('Release notes（逗号分隔，可空）: ')
  const buildIfMissingArg = args.buildIfMissing ?? args['build-if-missing']
  const buildIfMissing = parseBooleanArg(buildIfMissingArg) !== null
    ? parseBooleanArg(buildIfMissingArg)
    : await promptYesNo('如果产物缺失，是否自动执行对应构建命令？', true)
  const forceBuildArg = args.forceBuild ?? args['force-build']
  const forceBuild = parseBooleanArg(forceBuildArg) === true

  let bundleFiles
  let buildReason = forceBuild ? 'forced by --force-build' : null
  try {
    bundleFiles = resolveBundleFiles(appId)
  } catch (error) {
    if (!buildIfMissing) {
      throw error
    }
    buildReason = error instanceof Error ? error.message : String(error)
  }

  if (!buildReason) {
    buildReason = getStaleBuildReason(appId, bundleFiles)
  }

  if (buildReason) {
    const fallbackManifestApp = requireString(releaseManifest.appId, 'appId')
    const fallbackBuildCommand = bundleFiles?.buildCommand || getLocalBuildCommand(fallbackManifestApp)
    if (!fallbackBuildCommand) {
      throw new Error(`no build command available for ${fallbackManifestApp}`)
    }
    console.log(`[hot-update] rebuilding bundle: ${buildReason}`)
    run(fallbackBuildCommand)
    bundleFiles = resolveBundleFiles(appId)
  }

  const entryContent = fs.readFileSync(bundleFiles.entry)
  const sourceMapContent = bundleFiles.sourceMap && fs.existsSync(bundleFiles.sourceMap) ? fs.readFileSync(bundleFiles.sourceMap) : null
  const extraEntryContents = bundleFiles.extraEntries.map(item => ({
    name: item.name,
    content: fs.readFileSync(item.file),
  }))
  const payloadFiles = [
    {path: bundleFiles.entryName, size: entryContent.length, sha256: sha256(entryContent)},
    ...extraEntryContents.map(item => ({path: item.name, size: item.content.length, sha256: sha256(item.content)})),
    ...(sourceMapContent && bundleFiles.sourceMapName
      ? [{path: bundleFiles.sourceMapName, size: sourceMapContent.length, sha256: sha256(sourceMapContent)}]
      : []),
  ]

  const manifest = {
    manifestVersion: 1,
    appId: releaseManifest.appId,
    platform: releaseManifest.platform,
    product: releaseManifest.product,
    channel,
    bundleVersion: releaseManifest.bundleVersion,
    runtimeVersion: releaseManifest.runtimeVersion,
    assemblyVersion: releaseManifest.assemblyVersion,
    buildNumber: releaseManifest.buildNumber,
    builtAt: new Date().toISOString(),
    git: releaseManifest.git || {commit: 'HEAD', branch: 'local'},
    compatibility: {
      appId: releaseManifest.appId,
      platform: releaseManifest.platform,
      product: releaseManifest.product,
      runtimeVersion: releaseManifest.runtimeVersion,
      minAssemblyVersion: releaseManifest.minSupportedAppVersion,
      maxAssemblyVersion: releaseManifest.assemblyVersion,
      minBuildNumber: releaseManifest.buildNumber,
      maxBuildNumber: releaseManifest.buildNumber,
      allowedChannels: [channel],
      targetPackages: releaseManifest.targetPackages,
    },
    package: {
      type: bundleFiles.payloadType,
      entry: bundleFiles.entryName,
      sourceMap: sourceMapContent && bundleFiles.sourceMapName ? bundleFiles.sourceMapName : undefined,
      compression: 'zip',
      size: entryContent.length,
      sha256: sha256(entryContent),
      files: payloadFiles,
    },
    install: {
      strategy: 'replace-bundle',
      requiresRuntimeRestart: true,
      maxRetainedPackages: 2,
    },
    restart: {
      mode: restartMode,
      operatorInstruction,
    },
    rollout: {
      defaultStrategy: 'manual-policy',
    },
    security: {
      hashAlgorithm: 'sha256',
    },
    releaseNotes: releaseNotesRaw
      ? releaseNotesRaw.split(',').map(item => item.trim()).filter(Boolean)
      : [],
    artifacts: readReleaseManifestArtifacts(releaseManifest),
  }

  const entries = [
    {name: 'manifest/hot-update-manifest.json', content: JSON.stringify(manifest, null, 2)},
    {name: bundleFiles.entryName, content: entryContent},
    ...extraEntryContents,
  ]
  if (sourceMapContent && bundleFiles.sourceMapName) {
    entries.push({name: bundleFiles.sourceMapName, content: sourceMapContent})
  }

  const zip = createZip(entries)
  const outputDir = resolveRepoPath('dist/hot-updates')
  fs.mkdirSync(outputDir, {recursive: true})
  const fileName = `hot-update-${appId}-${releaseManifest.bundleVersion}.zip`
  const outputPath = path.join(outputDir, fileName)
  fs.writeFileSync(outputPath, zip)

  const summary = {
    fileName,
    outputPath,
    fileSize: zip.length,
    sha256: sha256(zip),
    manifest,
  }
  const summaryPath = path.join(outputDir, `${fileName}.summary.json`)
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log(`[hot-update] package created: ${outputPath}`)
  console.log(`[hot-update] summary: ${summaryPath}`)
}

main().catch(error => {
  console.error(`[hot-update] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
