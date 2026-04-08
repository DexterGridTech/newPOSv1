import {
  getCommunicationServersFromStoreEntry,
  HttpRuntime,
  type CommunicationServerConfig,
} from '@impos2/kernel-core-communication'
import {
  kernelCoreTcpClientApis,
} from '../../supports'
import type {
  ActivateTerminalApiRequest,
  ActivateTerminalApiResponse,
  RefreshTerminalCredentialApiRequest,
  RefreshTerminalCredentialApiResponse,
  ReportTaskResultApiRequest,
  ReportTaskResultApiResponse,
  TcpPlatformEnvelope,
} from '../../types'

// TCP HTTP service 是控制面 API 的轻量封装。
// 这里只处理 communication runtime 与 mock-terminal-platform 的 envelope 解包，
// 不承担状态写入，状态写入由 actors 完成。
export class TcpHttpService {
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

  async activateTerminal(request: ActivateTerminalApiRequest): Promise<ActivateTerminalApiResponse> {
    const response = await this.runtime.call(kernelCoreTcpClientApis.activateTerminal, {
      body: request,
    })
    return unwrapTcpPlatformEnvelope(response)
  }

  async refreshCredential(request: RefreshTerminalCredentialApiRequest): Promise<RefreshTerminalCredentialApiResponse> {
    const response = await this.runtime.call(kernelCoreTcpClientApis.refreshCredential, {
      body: request,
    })
    return unwrapTcpPlatformEnvelope(response)
  }

  async reportTaskResult(
    terminalId: string,
    instanceId: string,
    request: ReportTaskResultApiRequest,
  ): Promise<ReportTaskResultApiResponse> {
    const response = await this.runtime.call(kernelCoreTcpClientApis.reportTaskResult, {
      path: {terminalId, instanceId},
      body: request,
    })
    return unwrapTcpPlatformEnvelope(response)
  }
}

export const tcpHttpService = new TcpHttpService()

function unwrapTcpPlatformEnvelope<T>(response: TcpPlatformEnvelope<T>): T {
  if (!response.success) {
    throw new Error(response.error?.message ?? 'mock-terminal-platform request failed')
  }
  return response.data
}
