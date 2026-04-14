import type {UiRuntimeScreenRegistry, UiScreenDefinition, UiScreenRegistryContext} from '../types'

const createDefinitionKey = (definition: UiScreenDefinition) => definition.partKey

const matchesContext = (
    definition: UiScreenDefinition,
    context: UiScreenRegistryContext,
) => definition.screenModes.includes(context.screenMode)
    && definition.workspaces.includes(context.workspace)
    && definition.instanceModes.includes(context.instanceMode)

export const createUiScreenRegistry = (): UiRuntimeScreenRegistry => {
    const definitions = new Map<string, UiScreenDefinition>()

    return {
        register(definition) {
            const key = createDefinitionKey(definition)
            definitions.set(key, definition)
            return definition
        },
        registerMany(input) {
            input.forEach(definition => {
                this.register(definition)
            })
            return input
        },
        get(partKey) {
            return definitions.get(partKey)
        },
        list() {
            return [...definitions.values()]
        },
        listByContainer(containerKey, context) {
            return [...definitions.values()]
                .filter(definition =>
                    definition.containerKey === containerKey
                    && matchesContext(definition, context),
                )
                .sort((left, right) => (left.indexInContainer ?? 0) - (right.indexInContainer ?? 0))
        },
        findFirstReady(containerKey, fromIndex, context) {
            return this.listByContainer(containerKey, context)
                .find(definition =>
                    (definition.indexInContainer ?? -1) > fromIndex
                    && (definition.readyToEnter?.() ?? true),
                )
        },
    }
}
