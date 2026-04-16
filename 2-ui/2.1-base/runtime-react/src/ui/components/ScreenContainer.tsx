import React from 'react'
import {EmptyScreen} from './EmptyScreen'
import type {UiRuntimeVariable} from '../../types'
import {useChildScreenPart} from '../../hooks'

export interface ScreenContainerProps {
    containerPart: string | UiRuntimeVariable
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({containerPart}) => {
    const child = useChildScreenPart(containerPart)
    if (!child) {
        return <EmptyScreen />
    }

    const Component = child.Component
    return <Component {...(child.props as object)} />
}
