import { createActors } from '@impos2/kernel-core-base'
import { moduleName } from '../../moduleName'
import { InitializeActor } from './initialize'

export const adapterTauriActors = createActors(moduleName, {
    initializeActor: InitializeActor,
})
