import {useCallback, useMemo, useRef} from 'react'
import {Platform} from 'react-native'
import {createAdminLauncherTracker} from '../supports/adminLauncherTracker'
import type {AdminLauncherOptions} from '../types'

type AdminLauncherPressEvent = {
    nativeEvent?: {
        pageX?: number
        pageY?: number
        clientX?: number
        clientY?: number
        touches?: ArrayLike<{pageX?: number; pageY?: number; clientX?: number; clientY?: number}>
        changedTouches?: ArrayLike<{pageX?: number; pageY?: number; clientX?: number; clientY?: number}>
    }
    pageX?: number
    pageY?: number
    clientX?: number
    clientY?: number
}

type AdminLauncherPointCarrier = {
    pageX?: number
    pageY?: number
    clientX?: number
    clientY?: number
    touches?: ArrayLike<{pageX?: number; pageY?: number; clientX?: number; clientY?: number}>
    changedTouches?: ArrayLike<{pageX?: number; pageY?: number; clientX?: number; clientY?: number}>
}

const firstTouch = (
    touches?: ArrayLike<{pageX?: number; pageY?: number; clientX?: number; clientY?: number}>,
) => touches && touches.length > 0 ? touches[0] : undefined

const resolveLauncherPoint = (event: AdminLauncherPressEvent): {pageX: number; pageY: number} => {
    const nativeEvent = (event.nativeEvent ?? event) as AdminLauncherPointCarrier
    const touch = firstTouch(nativeEvent.changedTouches) ?? firstTouch(nativeEvent.touches)
    const pageX = touch?.pageX ?? nativeEvent.pageX ?? touch?.clientX ?? nativeEvent.clientX ?? 0
    const pageY = touch?.pageY ?? nativeEvent.pageY ?? touch?.clientY ?? nativeEvent.clientY ?? 0

    return {pageX, pageY}
}

export const useAdminLauncher = (
    input: AdminLauncherOptions,
) => {
    const trackerRef = useRef(createAdminLauncherTracker(input))

    const handlePress = useCallback((event: AdminLauncherPressEvent) => {
        if (!input.enabled) {
            return
        }

        const {pageX, pageY} = resolveLauncherPoint(event)
        if (trackerRef.current.recordPress({pageX, pageY})) {
            input.onTriggered()
        }
    }, [input])

    return useMemo(() => {
        if (Platform.OS === 'web') {
            return {onClick: handlePress}
        }
        return {onTouchEnd: handlePress}
    }, [handlePress])
}
