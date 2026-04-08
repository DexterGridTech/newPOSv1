import {Actor, AppError, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTcpClientCommands} from '../commands'
import {tcpActivationCoordinator} from '../../foundations'
import {tcpBindingActions, tcpCredentialActions, tcpIdentityActions, tcpRuntimeActions} from '../slices'
import {kernelCoreTcpClientErrorMessages} from '../../supports'

export class IdentityActor extends Actor {
  activateTerminal = Actor.defineCommandHandler(kernelCoreTcpClientCommands.activateTerminal, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'IdentityActor'], 'Activating terminal...', command.payload)

    // tcp-client 把设备信息视为 initialize 阶段就应该准备好的本地前置条件。
    const identityState = storeEntry.getState()
    const deviceInfo = (identityState as any)[`${moduleName}.tcpIdentity`]?.deviceInfo?.value
    const deviceFingerprint =
      (identityState as any)[`${moduleName}.tcpIdentity`]?.deviceFingerprint?.value ??
      deviceInfo?.id

    if (!deviceInfo || !deviceFingerprint) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpBootstrapHydrationFailed, {
        error: 'device info is missing',
      }, command)
    }

    storeEntry.dispatchAction(tcpIdentityActions.setActivationStatus('ACTIVATING'))
    storeEntry.dispatchAction(tcpRuntimeActions.setLastActivationRequestId(command.id))

    // 调用控制面激活接口，拿到 terminalId 与 credential。
    const result = await tcpActivationCoordinator.activate({
      activationCode: command.payload.activationCode,
      deviceFingerprint,
      deviceInfo,
    })

    const expiresAt = Date.now() + result.expiresIn * 1000
    const refreshExpiresAt = result.refreshExpiresIn
      ? Date.now() + result.refreshExpiresIn * 1000
      : undefined

    // identity / credential / binding 三块状态分别落在独立 slice，避免相互耦合。
    storeEntry.dispatchAction(
      tcpIdentityActions.setActivatedIdentity({
        terminalId: result.terminalId,
        activatedAt: Date.now(),
      }),
    )
    storeEntry.dispatchAction(
      tcpCredentialActions.setCredential({
        accessToken: result.token,
        refreshToken: result.refreshToken,
        expiresAt,
        refreshExpiresAt,
      }),
    )
    storeEntry.dispatchAction(tcpBindingActions.setBinding(result.binding ?? {}))
    storeEntry.dispatchAction(tcpRuntimeActions.setLastError(null))

    kernelCoreTcpClientCommands.activateTerminalSucceeded({
      terminalId: result.terminalId,
      accessToken: result.token,
      refreshToken: result.refreshToken,
      expiresAt,
      refreshExpiresAt,
      binding: result.binding ?? {},
      deviceFingerprint,
      deviceInfo,
    }).executeFromParent(command)

    return {
      terminalId: result.terminalId,
    }
  })

  resetTcpClient = Actor.defineCommandHandler(kernelCoreTcpClientCommands.resetTcpClient, async () => {
    storeEntry.dispatchAction(tcpIdentityActions.resetIdentity())
    storeEntry.dispatchAction(tcpCredentialActions.resetCredential())
    storeEntry.dispatchAction(tcpBindingActions.resetBinding())
    return {}
  })
}
