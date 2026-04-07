import {AppModule, kernelCoreBaseModule} from '@impos2/kernel-core-base'
import {moduleName} from './moduleName'
import {kernelCoreCommunicationSlice} from './features/slices'
import {kernelCoreCommunicationActors} from './features/actors'
import {kernelCoreCommunicationCommands} from './features/commands'
import {kernelCoreCommunicationModulePreSetup} from './application/modulePreSetup'
import {kernelCoreCommunicationErrorMessages} from './supports/errors'
import {kernelCoreCommunicationParameters} from './supports/parameters'
import {kernelCoreCommunicationEpics} from './features/epics'
import {kernelCoreCommunicationMiddlewares} from './features/middlewares'
import {packageVersion} from './generated/packageVersion';

export const kernelCoreCommunicationModule: AppModule = {
  name: moduleName,
  version: packageVersion,
  slices: kernelCoreCommunicationSlice,
  middlewares: kernelCoreCommunicationMiddlewares,
  epics: kernelCoreCommunicationEpics,
  commands: kernelCoreCommunicationCommands,
  actors: kernelCoreCommunicationActors,
  errorMessages: kernelCoreCommunicationErrorMessages,
  parameters: kernelCoreCommunicationParameters,
  dependencies: [kernelCoreBaseModule],
  modulePreSetup: kernelCoreCommunicationModulePreSetup,
}

export * from './types'
export * from './foundations'
export * from './supports'
export * from './hooks'
export * from './selectors'
export * from './application'
export {kernelCoreCommunicationApis} from './supports'
