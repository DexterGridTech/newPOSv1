import {defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {UiScreenDefinition} from '../../types'

export const uiRuntimeV2CommandDefinitions = {
    registerScreenDefinitions: defineCommand<{
        definitions: readonly UiScreenDefinition[]
    }>({
        moduleName,
        commandName: 'register-screen-definitions',
    }),
    showScreen: defineCommand<{
        definition: UiScreenDefinition
        id?: string | null
        props?: unknown
        source?: string
    }>({
        moduleName,
        commandName: 'show-screen',
    }),
    replaceScreen: defineCommand<{
        definition: UiScreenDefinition
        id?: string | null
        props?: unknown
        source?: string
    }>({
        moduleName,
        commandName: 'replace-screen',
    }),
    resetScreen: defineCommand<{
        containerKey: string
    }>({
        moduleName,
        commandName: 'reset-screen',
    }),
    openOverlay: defineCommand<{
        definition: UiScreenDefinition
        id: string
        props?: unknown
    }>({
        moduleName,
        commandName: 'open-overlay',
    }),
    closeOverlay: defineCommand<{
        overlayId: string
    }>({
        moduleName,
        commandName: 'close-overlay',
    }),
    clearOverlays: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'clear-overlays',
    }),
    setUiVariables: defineCommand<Record<string, unknown>>({
        moduleName,
        commandName: 'set-ui-variables',
    }),
    clearUiVariables: defineCommand<readonly string[]>({
        moduleName,
        commandName: 'clear-ui-variables',
    }),
} as const
