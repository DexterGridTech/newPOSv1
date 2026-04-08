import {createActors} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {InitializeActor} from './initialize'
import {BootstrapActor} from './bootstrap'
import {IdentityActor} from './identity'
import {CredentialActor} from './credential'
import {TaskReportActor} from './taskReport'

export const kernelCoreTcpClientActors = createActors(moduleName, {
  initializeActor: InitializeActor,
  bootstrapActor: BootstrapActor,
  identityActor: IdentityActor,
  credentialActor: CredentialActor,
  taskReportActor: TaskReportActor,
})
