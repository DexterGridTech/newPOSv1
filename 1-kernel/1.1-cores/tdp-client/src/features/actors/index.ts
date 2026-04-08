import {createActors} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {InitializeActor} from './initialize'
import {BootstrapActor} from './bootstrap'
import {SessionActor} from './session'
import {MessageActor} from './message'
import {SyncActor} from './sync'

export const kernelCoreTdpClientActors = createActors(moduleName, {
  initializeActor: InitializeActor,
  bootstrapActor: BootstrapActor,
  sessionActor: SessionActor,
  messageActor: MessageActor,
  syncActor: SyncActor,
})
