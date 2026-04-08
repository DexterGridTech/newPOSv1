import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTdpClientCommands} from '../commands'
import {tdpControlSignalsActions} from '../slices'

export class InitializeActor extends Actor {
  initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize, async () => {
    logger.log([moduleName, LOG_TAGS.Actor, 'InitializeActor'], 'Initializing kernel TDP client...')
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastProtocolError(null))
    kernelCoreTdpClientCommands.bootstrapTdpClient().executeInternally()
    return {}
  })
}
