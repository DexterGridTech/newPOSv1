import type {HttpCallMetric, HttpMetricsRecorder} from '../../types'

export class InMemoryHttpMetricsRecorder implements HttpMetricsRecorder {
  private readonly calls: HttpCallMetric[] = []

  recordCall(metric: HttpCallMetric): void {
    this.calls.push(metric)
  }

  getCalls(): HttpCallMetric[] {
    return [...this.calls]
  }

  clear(): void {
    this.calls.length = 0
  }
}
