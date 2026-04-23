import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createNativeStateStorage} from '../turbomodules/stateStorage'

export interface TerminalVersionReportOutboxItem {
  id: string
  terminalId: string
  sandboxId: string
  payload: Record<string, unknown>
  createdAt: number
}

const OUTBOX_KEY = 'hot-update:version-report-outbox'
const OUTBOX_NAMESPACE = 'mixc-retail-assembly-rn84::version-report-outbox'
const MAX_OUTBOX_ITEMS = 20

let flushChain: Promise<void> = Promise.resolve()
let storage: StateStoragePort | null = null

const getStorage = (): StateStoragePort => {
  storage ??= createNativeStateStorage(OUTBOX_NAMESPACE)
  return storage
}

const readQueue = async (storage: StateStoragePort): Promise<TerminalVersionReportOutboxItem[]> => {
  const raw = await storage.getItem(OUTBOX_KEY)
  if (!raw) {
    return []
  }
  return parseQueue(raw)
}

const writeQueue = async (
  storage: StateStoragePort,
  queue: readonly TerminalVersionReportOutboxItem[],
): Promise<void> => {
  if (queue.length === 0) {
    await storage.removeItem(OUTBOX_KEY)
    return
  }
  await storage.setItem(OUTBOX_KEY, JSON.stringify(queue.slice(-MAX_OUTBOX_ITEMS)))
}

const parseQueue = (raw: string): TerminalVersionReportOutboxItem[] => {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is TerminalVersionReportOutboxItem => {
      const candidate = item as Partial<TerminalVersionReportOutboxItem>
      return (
        typeof candidate.id === 'string'
        && typeof candidate.terminalId === 'string'
        && typeof candidate.sandboxId === 'string'
        && candidate.payload != null
        && typeof candidate.payload === 'object'
        && !Array.isArray(candidate.payload)
        && typeof candidate.createdAt === 'number'
      )
    })
  } catch {
    return []
  }
}

export const enqueueTerminalVersionReport = async (
  item: Omit<TerminalVersionReportOutboxItem, 'createdAt'>,
): Promise<void> => {
  const storage = getStorage()
  const queue = await readQueue(storage)
  const withoutDuplicate = queue.filter(entry => entry.id !== item.id)
  withoutDuplicate.push({
    ...item,
    createdAt: Date.now(),
  })
  await writeQueue(storage, withoutDuplicate)
}

export const flushTerminalVersionReportOutbox = async (
  send: (item: TerminalVersionReportOutboxItem) => Promise<void>,
): Promise<void> => {
  const nextFlush = flushChain.then(async () => {
    const storage = getStorage()
    let queue = await readQueue(storage)
    while (queue.length > 0) {
      const [item, ...rest] = queue
      await send(item)
      queue = rest
      await writeQueue(storage, queue)
    }
  })
  flushChain = nextFlush.catch(() => undefined)
  return nextFlush
}

export const resetTerminalVersionReportOutboxForTests = (): void => {
  flushChain = Promise.resolve()
  storage = null
}
