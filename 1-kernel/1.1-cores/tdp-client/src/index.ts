import {AppModule, kernelCoreBaseModule} from '@impos2/kernel-core-base'
import {kernelCoreCommunicationModule} from '@impos2/kernel-core-communication'
import {kernelCoreTcpClientModule} from '@impos2/kernel-core-tcp-client'
import {moduleName} from './moduleName'
import {kernelCoreTdpClientSlice} from './features/slices'
import {kernelCoreTdpClientActors} from './features/actors'
import {kernelCoreTdpClientCommands} from './features/commands'
import {kernelCoreTdpClientModulePreSetup} from './application/modulePreSetup'
import {kernelCoreTdpClientErrorMessages} from './supports/errors'
import {kernelCoreTdpClientParameters} from './supports/parameters'
import {kernelCoreTdpClientEpics} from './features/epics'
import {kernelCoreTdpClientMiddlewares} from './features/middlewares'
import {packageVersion} from './generated/packageVersion'

export const kernelCoreTdpClientModule: AppModule = {
  name: moduleName,
  version: packageVersion,
  slices: kernelCoreTdpClientSlice,
  middlewares: kernelCoreTdpClientMiddlewares,
  epics: kernelCoreTdpClientEpics,
  commands: kernelCoreTdpClientCommands,
  actors: kernelCoreTdpClientActors,
  errorMessages: kernelCoreTdpClientErrorMessages,
  parameters: kernelCoreTdpClientParameters,
  dependencies: [kernelCoreBaseModule, kernelCoreCommunicationModule, kernelCoreTcpClientModule],
  modulePreSetup: kernelCoreTdpClientModulePreSetup,
}

export * from './types'
export * from './foundations'
export * from './supports'
export * from './hooks'
export * from './selectors'
export * from './application'
export {kernelCoreTdpClientSlice} from './features/slices'
export {kernelCoreTdpClientCommands} from './features/commands'
export {kernelCoreTdpClientErrorMessages} from './supports/errors'
export {kernelCoreTdpClientParameters} from './supports/parameters'
