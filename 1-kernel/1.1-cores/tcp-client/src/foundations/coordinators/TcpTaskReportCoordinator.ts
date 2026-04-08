import {AppError} from '@impos2/kernel-core-base'
import {tcpHttpService} from '../services/TcpHttpService'
import {kernelCoreTcpClientErrorMessages} from '../../supports'
import type {TcpTaskResultReportRequest, TcpTaskResultReportResponse} from '../../types'

export class TcpTaskReportCoordinator {
  async report(request: TcpTaskResultReportRequest): Promise<TcpTaskResultReportResponse> {
    try {
      return await tcpHttpService.reportTaskResult(
        request.terminalId,
        request.instanceId,
        {
          status: request.status,
          result: request.result,
          error: request.error,
        },
      )
    } catch (error) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpTaskResultReportFailed, {
        error: error instanceof Error ? error.message : 'unknown task report error',
      })
    }
  }
}

export const tcpTaskReportCoordinator = new TcpTaskReportCoordinator()
