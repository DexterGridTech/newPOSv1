import {
  getCommunicationServersFromStoreEntry,
  HttpRuntime,
  type CommunicationServerConfig,
} from '@impos2/kernel-core-communication'
import {kernelCoreTdpClientApis} from '../../supports'
import type {TdpChangesResponse, TdpProjectionEnvelope} from '../../types'

// TDP HTTP service 只负责补充“快照 / 增量”拉取能力。
// 实时推送仍然以 WebSocket 为主。
export class TdpHttpService {
  private readonly runtime: HttpRuntime

  constructor(config?: {
    servers?: CommunicationServerConfig[]
    serverConfigProvider?: () => CommunicationServerConfig[]
  }) {
    this.runtime = new HttpRuntime({
      servers: config?.servers,
      serverConfigProvider: config?.serverConfigProvider ?? getCommunicationServersFromStoreEntry,
      unwrapEnvelope: false,
    })
  }

  async getSnapshot(terminalId: string): Promise<TdpProjectionEnvelope[]> {
    // snapshot 用于冷启动或需要兜底重建本地投影时拉取全量。
    const response = await this.runtime.call(kernelCoreTdpClientApis.getSnapshot, {
      path: {terminalId},
    })
    if (!response.success) {
      throw new Error(response.error?.message ?? 'get snapshot failed')
    }
    return response.data
  }

  async getChanges(terminalId: string, cursor = 0, limit?: number): Promise<TdpChangesResponse['data']> {
    // changes 用于从指定 cursor 开始做增量补偿。
    const response = await this.runtime.call(kernelCoreTdpClientApis.getChanges, {
      path: {terminalId},
      query: {cursor, limit},
    })
    if (!response.success) {
      throw new Error(response.error?.message ?? 'get changes failed')
    }
    return response.data
  }
}

export const tdpHttpService = new TdpHttpService()
