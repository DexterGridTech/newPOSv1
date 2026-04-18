import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
import {EmptyScreen} from './EmptyScreen'
import type {RuntimeReactAutomationBridge, UiRuntimeVariable} from '../../types'
import {useChildScreenPartResolution} from '../../hooks'

export interface ScreenContainerProps {
    containerPart: string | UiRuntimeVariable
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
    automationTarget?: 'primary' | 'secondary'
}

const MissingRendererScreen: React.FC<{
    containerKey: string
    partKey: string
    rendererKey: string
}> = ({containerKey, partKey, rendererKey}) => (
    <View
        testID="ui-base-runtime-react:missing-renderer"
        style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#fff7ed',
        }}
    >
        <View
            style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#fed7aa',
                backgroundColor: '#ffffff',
                padding: 18,
                gap: 8,
            }}
        >
            <Text style={{fontSize: 18, fontWeight: '800', color: '#9a3412'}}>
                UI 渲染器未注册
            </Text>
            <Text style={{fontSize: 13, lineHeight: 20, color: '#7c2d12'}}>
                当前 screen 已进入容器，但 runtime-react 找不到对应 renderer。请检查对应 UI 包是否在 preSetup 中注册了 screen part。
            </Text>
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                containerKey: {containerKey}
            </Text>
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                partKey: {partKey}
            </Text>
            <Text selectable style={{fontSize: 12, color: '#475569'}}>
                rendererKey: {rendererKey}
            </Text>
        </View>
    </View>
)

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
    containerPart,
    automationBridge,
    automationRuntimeId = 'runtime',
    automationTarget = 'primary',
}) => {
    const resolution = useChildScreenPartResolution(containerPart)
    const screenKey = resolution.status === 'ready'
        ? resolution.child.partKey
        : resolution.status === 'missing-renderer'
            ? resolution.missing.partKey
            : 'empty'

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        automationBridge.clearVisibleContexts(automationTarget, [screenKey, 'runtime-root', 'overlay', 'alert'])
        return automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey,
            mountId: `screen:${automationTarget}:${screenKey}`,
            nodeId: `screen:${automationTarget}:${screenKey}`,
            testID: `ui-base-screen-container:${automationTarget}`,
            semanticId: screenKey,
            role: 'screen',
            text: screenKey,
            visible: true,
            enabled: true,
            availableActions: [],
        })
    }, [automationBridge, automationRuntimeId, automationTarget, screenKey])

    if (resolution.status === 'empty') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
                <EmptyScreen />
            </View>
        )
    }
    if (resolution.status === 'missing-renderer') {
        return (
            <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
                <MissingRendererScreen
                    containerKey={resolution.containerKey}
                    partKey={resolution.missing.partKey}
                    rendererKey={resolution.missing.rendererKey}
                />
            </View>
        )
    }

    const Component = resolution.child.Component
    return (
        <View testID={`ui-base-screen-container:${automationTarget}`} style={{flex: 1}}>
            <Component {...(resolution.child.props as object)} />
        </View>
    )
}
