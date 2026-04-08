import {AppError} from '@impos2/kernel-core-base'
import {tcpHttpService} from '../services/TcpHttpService'
import {kernelCoreTcpClientErrorMessages} from '../../supports'
import type {
  DeviceInfo,
} from '@impos2/kernel-core-base'
import type {
  TcpActivationRequest,
  TcpActivationResponse,
} from '../../types'

export interface TcpActivationCoordinatorInput {
  activationCode: string
  deviceFingerprint: string
  deviceInfo: DeviceInfo
}

export class TcpActivationCoordinator {
  async activate(input: TcpActivationCoordinatorInput): Promise<TcpActivationResponse> {
    const request: TcpActivationRequest = {
      activationCode: input.activationCode,
      deviceFingerprint: input.deviceFingerprint,
      deviceInfo: input.deviceInfo as unknown as Record<string, unknown>,
    }

    try {
      return await tcpHttpService.activateTerminal(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown activation error'
      if (message.includes('激活码')) {
        throw new AppError(kernelCoreTcpClientErrorMessages.tcpActivationCodeInvalid)
      }
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpActivationFailed, {error: message})
    }
  }
}

export const tcpActivationCoordinator = new TcpActivationCoordinator()
