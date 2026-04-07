export class BaseHeartbeatManager {
  private timeoutId: ReturnType<typeof setTimeout> | undefined
  private readonly heartbeatTimeoutMs: number
  private readonly onTimeout: () => void

  constructor(heartbeatTimeoutMs: number, onTimeout: () => void) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs
    this.onTimeout = onTimeout
  }

  start(): void {
    if (!this.heartbeatTimeoutMs) {
      return
    }
    this.touch()
  }

  touch(): void {
    this.stop()
    if (!this.heartbeatTimeoutMs) {
      return
    }
    this.timeoutId = setTimeout(() => {
      this.onTimeout()
    }, this.heartbeatTimeoutMs)
  }

  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }
  }
}
