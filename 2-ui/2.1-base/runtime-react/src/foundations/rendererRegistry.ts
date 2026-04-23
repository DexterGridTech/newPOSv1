import type {ComponentType} from 'react'
import type {UiScreenDefinition} from '@impos2/kernel-base-ui-runtime-v2'
import type {UiScreenPartDefinition} from '../types'

export interface UiRendererRegistryEntry {
    rendererKey: string
    component: ComponentType<unknown>
}

export interface UiRendererRegistry {
    registerPart<TProps = unknown>(part: UiScreenPartDefinition<TProps>): UiScreenDefinition<TProps>
    registerParts(parts: readonly UiScreenPartDefinition<any>[]): UiScreenDefinition[]
    resolve<TProps = unknown>(rendererKey: string): ComponentType<TProps> | null
    list(): readonly UiRendererRegistryEntry[]
    clear(): void
}

export const createRendererRegistry = (): UiRendererRegistry => {
    const renderers = new Map<string, ComponentType<unknown>>()

    return {
        registerPart(part) {
            renderers.set(part.definition.rendererKey, part.component as ComponentType<unknown>)
            return part.definition
        },
        registerParts(parts) {
            return parts.map(part => this.registerPart(part))
        },
        resolve(rendererKey) {
            return (renderers.get(rendererKey) as ComponentType<any> | undefined) ?? null
        },
        list() {
            return [...renderers.entries()].map(([rendererKey, component]) => ({
                rendererKey,
                component,
            }))
        },
        clear() {
            renderers.clear()
        },
    }
}

const sharedRendererRegistry = createRendererRegistry()

export const getSharedRendererRegistry = () => sharedRendererRegistry

export const registerUiRendererParts = (
    parts: readonly UiScreenPartDefinition<any>[],
) => sharedRendererRegistry.registerParts(parts)

export const resolveUiRenderer = <TProps = unknown>(
    rendererKey: string,
) => sharedRendererRegistry.resolve<TProps>(rendererKey)

export const clearUiRendererRegistry = () => {
    sharedRendererRegistry.clear()
}
