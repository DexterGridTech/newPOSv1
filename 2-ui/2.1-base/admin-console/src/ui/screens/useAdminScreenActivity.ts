import {useEffect, useRef} from 'react'
import {
    useUiRuntimeScreenActive,
    useUiRuntimeScreenActiveVersion,
    useUiRuntimeScreenGatedStoreSubscription,
} from '@next/ui-base-runtime-react'

export const shallowEqualAdminSnapshot = <TSnapshot,>(
    left: TSnapshot | undefined,
    right: TSnapshot,
): boolean => {
    if (Object.is(left, right)) {
        return true
    }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
        return false
    }
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord)
    const rightKeys = Object.keys(rightRecord)
    if (leftKeys.length !== rightKeys.length) {
        return false
    }
    return leftKeys.every(key =>
        Object.prototype.hasOwnProperty.call(rightRecord, key)
        && Object.is(leftRecord[key], rightRecord[key]),
    )
}

export const useAdminStoreSnapshot = <TSnapshot,>(
    subscribe: (listener: () => void) => () => void,
    readSnapshot: () => TSnapshot,
    isEqual?: (left: TSnapshot | undefined, right: TSnapshot) => boolean,
): TSnapshot =>
    useUiRuntimeScreenGatedStoreSubscription(subscribe, readSnapshot, isEqual)

export const useAdminScreenActiveVersion = (): number =>
    useUiRuntimeScreenActiveVersion()

export const useAdminRefreshWhileScreenActive = (
    refresh: () => void,
    dependencyKey = 'default',
): void => {
    const active = useUiRuntimeScreenActive()
    const activeVersion = useUiRuntimeScreenActiveVersion()
    const lastRefreshKeyRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        const refreshKey = `${activeVersion}:${dependencyKey}`
        if (!active || lastRefreshKeyRef.current === refreshKey) {
            return
        }
        lastRefreshKeyRef.current = refreshKey
        refresh()
    }, [active, activeVersion, dependencyKey, refresh])
}

export const useAdminMountedRef = () => {
    const mountedRef = useRef(true)

    useEffect(() => () => {
        mountedRef.current = false
    }, [])

    return mountedRef
}
