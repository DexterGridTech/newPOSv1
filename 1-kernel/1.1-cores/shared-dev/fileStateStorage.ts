// @ts-ignore
import fs from 'node:fs'
// @ts-ignore
import path from 'node:path'
import type {StateStorage} from '@impos2/kernel-core-base'

interface StorageEnvelope {
  v: 1
  payload: unknown
}

const ensureDirectory = (targetDir: string) => {
  fs.mkdirSync(targetDir, {recursive: true})
}

const readJsonFile = (filePath: string): Record<string, StorageEnvelope> => {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.trim()) {
    return {}
  }
  return JSON.parse(raw) as Record<string, StorageEnvelope>
}

const writeJsonFile = (filePath: string, content: Record<string, StorageEnvelope>) => {
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8')
}

const buildStorageKey = (key: string, args: unknown[]) => {
  if (!args.length) {
    return key
  }
  return `${args.map(item => String(item)).join('::')}::${key}`
}

export const createFileStateStorage = (input: {filePath: string}): StateStorage => {
  ensureDirectory(path.dirname(input.filePath))

  return {
    async getItem(key: string, ...args: unknown[]) {
      const content = readJsonFile(input.filePath)
      const storageKey = buildStorageKey(key, args)
      return content[storageKey]?.payload ?? null
    },
    async setItem(key: string, value: unknown, ...args: unknown[]) {
      const content = readJsonFile(input.filePath)
      const storageKey = buildStorageKey(key, args)
      if (value === undefined) {
        delete content[storageKey]
      } else {
        content[storageKey] = {
          v: 1,
          payload: value,
        }
      }
      writeJsonFile(input.filePath, content)
    },
    async removeItem(key: string, ...args: unknown[]) {
      const content = readJsonFile(input.filePath)
      delete content[buildStorageKey(key, args)]
      writeJsonFile(input.filePath, content)
    },
  }
}

export const resetFileStateStorage = (filePath: string) => {
  ensureDirectory(path.dirname(filePath))
  writeJsonFile(filePath, {})
}

export const readFileStateStorageSnapshot = (filePath: string) => readJsonFile(filePath)
