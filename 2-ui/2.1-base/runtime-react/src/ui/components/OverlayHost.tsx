import React from 'react'
import {View} from 'react-native'
import {useUiOverlays} from '../../hooks'
import {resolveUiRenderer} from '../../foundations/rendererRegistry'

export interface OverlayHostProps {
    displayMode?: string
}

export const OverlayHost: React.FC<OverlayHostProps> = ({displayMode}) => {
    const overlays = useUiOverlays(displayMode)

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
