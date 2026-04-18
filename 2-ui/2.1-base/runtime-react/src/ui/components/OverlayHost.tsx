import React, {useEffect} from 'react'
import {View} from 'react-native'
import {useUiOverlays} from '../../hooks'
import {resolveUiRenderer} from '../../foundations/rendererRegistry'
import type {RuntimeReactAutomationBridge} from '../../types'

export interface OverlayHostProps {
    displayMode?: string
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    automationTarget?: 'primary' | 'secondary'
}

export const OverlayHost: React.FC<OverlayHostProps> = ({
    displayMode,
    automationBridge,
    automationRuntimeId = 'runtime',
    automationTarget = 'primary',
}) => {
    const overlays = useUiOverlays(displayMode)

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const unregisterHost = automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'overlay',
            mountId: `overlay-host:${automationTarget}`,
            nodeId: `overlay-host:${automationTarget}`,
            testID: 'ui-base-overlay-host',
            semanticId: `overlay-host:${automationTarget}`,
            role: 'overlay-host',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: [],
        })
        const unregisterOverlays = overlays.map(overlay => automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'overlay',
            mountId: `overlay:${overlay.id}`,
            nodeId: `overlay:${overlay.id}`,
            testID: `ui-base-overlay:${overlay.id}`,
            semanticId: overlay.screenPartKey ?? overlay.rendererKey,
            role: 'overlay',
            text: String(overlay.rendererKey ?? overlay.screenPartKey ?? overlay.id),
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: ['press'],
        }))
        return () => {
            unregisterHost()
            unregisterOverlays.forEach(unregister => unregister())
        }
    }, [automationBridge, automationRuntimeId, automationTarget, overlays])

    return (
        <View testID="ui-base-overlay-host">
            {overlays.map(overlay => {
                const Component = resolveUiRenderer(overlay.rendererKey)
                if (!Component) {
                    return null
                }
                return <Component key={overlay.id} {...(overlay.props as object)} />
            })}
        </View>
    )
}
