import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {and, desc, eq} from 'drizzle-orm'
import {db, getDataRoot} from '../../database/index.js'
import {
  taskInstancesTable,
  terminalLogFilesTable,
} from '../../database/schema.js'
import {createId, now, parseJson} from '../../shared/utils.js'
import {assertSandboxUsable} from '../sandbox/service.js'
import {createTaskInstancesForRelease, createTaskRelease} from '../tcp/service.js'
import {dispatchTaskReleaseToDataPlane} from '../tdp/service.js'

const getStorageRoot = (sandboxId: string, terminalId: string) => {
  const root = getDataRoot()
  const storageRoot = root
    ? path.resolve(root, 'terminal-logs', sandboxId, terminalId)
    : path.resolve(process.cwd(), 'data/terminal-logs', sandboxId, terminalId)
  fs.mkdirSync(storageRoot, {recursive: true})
  return storageRoot
}

const sha256 = (input: Buffer | string) => createHash('sha256').update(input).digest('hex')

const normalizeDisplayRole = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toUpperCase()
  }
  return 'PRIMARY'
}

const normalizeDisplayIndex = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const mapLogRecord = (item: typeof terminalLogFilesTable.$inferSelect) => ({
  ...item,
  metadata: parseJson(item.metadataJson, {}),
})

export const listTerminalLogFiles = (sandboxId: string, terminalId: string) => {
  assertSandboxUsable(sandboxId)
  return db.select().from(terminalLogFilesTable)
    .where(and(
      eq(terminalLogFilesTable.sandboxId, sandboxId),
      eq(terminalLogFilesTable.terminalId, terminalId),
    ))
    .orderBy(desc(terminalLogFilesTable.updatedAt))
    .all()
    .map(mapLogRecord)
}

export const requestTerminalLogUpload = (input: {
  sandboxId: string
  terminalId: string
  logDate: string
  overwrite?: boolean
  operator?: string
  uploadUrl: string
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const release = createTaskRelease({
    sandboxId,
    title: `控制台-终端日志拉取-${input.logDate}`,
    taskType: 'REMOTE_CONTROL',
    sourceType: 'TERMINAL_LOG',
    sourceId: `${input.terminalId}:${input.logDate}`,
    priority: 60,
    targetTerminalIds: [input.terminalId],
    payload: {
      topicKey: 'remote.control',
      commandType: 'UPLOAD_TERMINAL_LOGS',
      logDate: input.logDate,
      uploadUrl: input.uploadUrl,
      overwrite: input.overwrite !== false,
    },
  })
  const dispatch = createTaskInstancesForRelease({sandboxId, releaseId: release.releaseId})
  const tdp = dispatchTaskReleaseToDataPlane({sandboxId, releaseId: release.releaseId})
  const instance = db.select().from(taskInstancesTable)
    .where(eq(taskInstancesTable.releaseId, release.releaseId))
    .get()

  return {
    release,
    dispatch,
    tdp,
    instanceId: instance?.instanceId,
  }
}

export const receiveTerminalLogUpload = (input: {
  sandboxId: string
  terminalId: string
  logDate: string
  displayIndex?: number
  displayRole?: string
  commandId?: string
  instanceId?: string
  releaseId?: string
  fileName: string
  contentType?: string
  contentBase64: string
  metadata?: Record<string, unknown>
}) => {
  const sandboxId = input.sandboxId
  assertSandboxUsable(sandboxId)
  const timestamp = now()
  const displayIndex = normalizeDisplayIndex(input.displayIndex)
  const displayRole = normalizeDisplayRole(input.displayRole)
  const buffer = Buffer.from(input.contentBase64, 'base64')
  const fileName = input.fileName.trim()
  if (!fileName) {
    throw new Error('LOG_FILE_NAME_REQUIRED')
  }

  const storageDir = getStorageRoot(sandboxId, input.terminalId)
  const storagePath = path.join(storageDir, `${input.logDate}-${displayRole.toLowerCase()}-${fileName}`)
  fs.writeFileSync(storagePath, buffer)
  const fileHash = sha256(buffer)

  const existing = db.select().from(terminalLogFilesTable).where(and(
    eq(terminalLogFilesTable.sandboxId, sandboxId),
    eq(terminalLogFilesTable.terminalId, input.terminalId),
    eq(terminalLogFilesTable.logDate, input.logDate),
    eq(terminalLogFilesTable.displayIndex, displayIndex),
    eq(terminalLogFilesTable.displayRole, displayRole),
    eq(terminalLogFilesTable.fileName, fileName),
  )).get()

  if (existing) {
    db.update(terminalLogFilesTable).set({
      displayRole,
      contentType: input.contentType?.trim() || 'text/plain',
      fileSize: buffer.length,
      sha256: fileHash,
      storagePath,
      commandId: input.commandId ?? existing.commandId,
      instanceId: input.instanceId ?? existing.instanceId,
      releaseId: input.releaseId ?? existing.releaseId,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      uploadedAt: timestamp,
      updatedAt: timestamp,
    }).where(eq(terminalLogFilesTable.logFileId, existing.logFileId)).run()
    return mapLogRecord({
      ...existing,
      displayRole,
      contentType: input.contentType?.trim() || 'text/plain',
      fileSize: buffer.length,
      sha256: fileHash,
      storagePath,
      commandId: input.commandId ?? existing.commandId,
      instanceId: input.instanceId ?? existing.instanceId,
      releaseId: input.releaseId ?? existing.releaseId,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      uploadedAt: timestamp,
      updatedAt: timestamp,
    })
  }

  const logFileId = createId('terminal_log')
  db.insert(terminalLogFilesTable).values({
    logFileId,
    sandboxId,
    terminalId: input.terminalId,
    logDate: input.logDate,
    displayIndex,
    displayRole,
    fileName,
    contentType: input.contentType?.trim() || 'text/plain',
    fileSize: buffer.length,
    sha256: fileHash,
    storagePath,
    commandId: input.commandId ?? null,
    instanceId: input.instanceId ?? null,
    releaseId: input.releaseId ?? null,
    metadataJson: JSON.stringify(input.metadata ?? {}),
    uploadedAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return mapLogRecord({
    logFileId,
    sandboxId,
    terminalId: input.terminalId,
    logDate: input.logDate,
    displayIndex,
    displayRole,
    fileName,
    contentType: input.contentType?.trim() || 'text/plain',
    fileSize: buffer.length,
    sha256: fileHash,
    storagePath,
    commandId: input.commandId ?? null,
    instanceId: input.instanceId ?? null,
    releaseId: input.releaseId ?? null,
    metadataJson: JSON.stringify(input.metadata ?? {}),
    uploadedAt: timestamp,
    updatedAt: timestamp,
  })
}
