import type {UiRuntimeScreenRegistry, UiScreenDefinition, UiScreenRegistryContext} from '../types'

/**
 * 设计意图：
 * screen registry 是 UI 基础包里少数允许保留可变注册状态的地方，用来承接屏幕定义的动态组合。
 * 这里故意只做定义查询和上下文过滤，不承担导航跳转、副作用或渲染逻辑。
 */
const createDefinitionKey = (definition: UiScreenDefinition) => definition.partKey

const matchesContext = (
    definition: UiScreenDefinition,
    context: UiScreenRegistryContext,
) => definition.screenModes.includes(context.screenMode)
    && definition.workspaces.includes(context.workspace)
    && definition.instanceModes.includes(context.instanceMode)

export const createUiScreenRegistry = (): UiRuntimeScreenRegistry => {
    const definitions = new Map<string, UiScreenDefinition>()
    const registerDefinition = (definition: UiScreenDefinition) => {
        const key = createDefinitionKey(definition)
        definitions.set(key, definition)
        return definition
    }

    return {
        register(definition) {
            return registerDefinition(definition)
        },
        registerMany(input) {
            input.forEach(definition => {
                registerDefinition(definition)
            })
            return input
        },
        get(partKey) {
            return definitions.get(partKey)
        },
        getRendererKey(partKey) {
            return definitions.get(partKey)?.rendererKey
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
