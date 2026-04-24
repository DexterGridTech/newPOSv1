import {nowTimestampMs} from '@next/kernel-base-contracts'
import type {
    UiAlertInfo,
    UiOverlayEntry,
    UiRuntimeCreateOverlayInput,
    UiRuntimeCreateScreenInput,
    UiScreenDefinition,
    UiScreenRuntimeEntry,
} from '../types'

export const createUiScreenRuntimeEntry = <TProps = unknown>(
    input: UiRuntimeCreateScreenInput<TProps> & {
        source?: string
        operation: 'show' | 'replace'
    },
): UiScreenRuntimeEntry<TProps> => {
    /**
     * 设计意图：
     * ui-runtime-v2 只保存“要渲染什么 part、用哪个 renderer、放到哪个 container”的运行时协议。
     * 它不依赖 React，也不创建真实组件；具体渲染交给 2-ui 或宿主适配层。
     */
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

export const createUiOverlayScreen = <TProps = unknown>(
    definition: UiScreenDefinition<TProps>,
    id: string,
    props?: TProps,
): UiOverlayEntry<TProps> => createUiOverlayEntry({
    definition,
    id,
    props,
})

export const createUiModalScreen = createUiOverlayScreen

export const defaultUiAlertPartKey = 'alert'

export const createUiAlertDefinition = (
    input: {
        partKey?: string
        rendererKey?: string
        containerKey?: string
    } = {},
): UiScreenDefinition<UiAlertInfo> => ({
    partKey: input.partKey ?? defaultUiAlertPartKey,
    rendererKey: input.rendererKey ?? 'ui.alert.default',
    name: 'Alert',
    title: 'Alert',
    description: 'Alert',
    containerKey: input.containerKey,
    screenModes: ['DESKTOP', 'MOBILE'],
    workspaces: ['main', 'branch'],
    instanceModes: ['MASTER', 'SLAVE'],
})

export const createUiAlertScreen = (
    id: string,
    props: UiAlertInfo,
    definition = createUiAlertDefinition(),
): UiOverlayEntry<UiAlertInfo> => createUiOverlayEntry({
    definition,
    id,
    props,
})
