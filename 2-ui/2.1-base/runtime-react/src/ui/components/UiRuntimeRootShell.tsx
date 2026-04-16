import React from 'react'
import {View} from 'react-native'
import {uiRuntimeRootVariables} from '../../foundations/uiVariables'
import {AlertHost} from './AlertHost'
import {OverlayHost} from './OverlayHost'
import {ScreenContainer} from './ScreenContainer'

export interface UiRuntimeRootShellProps {
    display?: 'primary' | 'secondary'
    children?: React.ReactNode
}

export const UiRuntimeRootShell: React.FC<UiRuntimeRootShellProps> = ({
    display = 'primary',
    children,
}) => {
    const container = display === 'secondary'
        ? uiRuntimeRootVariables.secondaryRootContainer
        : uiRuntimeRootVariables.primaryRootContainer

    return (
        <View testID={`ui-base-root-shell:${display}`}>
            {children}
            <ScreenContainer containerPart={container} />
            <OverlayHost displayMode={display === 'secondary' ? 'SECONDARY' : 'PRIMARY'} />
            <AlertHost displayMode={display === 'secondary' ? 'SECONDARY' : 'PRIMARY'} />
        </View>
    )
}
