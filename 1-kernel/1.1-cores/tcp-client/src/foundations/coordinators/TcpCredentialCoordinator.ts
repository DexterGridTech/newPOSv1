import {AppError} from '@impos2/kernel-core-base'
import {tcpHttpService} from '../services/TcpHttpService'
import {kernelCoreTcpClientErrorMessages} from '../../supports'
import type {TcpRefreshCredentialResponse} from '../../types'

export class TcpCredentialCoordinator {
  async refresh(refreshToken?: string): Promise<TcpRefreshCredentialResponse> {
    if (!refreshToken) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpCredentialMissing)
    }

    try {
      return await tcpHttpService.refreshCredential({refreshToken})
    } catch (error) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpRefreshFailed, {
        error: error instanceof Error ? error.message : 'unknown refresh error',
      })
    }
  }
}

export const tcpCredentialCoordinator = new TcpCredentialCoordinator()
