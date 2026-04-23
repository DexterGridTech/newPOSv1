import React, {useEffect} from 'react'
import {View} from 'react-native'
import {useUiOverlays} from '../../hooks'
import {defaultUiAlertContainerKey} from '../../foundations/defineUiAlertPart'
import {resolveUiRenderer} from '../../foundations/rendererRegistry'
import type {RuntimeReactAutomationBridge} from '../../types'

export interface AlertHostProps {
    displayMode?: string
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    automationTarget?: 'primary' | 'secondary'
}

export const AlertHost: React.FC<AlertHostProps> = ({
    displayMode,
    automationBridge,
    automationRuntimeId = 'runtime',
    automationTarget = 'primary',
}) => {
    const overlays = useUiOverlays(displayMode)
    const alerts = overlays.filter(overlay => overlay.screenPartKey === 'ui.base.default-alert'
        || overlay.rendererKey === 'ui.base.default-alert'
        || overlay.id.startsWith(defaultUiAlertContainerKey))

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const unregisterHost = automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'alert',
            mountId: `alert-host:${automationTarget}`,
            nodeId: `alert-host:${automationTarget}`,
            testID: 'ui-base-alert-host',
            semanticId: `alert-host:${automationTarget}`,
            role: 'alert-host',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: [],
        })
        const unregisterAlerts = alerts.map(alert => automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'alert',
            mountId: `alert:${alert.id}`,
            nodeId: `alert:${alert.id}`,
            testID: `ui-base-alert:${alert.id}`,
            semanticId: alert.screenPartKey ?? alert.rendererKey,
            role: 'alert',
            text: String(alert.rendererKey ?? alert.screenPartKey ?? alert.id),
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: ['press'],
        }))
        return () => {
            unregisterHost()
            unregisterAlerts.forEach(unregister => unregister())
        }
    }, [alerts, automationBridge, automationRuntimeId, automationTarget])

    return (
        <View testID="ui-base-alert-host">
            {alerts.map(alert => {
                const Component = resolveUiRenderer(alert.rendererKey)
                if (!Component) {
                    return null
                }
                return <Component key={alert.id} {...(alert.props as object)} />
            })}
        </View>
    )
}
