import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {
    UiOverlayEntry,
    UiRuntimeCreateOverlayInput,
    UiRuntimeCreateScreenInput,
    UiScreenRuntimeEntry,
} from '../types'

export const createUiScreenRuntimeEntry = <TProps = unknown>(
    input: UiRuntimeCreateScreenInput<TProps> & {
        source?: string
        operation: 'show' | 'replace'
    },
): UiScreenRuntimeEntry<TProps> => {
    const {definition, id, props, source, operation} = input
    if (!definition.containerKey) {
        throw new Error(`[ui-runtime-v2] screen definition ${definition.partKey} missing containerKey`)
    }

    return {
        partKey: definition.partKey,
        rendererKey: definition.rendererKey,
        name: definition.name,
        title: definition.title,
        description: definition.description,
        containerKey: definition.containerKey,
        id,
        props,
        source,
        operation,
    }
}

export const createUiOverlayEntry = <TProps = unknown>(
    input: UiRuntimeCreateOverlayInput<TProps>,
): UiOverlayEntry<TProps> => ({
    id: input.id,
    screenPartKey: input.definition.partKey,
    rendererKey: input.definition.rendererKey,
    props: input.props,
    openedAt: nowTimestampMs(),
})
