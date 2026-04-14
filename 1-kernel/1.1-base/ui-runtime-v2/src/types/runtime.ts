import type {UiScreenDefinition, UiScreenRegistryContext} from './screen'

export interface UiRuntimeCreateOverlayInput<TProps = unknown> {
    definition: UiScreenDefinition<TProps>
    id: string
    props?: TProps
}

export interface UiRuntimeCreateScreenInput<TProps = unknown> {
    definition: UiScreenDefinition<TProps>
    id?: string | null
    props?: TProps
}

export interface UiRuntimeScreenRegistry {
    register(definition: UiScreenDefinition): UiScreenDefinition
    registerMany(definitions: readonly UiScreenDefinition[]): readonly UiScreenDefinition[]
    get(partKey: string): UiScreenDefinition | undefined
    list(): readonly UiScreenDefinition[]
    listByContainer(containerKey: string, context: UiScreenRegistryContext): readonly UiScreenDefinition[]
    findFirstReady(containerKey: string, fromIndex: number, context: UiScreenRegistryContext): UiScreenDefinition | undefined
}
