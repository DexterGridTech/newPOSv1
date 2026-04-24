import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {UiScreenDefinition} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const uiRuntimeV2CommandDefinitions = {
    registerScreenDefinitions: defineModuleCommand<{
        definitions: readonly UiScreenDefinition[]
    }>('register-screen-definitions'),
    showScreen: defineModuleCommand<{
        definition: UiScreenDefinition
        id?: string | null
        props?: unknown
        source?: string
    }>('show-screen'),
    replaceScreen: defineModuleCommand<{
        definition: UiScreenDefinition
        id?: string | null
        props?: unknown
        source?: string
    }>('replace-screen'),
    resetScreen: defineModuleCommand<{
        containerKey: string
    }>('reset-screen'),
    openOverlay: defineModuleCommand<{
        definition: UiScreenDefinition
        id: string
        props?: unknown
    }>('open-overlay'),
    closeOverlay: defineModuleCommand<{
        overlayId: string
    }>('close-overlay'),
    clearOverlays: defineModuleCommand<Record<string, never>>('clear-overlays'),
    setUiVariables: defineModuleCommand<Record<string, unknown>>('set-ui-variables'),
    clearUiVariables: defineModuleCommand<readonly string[]>('clear-ui-variables'),
} as const
