import {AppError} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientErrorMessages} from '../../supports'
import type {TdpClientMessage} from '../../types'

export class TdpHandshakeCoordinator {
  createHandshake(input: {
    terminalId?: string
    appVersion: string
    lastCursor?: number
    protocolVersion?: string
  }): TdpClientMessage {
    if (!input.terminalId) {
      throw new AppError(kernelCoreTdpClientErrorMessages.tdpCredentialMissing)
    }

    return {
      type: 'HANDSHAKE',
      data: {
        terminalId: input.terminalId,
        appVersion: input.appVersion,
        lastCursor: input.lastCursor,
        protocolVersion: input.protocolVersion ?? '1.0',
      },
    }
  }
}

export const tdpHandshakeCoordinator = new TdpHandshakeCoordinator()
