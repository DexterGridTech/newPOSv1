import {LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../moduleName";
import {syncStateToRemote} from "./syncStateToRemote";

interface SyncRetryItem {
    stateKey: string
    changes: Record<string, any>
    retryCount: number
    addedAt: number
}

export class SyncRetryQueue {
    private queue: SyncRetryItem[] = []
    private retrying = false
    private readonly maxRetries: number
    private readonly retryInterval: number
    private readonly maxQueueSize: number
    private retryTimer: ReturnType<typeof setTimeout> | null = null

    constructor(maxRetries = 3, retryInterval = 2000, maxQueueSize = 100) {
        this.maxRetries = maxRetries
        this.retryInterval = retryInterval
        this.maxQueueSize = maxQueueSize
    }

    enqueue(stateKey: string, changes: Record<string, any>): void {
        // 合并同一 stateKey + targetDevice 的变更
        const existing = this.queue.find(
            item => item.stateKey === stateKey
        )
        if (existing) {
            Object.assign(existing.changes, changes)
            existing.retryCount = 0
            return
        }

        if (this.queue.length >= this.maxQueueSize) {
            // 移除最旧的项
            const removed = this.queue.shift()
            logger.warn([moduleName, LOG_TAGS.System, "SyncRetryQueue"],
                `队列已满，丢弃最旧的同步项: ${removed?.stateKey}`)
        }

        this.queue.push({
            stateKey,
            changes: {...changes},
            retryCount: 0,
            addedAt: Date.now()
        })

        this.scheduleRetry()
    }

    private scheduleRetry(): void {
        if (this.retrying || this.queue.length === 0) return
        this.retryTimer = setTimeout(() => this.processQueue(), this.retryInterval)
    }

    private async processQueue(): Promise<void> {
        if (this.retrying || this.queue.length === 0) return
        this.retrying = true

        const items = [...this.queue]
        this.queue = []

        for (const item of items) {
            try {
                await syncStateToRemote(item.stateKey, item.changes)
                logger.log([moduleName, LOG_TAGS.System, "SyncRetryQueue"],
                    `重试同步成功: ${item.stateKey}`)
            } catch (error) {
                item.retryCount++
                if (item.retryCount < this.maxRetries) {
                    this.queue.push(item)
                    logger.warn([moduleName, LOG_TAGS.System, "SyncRetryQueue"],
                        `重试同步失败(${item.retryCount}/${this.maxRetries}): ${item.stateKey}`)
                } else {
                    logger.error([moduleName, LOG_TAGS.System, "SyncRetryQueue"],
                        `同步最终失败，已达最大重试次数: ${item.stateKey}`, error)
                }
            }
        }

        this.retrying = false
        this.scheduleRetry()
    }

    clear(): void {
        this.queue = []
        if (this.retryTimer) {
            clearTimeout(this.retryTimer)
            this.retryTimer = null
        }
    }

    get size(): number {
        return this.queue.length
    }
}
