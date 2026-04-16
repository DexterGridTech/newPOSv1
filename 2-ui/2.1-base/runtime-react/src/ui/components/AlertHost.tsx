import React from 'react'
import {View} from 'react-native'
import {useUiOverlays} from '../../hooks'
import {defaultUiAlertContainerKey} from '../../foundations/defineUiAlertPart'
import {resolveUiRenderer} from '../../foundations/rendererRegistry'

export interface AlertHostProps {
    displayMode?: string
}

export const AlertHost: React.FC<AlertHostProps> = ({displayMode}) => {
    const overlays = useUiOverlays(displayMode)
    const alerts = overlays.filter(overlay => overlay.screenPartKey === 'ui.base.default-alert'
        || overlay.rendererKey === 'ui.base.default-alert'
        || overlay.id.startsWith(defaultUiAlertContainerKey))

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
