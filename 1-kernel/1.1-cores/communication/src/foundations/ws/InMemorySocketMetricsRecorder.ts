import type {SocketConnectionMetric, SocketMetricsRecorder} from '../../types'

export class InMemorySocketMetricsRecorder implements SocketMetricsRecorder {
  private readonly connections: SocketConnectionMetric[] = []

  recordConnection(metric: SocketConnectionMetric): void {
    this.connections.push(metric)
  }

  getConnections(): SocketConnectionMetric[] {
    return [...this.connections]
  }

  clear(): void {
    this.connections.length = 0
  }
}
