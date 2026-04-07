import {HttpTransportError} from '../../types'
import type {HttpExecutionPolicy} from '../../types'

export class HttpExecutionController {
  private activeCount = 0
  private readonly queue: Array<() => void> = []
  private readonly timestamps: number[] = []

  constructor(private readonly policy: HttpExecutionPolicy = {}) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireSlot()
    this.enforceRateLimit()
    this.recordRequest()

    try {
      return await task()
    } finally {
      this.releaseSlot()
    }
  }

  private async acquireSlot(): Promise<void> {
    const maxConcurrent = this.policy.maxConcurrent
    if (!maxConcurrent || maxConcurrent <= 0) {
      this.activeCount += 1
      return
    }

    if (this.activeCount < maxConcurrent) {
      this.activeCount += 1
      return
    }

    await new Promise<void>(resolve => {
      this.queue.push(() => {
        this.activeCount += 1
        resolve()
      })
    })
  }

  private releaseSlot(): void {
    this.activeCount = Math.max(0, this.activeCount - 1)
    const next = this.queue.shift()
    next?.()
  }

  private enforceRateLimit(): void {
    const windowMs = this.policy.rateLimitWindowMs
    const maxRequests = this.policy.rateLimitMaxRequests
    if (!windowMs || !maxRequests || maxRequests <= 0) {
      return
    }

    const now = Date.now()
    while (this.timestamps.length && now - this.timestamps[0] >= windowMs) {
      this.timestamps.shift()
    }

    if (this.timestamps.length >= maxRequests) {
      throw new HttpTransportError('HTTP 请求触发速率限制', {
        windowMs,
        maxRequests,
        activeCount: this.activeCount,
      })
    }
  }

  private recordRequest(): void {
    if (!this.policy.rateLimitWindowMs || !this.policy.rateLimitMaxRequests) {
      return
    }
    this.timestamps.push(Date.now())
  }

  getStats() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      recentRequestCount: this.timestamps.length,
    }
  }
}
