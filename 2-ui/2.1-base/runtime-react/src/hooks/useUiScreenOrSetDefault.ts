import {useEffect, useMemo, useRef} from 'react'
import {useSelector} from 'react-redux'
import {
    selectUiScreen,
    type UiScreenRuntimeEntry,
} from '@next/kernel-base-ui-runtime-v2'
import type {RootState} from '@next/kernel-base-state-runtime'
import {useUiRuntime} from '../contexts'
import {createUiNavigationBridge} from '../supports'
import type {UiRuntimeVariable, UiScreenPartDefinition} from '../types'

const resolveContainerKey = (input: string | UiRuntimeVariable) =>
    typeof input === 'string' ? input : input.key

const stableStringify = (value: unknown): string | null => {
    try {
        return JSON.stringify(value)
    } catch {
        return null
    }
}

const createDefaultRequestKey = <TProps>(
    containerKey: string,
    target: UiScreenPartDefinition<TProps>,
    props: TProps | undefined,
    id: string | null | undefined,
    source: string | undefined,
) => [
    containerKey,
    target.definition.partKey,
    id ?? '',
    source ?? '',
    stableStringify(props) ?? 'unserializable-props',
].join('|')

export interface UseUiScreenOrSetDefaultInput<TProps = unknown> {
    containerPart: string | UiRuntimeVariable
    defaultTarget: UiScreenPartDefinition<TProps>
    defaultProps?: TProps
    defaultId?: string | null
    source?: string
    enabled?: boolean
}

export interface UseUiScreenOrSetDefaultResult<TProps = unknown> {
    containerKey: string
    screen: UiScreenRuntimeEntry<TProps> | null | undefined
    hasScreen: boolean
}

export const useUiScreenOrSetDefault = <TProps = unknown>({
    containerPart,
    defaultTarget,
    defaultProps,
    defaultId,
    source,
    enabled = true,
}: UseUiScreenOrSetDefaultInput<TProps>): UseUiScreenOrSetDefaultResult<TProps> => {
    const runtime = useUiRuntime()
    const containerKey = resolveContainerKey(containerPart)
    const screen = useSelector<RootState, UiScreenRuntimeEntry<TProps> | null | undefined>((state) =>
        selectUiScreen<TProps>(state, containerKey),
    )
    const navigation = useMemo(() => createUiNavigationBridge(runtime), [runtime])
    const dispatchedDefaultRef = useRef<string | null>(null)
    const targetContainerKey = defaultTarget.definition.containerKey
    const defaultRequestKey = createDefaultRequestKey(
        containerKey,
        defaultTarget,
        defaultProps,
        defaultId,
        source,
    )

    useEffect(() => {
        if (!enabled) {
            return
        }
        if (targetContainerKey !== containerKey) {
            return
        }
        if (screen) {
            dispatchedDefaultRef.current = null
            return
        }
        if (dispatchedDefaultRef.current === defaultRequestKey) {
            return
        }
        dispatchedDefaultRef.current = defaultRequestKey
        void navigation.navigateTo({
            target: defaultTarget,
            props: defaultProps,
            id: defaultId,
            source,
        })
    }, [
        defaultId,
        defaultProps,
        defaultRequestKey,
        defaultTarget,
        enabled,
        navigation,
        screen,
        source,
        targetContainerKey,
    ])

    return useMemo(() => ({
        containerKey,
        screen,
        hasScreen: screen != null,
    }), [containerKey, screen])
}
