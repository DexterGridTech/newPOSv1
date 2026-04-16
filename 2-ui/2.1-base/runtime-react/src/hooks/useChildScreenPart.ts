import {useMemo} from 'react'
import {useSelector} from 'react-redux'
import {
    selectUiCurrentScreenOrFirstReady,
    type UiScreenRuntimeEntry,
} from '@impos2/kernel-base-ui-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {resolveUiRenderer} from '../foundations/rendererRegistry'
import type {ResolvedUiScreenPart, UiRuntimeVariable} from '../types'

const resolveContainerKey = (input: string | UiRuntimeVariable) =>
    typeof input === 'string' ? input : input.key

export const useChildScreenPart = <TProps = unknown>(
    container: string | UiRuntimeVariable,
): ResolvedUiScreenPart<TProps> | null => {
    const containerKey = resolveContainerKey(container)
    const entry = useSelector<RootState, UiScreenRuntimeEntry<TProps> | null | undefined>((state) =>
        selectUiCurrentScreenOrFirstReady(state, containerKey) as UiScreenRuntimeEntry<TProps> | null | undefined,
    )

    return useMemo(() => {
        if (!entry) {
            return null
        }
        const Component = resolveUiRenderer<TProps>(entry.rendererKey)
        if (!Component) {
            return null
        }
        return {
            partKey: entry.partKey,
            rendererKey: entry.rendererKey,
            Component,
            props: entry.props,
        }
    }, [entry])
}
