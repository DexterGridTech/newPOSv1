import { moduleName } from './moduleName'
import { assemblyElectronDesktopSlice } from './features/slices'
import { assemblyElectronDesktopActors } from './features/actors'
import { assemblyElectronDesktopCommands } from './features/commands'
import { assemblyElectronDesktopModulePreSetup } from './application/modulePreSetup'
import { assemblyElectronDesktopErrorMessages } from './supports/errors'
import { assemblyElectronDesktopParameters } from './supports/parameters'
import { assemblyElectronDesktopEpics } from './features/epics'
import { assemblyElectronDesktopMiddlewares } from './features/middlewares'
import { AppModule } from '@impos2/kernel-core-base'
import { adapterElectronModule } from '@impos2/adapter-electron'
import { uiIntegrationDesktopModule } from '@impos2/ui-integration-desktop'
import { assemblyElectronDesktopScreenParts } from './ui'

export const assemblyElectronDesktopModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: assemblyElectronDesktopSlice,
    middlewares: assemblyElectronDesktopMiddlewares,
    epics: assemblyElectronDesktopEpics,
    commands: assemblyElectronDesktopCommands,
    actors: assemblyElectronDesktopActors,
    errorMessages: assemblyElectronDesktopErrorMessages,
    parameters: assemblyElectronDesktopParameters,
    dependencies: [adapterElectronModule, uiIntegrationDesktopModule],
    modulePreSetup: assemblyElectronDesktopModulePreSetup,
    screenParts: assemblyElectronDesktopScreenParts,
    preSetupPriority: 4002, // assembly 模块使用 4001-4999
}

export * from './types'
export * from './foundations'
export * from './supports'
export * from './hooks'
export { assemblyElectronDesktopSlice } from './features/slices'
export { assemblyElectronDesktopCommands } from './features/commands'
export { assemblyElectronDesktopErrorMessages } from './supports/errors'
export { assemblyElectronDesktopParameters } from './supports/parameters'
export { assemblyElectronDesktopApis } from './supports'
