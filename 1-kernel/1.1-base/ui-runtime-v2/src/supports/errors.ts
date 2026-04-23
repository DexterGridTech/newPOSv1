import {createModuleErrorFactory, listDefinitions} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const uiRuntimeV2ErrorDefinitions = {
    invalidScreenTarget: defineError('invalid_screen_target', {
        name: 'Invalid UI Runtime Screen Target',
        defaultTemplate: 'UI runtime screen target is invalid',
        category: 'VALIDATION',
        severity: 'MEDIUM',
    }),
    duplicatedScreenDefinition: defineError('duplicated_screen_definition', {
        name: 'Duplicated UI Runtime Screen Definition',
        defaultTemplate: 'Screen definition ${partKey} is already registered',
        category: 'VALIDATION',
        severity: 'MEDIUM',
    }),
    overlayIdRequired: defineError('overlay_id_required', {
        name: 'UI Runtime Overlay Id Required',
        defaultTemplate: 'Overlay id is required',
        category: 'VALIDATION',
        severity: 'MEDIUM',
    }),
} as const

export const uiRuntimeV2ErrorDefinitionList = listDefinitions(uiRuntimeV2ErrorDefinitions)
