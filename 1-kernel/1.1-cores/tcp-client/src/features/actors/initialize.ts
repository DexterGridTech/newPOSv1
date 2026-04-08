import {Actor, device, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTcpClientCommands} from '../commands'
import {tcpIdentityActions} from '../slices'

export class InitializeActor extends Actor {
  initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize, async () => {
    logger.log([moduleName, LOG_TAGS.Actor, 'InitializeActor'], 'Initializing kernel TCP client...')
    const deviceInfo = await device.getDeviceInfo()
    storeEntry.dispatchAction(tcpIdentityActions.setDeviceInfo(deviceInfo))
    storeEntry.dispatchAction(tcpIdentityActions.setDeviceFingerprint(deviceInfo.id))
    kernelCoreTcpClientCommands.bootstrapTcpClient().executeInternally()
    return {}
  })
}
