import {useMemo} from 'react'
import {useSelector} from 'react-redux'
import {
    selectUiCurrentScreenOrFirstReady,
    type UiScreenRuntimeEntry,
} from '@next/kernel-base-ui-runtime-v2'
import type {RootState} from '@next/kernel-base-state-runtime'
import {resolveUiRenderer} from '../foundations/rendererRegistry'
import type {
    ResolvedUiScreenPart,
    UiChildScreenPartResolution,
    UiRuntimeVariable,
} from '../types'

const resolveContainerKey = (input: string | UiRuntimeVariable) =>
    typeof input === 'string' ? input : input.key

export const useChildScreenPart = <TProps = unknown>(
    container: string | UiRuntimeVariable,
): ResolvedUiScreenPart<TProps> | null => {
    const resolution = useChildScreenPartResolution<TProps>(container)
    return resolution.status === 'ready' ? resolution.child : null
}

export const useChildScreenPartResolution = <TProps = unknown>(
    container: string | UiRuntimeVariable,
): UiChildScreenPartResolution<TProps> => {
    const containerKey = resolveContainerKey(container)
    const entry = useSelector<RootState, UiScreenRuntimeEntry<TProps> | null | undefined>((state) =>
        selectUiCurrentScreenOrFirstReady(state, containerKey) as UiScreenRuntimeEntry<TProps> | null | undefined,
    )

    return useMemo(() => {
        if (!entry) {
            return {
                status: 'empty',
                containerKey,
            }
        }
        const Component = resolveUiRenderer<TProps>(entry.rendererKey)
        if (!Component) {
            return {
                status: 'missing-renderer',
                containerKey,
                missing: {
                    partKey: entry.partKey,
                    rendererKey: entry.rendererKey,
                    name: entry.name,
                    title: entry.title,
                    description: entry.description,
                    props: entry.props,
                },
            }
        }
        return {
            status: 'ready',
            containerKey,
            child: {
                partKey: entry.partKey,
                rendererKey: entry.rendererKey,
                Component,
                props: entry.props,
            },
        }
    }, [containerKey, entry])
}
