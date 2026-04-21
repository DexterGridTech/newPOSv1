import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { and, desc, eq } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import { db, sqlite } from '../../database/index.js'
import {
  hotUpdatePackagesTable,
  hotUpdateReleasesTable,
  terminalsTable,
} from '../../database/schema.js'
import { createId, now, parseJson } from '../../shared/utils.js'
import { assertSandboxUsable } from '../sandbox/service.js'
import {
  createProjectionPolicy,
  deleteProjectionPolicy,
  updateProjectionPolicy,
} from '../tdp/policyService.js'
import { resolveTerminalIdsByScope } from '../tdp/groupService.js'
import type { HotUpdateDesiredPayloadDto, HotUpdateManifestDto } from './hotUpdateTypes.js'

const HOT_UPDATE_TOPIC_KEY = 'terminal.hot-update.desired'
const HOT_UPDATE_ITEM_KEY = 'main'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(currentDir, '../../../data/hot-updates')

const ensureStorageDir = (sandboxId: string) => {
  const dir = path.join(storageRoot, sandboxId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const sha256 = (input: Buffer | string) => createHash('sha256').update(input).digest('hex')

const parseZipEntries = (buffer: Buffer) => {
  const entries = new Map<string, Buffer>()
  let offset = 0
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset)
    if (signature !== 0x04034b50) {
      break
    }
    const compression = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const fileNameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const nameEnd = nameStart + fileNameLength
    const dataStart = nameEnd + extraLength
    const dataEnd = dataStart + compressedSize
    const name = buffer.subarray(nameStart, nameEnd).toString('utf8')
    const compressed = buffer.subarray(dataStart, dataEnd)
    let content: Buffer
    if (compression === 0) {
      content = Buffer.from(compressed)
    } else if (compression === 8) {
      content = createInflateRaw(compressed)
    } else {
      throw new Error(`UNSUPPORTED_ZIP_COMPRESSION:${compression}`)
    }
    entries.set(name, content)
    offset = dataEnd
  }
  return entries
}

const createInflateRaw = (input: Buffer) => {
  return Buffer.from(inflateRawSync(input))
}

const requireString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`INVALID_${field.toUpperCase()}`)
  }
  return value.trim()
}

const requireNumber = (value: unknown, field: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`INVALID_${field.toUpperCase()}`)
  }
  return Number(value)
}

const parseManifest = (value: string): HotUpdateManifestDto => {
  const parsed = JSON.parse(value) as HotUpdateManifestDto
  if (parsed.manifestVersion !== 1) {
    throw new Error('UNSUPPORTED_MANIFEST_VERSION')
  }
  requireString(parsed.appId, 'appId')
  requireString(parsed.platform, 'platform')
  requireString(parsed.product, 'product')
  requireString(parsed.channel, 'channel')
  requireString(parsed.bundleVersion, 'bundleVersion')
  requireString(parsed.runtimeVersion, 'runtimeVersion')
  requireString(parsed.assemblyVersion, 'assemblyVersion')
  requireNumber(parsed.buildNumber, 'buildNumber')
  requireString(parsed.package?.entry, 'package.entry')
  requireString(parsed.package?.sha256, 'package.sha256')
  requireNumber(parsed.package?.size, 'package.size')
  if (parsed.package?.compression !== 'zip') {
    throw new Error('UNSUPPORTED_PACKAGE_COMPRESSION')
  }
  if (parsed.package.files != null && !Array.isArray(parsed.package.files)) {
    throw new Error('INVALID_PACKAGE_FILES')
  }
  return parsed
}

const validatePackageFiles = (input: {
  entries: Map<string, Buffer>
  manifest: HotUpdateManifestDto
}) => {
  const files = input.manifest.package.files
  if (!files || files.length === 0) {
    return
  }
  for (const file of files) {
    const filePath = requireString(file.path, 'package.files.path')
    const expectedHash = requireString(file.sha256, `package.files.${filePath}.sha256`)
    const expectedSize = requireNumber(file.size, `package.files.${filePath}.size`)
    const content = input.entries.get(filePath)
    if (!content) {
      throw new Error(`HOT_UPDATE_PACKAGE_FILE_NOT_FOUND:${filePath}`)
    }
    if (sha256(content) !== expectedHash) {
      throw new Error(`HOT_UPDATE_PACKAGE_FILE_HASH_MISMATCH:${filePath}`)
    }
    if (content.length !== expectedSize) {
      throw new Error(`HOT_UPDATE_PACKAGE_FILE_SIZE_MISMATCH:${filePath}`)
    }
  }
}

const makeDownloadToken = (input: { sandboxId: string; packageId: string; sha256: string }) =>
  sha256(`${input.sandboxId}:${input.packageId}:${input.sha256}`)

const buildDownloadUrl = (input: { sandboxId: string; packageId: string; sha256: string }) =>
  `/api/v1/hot-updates/packages/${input.packageId}/download?sandboxId=${encodeURIComponent(input.sandboxId)}&token=${encodeURIComponent(makeDownloadToken(input))}`

const mapPackageRecord = (item: typeof hotUpdatePackagesTable.$inferSelect) => {
  const manifest = parseJson<HotUpdateManifestDto>(item.manifestJson, {} as HotUpdateManifestDto)
  return {
    ...item,
    manifest,
    downloadUrl: buildDownloadUrl({
      sandboxId: item.sandboxId,
      packageId: item.packageId,
      sha256: item.sha256,
    }),
  }
}

const mapReleaseRecord = (item: typeof hotUpdateReleasesTable.$inferSelect) => ({
  ...item,
  enabled: Boolean(item.enabled),
  desiredPayload: parseJson<HotUpdateDesiredPayloadDto>(item.desiredPayloadJson, {} as HotUpdateDesiredPayloadDto),
})

const getPackageSummary = (sandboxId: string, packageId: string) => {
  const record = db.select().from(hotUpdatePackagesTable).where(and(
    eq(hotUpdatePackagesTable.sandboxId, sandboxId),
    eq(hotUpdatePackagesTable.packageId, packageId),
  )).get()
  return record ? mapPackageRecord(record) : null
}

export const listHotUpdatePackages = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(hotUpdatePackagesTable)
    .where(eq(hotUpdatePackagesTable.sandboxId, sandboxId))
    .orderBy(desc(hotUpdatePackagesTable.updatedAt))
    .all()
    .map(mapPackageRecord)
}

export const getHotUpdatePackage = (input: { sandboxId: string; packageId: string }) => {
  assertSandboxUsable(input.sandboxId)
  const record = db.select().from(hotUpdatePackagesTable).where(and(
    eq(hotUpdatePackagesTable.sandboxId, input.sandboxId),
    eq(hotUpdatePackagesTable.packageId, input.packageId),
  )).get()
  if (!record) {
    throw new Error('HOT_UPDATE_PACKAGE_NOT_FOUND')
  }
  return mapPackageRecord(record)
}

export const updateHotUpdatePackageStatus = (input: { sandboxId: string; packageId: string; status: string }) => {
  const current = getHotUpdatePackage(input)
  const timestamp = now()
  db.update(hotUpdatePackagesTable).set({
    status: requireString(input.status, 'status'),
    updatedAt: timestamp,
  }).where(and(
    eq(hotUpdatePackagesTable.sandboxId, input.sandboxId),
    eq(hotUpdatePackagesTable.packageId, input.packageId),
  )).run()
  return getHotUpdatePackage(input)
}

export const uploadHotUpdatePackage = (input: {
  sandboxId: string
  fileName: string
  contentBase64: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const fileName = requireString(input.fileName, 'fileName')
  const contentBase64 = requireString(input.contentBase64, 'contentBase64')
  const buffer = Buffer.from(contentBase64, 'base64')
  const archiveSha256 = sha256(buffer)
  const entries = parseZipEntries(buffer)
  const manifestContent = entries.get('manifest/hot-update-manifest.json')
  if (!manifestContent) {
    throw new Error('HOT_UPDATE_MANIFEST_NOT_FOUND')
  }
  const manifest = parseManifest(manifestContent.toString('utf8'))
  const manifestSha256 = sha256(manifestContent)
  const entryContent = entries.get(manifest.package.entry)
  if (!entryContent) {
    throw new Error('HOT_UPDATE_ENTRY_NOT_FOUND')
  }
  if (sha256(entryContent) !== manifest.package.sha256) {
    throw new Error('HOT_UPDATE_ENTRY_HASH_MISMATCH')
  }
  if (entryContent.length !== manifest.package.size) {
    throw new Error('HOT_UPDATE_ENTRY_SIZE_MISMATCH')
  }
  validatePackageFiles({ entries, manifest })

  const duplicated = db.select().from(hotUpdatePackagesTable).where(and(
    eq(hotUpdatePackagesTable.sandboxId, sandboxId),
    eq(hotUpdatePackagesTable.appId, manifest.appId),
    eq(hotUpdatePackagesTable.bundleVersion, manifest.bundleVersion),
    eq(hotUpdatePackagesTable.runtimeVersion, manifest.runtimeVersion),
    eq(hotUpdatePackagesTable.sha256, archiveSha256),
  )).get()
  if (duplicated) {
    return mapPackageRecord(duplicated)
  }

  const packageId = createId('pkg')
  const storageDir = ensureStorageDir(sandboxId)
  const storagePath = path.join(storageDir, `${packageId}.zip`)
  fs.writeFileSync(storagePath, buffer)

  const timestamp = now()
  const persistedManifest: HotUpdateManifestDto = {
    ...manifest,
    packageId,
  }
  db.insert(hotUpdatePackagesTable).values({
    packageId,
    sandboxId,
    appId: manifest.appId,
    platform: manifest.platform,
    product: manifest.product,
    channel: manifest.channel,
    bundleVersion: manifest.bundleVersion,
    runtimeVersion: manifest.runtimeVersion,
    assemblyVersion: manifest.assemblyVersion,
    buildNumber: manifest.buildNumber,
    manifestJson: JSON.stringify(persistedManifest),
    manifestSha256,
    fileName,
    fileSize: buffer.length,
    sha256: archiveSha256,
    storagePath,
    status: 'VALIDATED',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return getHotUpdatePackage({ sandboxId, packageId })
}

const buildDesiredPayload = (input: {
  packageRecord: ReturnType<typeof getHotUpdatePackage>
  releaseId: string
  rolloutMode?: 'active' | 'paused' | 'rollback'
  restart?: Partial<HotUpdateDesiredPayloadDto['restart']>
  publishedAt?: string
}) => {
  const manifest = input.packageRecord.manifest
  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    packageId: input.packageRecord.packageId,
    appId: manifest.appId,
    platform: manifest.platform,
    product: manifest.product,
    bundleVersion: manifest.bundleVersion,
    runtimeVersion: manifest.runtimeVersion,
    packageUrl: input.packageRecord.downloadUrl,
    packageSize: input.packageRecord.fileSize,
    packageSha256: input.packageRecord.sha256,
    manifestSha256: input.packageRecord.manifestSha256,
    compatibility: manifest.compatibility,
    restart: {
      ...manifest.restart,
      ...input.restart,
    },
    rollout: {
      mode: input.rolloutMode ?? 'paused',
      publishedAt: input.publishedAt ?? new Date(now()).toISOString(),
    },
    safety: {
      requireSignature: Boolean(manifest.security.signatureAlgorithm),
      maxDownloadAttempts: 3,
      maxLaunchFailures: 2,
      healthCheckTimeoutMs: 5_000,
    },
    metadata: {
      channel: manifest.channel,
      builtAt: manifest.builtAt,
      releaseNotes: manifest.releaseNotes ?? [],
    },
  } satisfies HotUpdateDesiredPayloadDto
}

export const listHotUpdateReleases = (sandboxId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(hotUpdateReleasesTable)
    .where(eq(hotUpdateReleasesTable.sandboxId, sandboxId))
    .orderBy(desc(hotUpdateReleasesTable.updatedAt))
    .all()
    .map(item => {
      const mapped = mapReleaseRecord(item)
      return {
        ...mapped,
        packageSummary: getPackageSummary(sandboxId, mapped.packageId),
      }
    })
}

export const getHotUpdateRelease = (input: { sandboxId: string; releaseId: string }) => {
  assertSandboxUsable(input.sandboxId)
  const record = db.select().from(hotUpdateReleasesTable).where(and(
    eq(hotUpdateReleasesTable.sandboxId, input.sandboxId),
    eq(hotUpdateReleasesTable.releaseId, input.releaseId),
  )).get()
  if (!record) {
    throw new Error('HOT_UPDATE_RELEASE_NOT_FOUND')
  }
  const mapped = mapReleaseRecord(record)
  return {
    ...mapped,
    packageSummary: getPackageSummary(input.sandboxId, mapped.packageId),
  }
}

export const createHotUpdateRelease = (input: {
  sandboxId: string
  packageId: string
  scopeType: 'GROUP' | 'TERMINAL'
  scopeKey: string
  createdBy?: string
  restart?: Partial<HotUpdateDesiredPayloadDto['restart']>
  rolloutMode?: 'active' | 'paused' | 'rollback'
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const packageRecord = getHotUpdatePackage({ sandboxId, packageId: input.packageId })
  const releaseId = createId('release')
  const timestamp = now()
  const desiredPayload = buildDesiredPayload({
    packageRecord,
    releaseId,
    rolloutMode: input.rolloutMode ?? 'paused',
    restart: input.restart,
    publishedAt: new Date(timestamp).toISOString(),
  })
  db.insert(hotUpdateReleasesTable).values({
    releaseId,
    sandboxId,
    packageId: input.packageId,
    topicKey: HOT_UPDATE_TOPIC_KEY,
    itemKey: HOT_UPDATE_ITEM_KEY,
    scopeType: input.scopeType,
    scopeKey: requireString(input.scopeKey, 'scopeKey'),
    enabled: 0,
    desiredPayloadJson: JSON.stringify(desiredPayload),
    policyId: null,
    status: 'DRAFT',
    createdBy: input.createdBy?.trim() || 'admin-console',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()
  return getHotUpdateRelease({ sandboxId, releaseId })
}

const estimateMatchedTerminalCount = (input: { sandboxId: string; scopeType: 'GROUP' | 'TERMINAL'; scopeKey: string }) => {
  if (input.scopeType === 'TERMINAL') {
    const exists = db.select().from(terminalsTable).where(and(
      eq(terminalsTable.sandboxId, input.sandboxId),
      eq(terminalsTable.terminalId, input.scopeKey),
    )).get()
    return exists ? 1 : 0
  }
  return resolveTerminalIdsByScope({
    sandboxId: input.sandboxId,
    scopeType: 'GROUP',
    scopeKeys: [input.scopeKey],
  }).length
}

export const activateHotUpdateRelease = (input: { sandboxId: string; releaseId: string }) => {
  const current = getHotUpdateRelease(input)
  if (current.status === 'ACTIVE') {
    return {
      ...current,
      materializedTerminalCount: estimateMatchedTerminalCount({
        sandboxId: input.sandboxId,
        scopeType: current.scopeType as 'GROUP' | 'TERMINAL',
        scopeKey: current.scopeKey,
      }),
    }
  }
  let policyId: string | undefined
  sqlite.transaction(() => {
    const desiredPayload = {
      ...current.desiredPayload,
      rollout: {
        ...current.desiredPayload.rollout,
        mode: 'active' as const,
        publishedAt: new Date(now()).toISOString(),
      },
    }
    policyId = current.policyId ?? undefined
    if (policyId) {
      updateProjectionPolicy({
        sandboxId: input.sandboxId,
        policyId,
        enabled: true,
        payloadJson: desiredPayload,
        description: `hot update release ${current.releaseId}`,
      })
    } else {
      const policy = createProjectionPolicy({
        sandboxId: input.sandboxId,
        topicKey: HOT_UPDATE_TOPIC_KEY,
        itemKey: HOT_UPDATE_ITEM_KEY,
        scopeType: current.scopeType,
        scopeKey: current.scopeKey,
        enabled: true,
        payloadJson: desiredPayload,
        description: `hot update release ${current.releaseId}`,
      })
      policyId = policy.policyId
    }
    db.update(hotUpdateReleasesTable).set({
      enabled: 1,
      policyId,
      status: 'ACTIVE',
      desiredPayloadJson: JSON.stringify(desiredPayload),
      updatedAt: now(),
    }).where(and(
      eq(hotUpdateReleasesTable.sandboxId, input.sandboxId),
      eq(hotUpdateReleasesTable.releaseId, input.releaseId),
    )).run()
  })()

  return {
    ...getHotUpdateRelease(input),
    policyId: policyId!,
    materializedTerminalCount: estimateMatchedTerminalCount({
      sandboxId: input.sandboxId,
      scopeType: current.scopeType as 'GROUP' | 'TERMINAL',
      scopeKey: current.scopeKey,
    }),
  }
}

const updateReleaseLifecycle = (input: {
  sandboxId: string
  releaseId: string
  status: 'PAUSED' | 'CANCELLED'
  rolloutMode: 'paused' | 'rollback'
  enabled: boolean
}) => {
  const current = getHotUpdateRelease(input)
  sqlite.transaction(() => {
    const desiredPayload = {
      ...current.desiredPayload,
      rollout: {
        ...current.desiredPayload.rollout,
        mode: input.rolloutMode,
        publishedAt: new Date(now()).toISOString(),
      },
    }
    if (current.policyId) {
      updateProjectionPolicy({
        sandboxId: input.sandboxId,
        policyId: current.policyId,
        enabled: input.enabled,
        payloadJson: desiredPayload,
        description: `hot update release ${current.releaseId}`,
      })
    }
    db.update(hotUpdateReleasesTable).set({
      enabled: input.enabled ? 1 : 0,
      policyId: input.enabled ? current.policyId : null,
      status: input.status,
      desiredPayloadJson: JSON.stringify(desiredPayload),
      updatedAt: now(),
    }).where(and(
      eq(hotUpdateReleasesTable.sandboxId, input.sandboxId),
      eq(hotUpdateReleasesTable.releaseId, input.releaseId),
    )).run()
  })()
  return getHotUpdateRelease(input)
}

export const pauseHotUpdateRelease = (input: { sandboxId: string; releaseId: string }) =>
  updateReleaseLifecycle({
    ...input,
    status: 'PAUSED',
    rolloutMode: 'paused',
    enabled: false,
  })

export const cancelHotUpdateRelease = (input: { sandboxId: string; releaseId: string }) => {
  const current = getHotUpdateRelease(input)
  sqlite.transaction(() => {
    if (current.policyId) {
      deleteProjectionPolicy({
        sandboxId: input.sandboxId,
        policyId: current.policyId,
      })
    }
    db.update(hotUpdateReleasesTable).set({
      enabled: 0,
      policyId: null,
      status: 'CANCELLED',
      updatedAt: now(),
    }).where(and(
      eq(hotUpdateReleasesTable.sandboxId, input.sandboxId),
      eq(hotUpdateReleasesTable.releaseId, input.releaseId),
    )).run()
  })()
  return getHotUpdateRelease(input)
}

export const previewHotUpdateReleaseImpact = (input: {
  sandboxId: string
  scopeType: 'GROUP' | 'TERMINAL'
  scopeKey: string
}) => {
  const terminalIds = input.scopeType === 'TERMINAL'
    ? [input.scopeKey]
    : resolveTerminalIdsByScope({
        sandboxId: input.sandboxId,
        scopeType: 'GROUP',
        scopeKeys: [input.scopeKey],
      })
  return {
    total: terminalIds.length,
    terminalIds,
    scopeType: input.scopeType,
    scopeKey: input.scopeKey,
    reason: input.scopeType === 'GROUP'
      ? `Dynamic group ${input.scopeKey} currently matches ${terminalIds.length} terminal(s); future matching terminals will receive the same release.`
      : `Terminal scope targets ${input.scopeKey} directly.`,
    warnings: [
      ...(terminalIds.length === 0 ? ['NO_MATCHED_TERMINALS'] : []),
    ],
  }
}

export const resolveHotUpdateDownload = (input: {
  sandboxId: string
  packageId: string
  token: string
}) => {
  const record = getHotUpdatePackage({ sandboxId: input.sandboxId, packageId: input.packageId })
  if (record.status === 'BLOCKED') {
    throw new Error('HOT_UPDATE_PACKAGE_BLOCKED')
  }
  const expected = makeDownloadToken({
    sandboxId: input.sandboxId,
    packageId: input.packageId,
    sha256: record.sha256,
  })
  if (input.token !== expected) {
    throw new Error('HOT_UPDATE_DOWNLOAD_TOKEN_INVALID')
  }
  return {
    filePath: record.storagePath,
    fileName: record.fileName,
    fileSize: record.fileSize,
    sha256: record.sha256,
  }
}
