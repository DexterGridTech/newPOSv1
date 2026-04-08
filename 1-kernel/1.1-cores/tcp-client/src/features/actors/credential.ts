import {Actor, AppError, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTcpClientCommands} from '../commands'
import {tcpCredentialCoordinator, tcpCredentialRepository} from '../../foundations'
import {tcpCredentialActions, tcpRuntimeActions} from '../slices'
import {kernelCoreTcpClientErrorMessages} from '../../supports'

export class CredentialActor extends Actor {
  refreshCredential = Actor.defineCommandHandler(kernelCoreTcpClientCommands.refreshCredential, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'CredentialActor'], 'Refreshing terminal credential...')
    const snapshot = tcpCredentialRepository.readCredential()
    if (!snapshot.refreshToken) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpCredentialMissing, undefined, command)
    }

    storeEntry.dispatchAction(tcpCredentialActions.setCredentialStatus('REFRESHING'))
    storeEntry.dispatchAction(tcpRuntimeActions.setLastRefreshRequestId(command.id))

    const result = await tcpCredentialCoordinator.refresh(snapshot.refreshToken)
    const expiresAt = Date.now() + result.expiresIn * 1000

    storeEntry.dispatchAction(
      tcpCredentialActions.setCredential({
        accessToken: result.token,
        refreshToken: snapshot.refreshToken,
        expiresAt,
        refreshExpiresAt: snapshot.refreshExpiresAt,
      }),
    )
    storeEntry.dispatchAction(tcpRuntimeActions.setLastError(null))

    kernelCoreTcpClientCommands.credentialRefreshed({
      accessToken: result.token,
      expiresAt,
    }).executeFromParent(command)

    return {
      accessToken: result.token,
    }
  })
}
