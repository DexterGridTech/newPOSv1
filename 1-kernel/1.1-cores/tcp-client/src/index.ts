import {AppModule, kernelCoreBaseModule} from '@impos2/kernel-core-base'
import {kernelCoreCommunicationModule} from '@impos2/kernel-core-communication'
import {moduleName} from './moduleName'
import {kernelCoreTcpClientSlice} from './features/slices'
import {kernelCoreTcpClientActors} from './features/actors'
import {kernelCoreTcpClientCommands} from './features/commands'
import {kernelCoreTcpClientModulePreSetup} from './application/modulePreSetup'
import {kernelCoreTcpClientErrorMessages} from './supports/errors'
import {kernelCoreTcpClientParameters} from './supports/parameters'
import {kernelCoreTcpClientEpics} from './features/epics'
import {kernelCoreTcpClientMiddlewares} from './features/middlewares'
import {packageVersion} from './generated/packageVersion'

export const kernelCoreTcpClientModule: AppModule = {
  name: moduleName,
  version: packageVersion,
  slices: kernelCoreTcpClientSlice,
  middlewares: kernelCoreTcpClientMiddlewares,
  epics: kernelCoreTcpClientEpics,
  commands: kernelCoreTcpClientCommands,
  actors: kernelCoreTcpClientActors,
  errorMessages: kernelCoreTcpClientErrorMessages,
  parameters: kernelCoreTcpClientParameters,
  dependencies: [kernelCoreBaseModule, kernelCoreCommunicationModule],
  modulePreSetup: kernelCoreTcpClientModulePreSetup,
}

export * from './types'
export * from './foundations'
export * from './supports'
export * from './hooks'
export * from './selectors'
export * from './application'
export {kernelCoreTcpClientSlice} from './features/slices'
export {kernelCoreTcpClientCommands} from './features/commands'
export {kernelCoreTcpClientErrorMessages} from './supports/errors'
export {kernelCoreTcpClientParameters} from './supports/parameters'
export {kernelCoreTcpClientApis} from './supports'
