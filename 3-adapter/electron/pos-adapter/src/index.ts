import { moduleName } from './moduleName'
import { adapterElectronSlice } from './features/slices'
import { adapterElectronActors } from './features/actors'
import { adapterElectronCommands } from './features/commands'
import { adapterElectronModulePreSetup } from './application/modulePreSetup'
import { adapterElectronErrorMessages } from './supports/errors'
import { adapterElectronParameters } from './supports/parameters'
import { adapterElectronEpics } from './features/epics'
import { adapterElectronMiddlewares } from './features/middlewares'
import { AppModule } from '@impos2/kernel-core-base'
import { uiCoreBaseModule } from '@impos2/ui-core-base'

export const adapterElectronModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: adapterElectronSlice,
    middlewares: adapterElectronMiddlewares,
    epics: adapterElectronEpics,
    commands: adapterElectronCommands,
    actors: adapterElectronActors,
    errorMessages: adapterElectronErrorMessages,
    parameters: adapterElectronParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: adapterElectronModulePreSetup,
    preSetupPriority: 3002, // adapter 模块使用 3001-3999
}

export * from './types'
export * from './foundations'
export * from './supports'
export * from './hooks'
export { adapterElectronSlice } from './features/slices'
export { adapterElectronCommands } from './features/commands'
export { adapterElectronErrorMessages } from './supports/errors'
export { adapterElectronParameters } from './supports/parameters'
export { adapterElectronApis } from './supports'
