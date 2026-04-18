import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
import {useSelector} from 'react-redux'
import {selectTopologyDisplayMode} from '@impos2/kernel-base-topology-runtime-v2'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@impos2/ui-base-runtime-react'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {useTerminalConnectionSummary} from '../../hooks/useTerminalConnectionSummary'

const secondaryCardStyle = {
    width: '100%' as const,
    maxWidth: 620,
    alignSelf: 'center' as const,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(216, 186, 113, 0.34)',
    backgroundColor: 'rgba(9, 21, 38, 0.78)',
    paddingHorizontal: 30,
    paddingVertical: 32,
    gap: 24,
}

export const ActivateDeviceSecondaryScreen: React.FC = () => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'secondary'
    const summary = useTerminalConnectionSummary()
    const displayMode = useSelector((state: RootState) => selectTopologyDisplayMode(state) ?? 'SECONDARY')
    const screenKey = 'ui.base.terminal.activate-device-secondary'

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const unregisters = [
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:root`,
                nodeId: 'ui-base-terminal-activate-device-secondary',
                testID: 'ui-base-terminal-activate-device-secondary',
                semanticId: 'ui-base-terminal-activate-device-secondary',
                role: 'screen',
                text: '等待主屏完成设备激活',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:title`,
                nodeId: 'ui-base-terminal-activate-device-secondary:title',
                testID: 'ui-base-terminal-activate-device-secondary:title',
                semanticId: 'ui-base-terminal-activate-device-secondary:title',
                role: 'text',
                text: '等待主屏完成设备激活',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:display-mode`,
                nodeId: 'ui-base-terminal-activate-device-secondary:display-mode',
                testID: 'ui-base-terminal-activate-device-secondary:display-mode',
                semanticId: 'ui-base-terminal-activate-device-secondary:display-mode',
                role: 'text',
                text: displayMode,
                value: displayMode,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:device-id`,
                nodeId: 'ui-base-terminal-activate-device-secondary:device-id',
                testID: 'ui-base-terminal-activate-device-secondary:device-id',
                semanticId: 'ui-base-terminal-activate-device-secondary:device-id',
                role: 'text',
                text: summary.deviceId ?? '未记录',
                value: summary.deviceId ?? '未记录',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
        ]
        return () => {
            unregisters.forEach(unregister => unregister())
        }
    }, [
        automationBridge,
        automationRuntimeId,
        automationTarget,
        displayMode,
        screenKey,
        summary.deviceId,
    ])

    return (
        <View
            testID="ui-base-terminal-activate-device-secondary"
            style={{
                flex: 1,
                justifyContent: 'center',
                backgroundColor: '#07111f',
                paddingHorizontal: 36,
                paddingVertical: 36,
                overflow: 'hidden',
            }}
        >
            <View
                style={{
                    position: 'absolute',
                    top: -120,
                    right: -80,
                    width: 320,
                    height: 320,
                    borderRadius: 999,
                    backgroundColor: 'rgba(216, 186, 113, 0.14)',
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    bottom: -120,
                    left: -70,
                    width: 260,
                    height: 260,
                    borderRadius: 999,
                    backgroundColor: 'rgba(11, 95, 255, 0.12)',
                }}
            />
            <View style={secondaryCardStyle}>
                <View style={{alignItems: 'center', gap: 14}}>
                    <View
                        style={{
                            width: 108,
                            height: 108,
                            borderRadius: 54,
                            backgroundColor: 'rgba(216, 186, 113, 0.12)',
                            borderWidth: 1,
                            borderColor: 'rgba(216, 186, 113, 0.28)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 42,
                                fontWeight: '800',
                                color: '#d8ba71',
                            }}
                        >
                            ⏳
                        </Text>
                    </View>
                    <View
                        style={{
                            alignSelf: 'center',
                            borderRadius: 999,
                            backgroundColor: 'rgba(216, 186, 113, 0.16)',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: '#d8ba71',
                            }}
                        >
                            副屏待命
                        </Text>
                    </View>
                    <Text
                        testID="ui-base-terminal-activate-device-secondary:title"
                        style={{
                            fontSize: 36,
                            lineHeight: 44,
                            fontWeight: '800',
                            color: '#f6ecd2',
                            textAlign: 'center',
                        }}
                    >
                        等待主屏完成设备激活
                    </Text>
                    <Text
                        style={{
                            fontSize: 16,
                            lineHeight: 24,
                            color: '#c1cddd',
                            textAlign: 'center',
                        }}
                    >
                        当前屏幕不承接激活输入。请在主屏输入激活码，完成后此屏会自动切到副屏欢迎页。
                    </Text>
                </View>

                <View
                    style={{
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        paddingHorizontal: 18,
                        paddingVertical: 18,
                        gap: 12,
                    }}
                >
                    <View style={{gap: 4}}>
                        <Text style={{fontSize: 12, color: '#7a8aa0'}}>当前显示模式</Text>
                        <Text
                            testID="ui-base-terminal-activate-device-secondary:display-mode"
                            style={{fontSize: 22, fontWeight: '800', color: '#f6ecd2'}}
                        >
                            {displayMode}
                        </Text>
                    </View>
                    <View style={{gap: 4}}>
                        <Text style={{fontSize: 12, color: '#7a8aa0'}}>设备 ID</Text>
                        <Text
                            selectable
                            testID="ui-base-terminal-activate-device-secondary:device-id"
                            style={{fontSize: 20, fontWeight: '700', color: '#f6ecd2'}}
                        >
                            {summary.deviceId ?? '未记录'}
                        </Text>
                    </View>
                </View>

                <View style={{gap: 10}}>
                    <Text style={{fontSize: 13, fontWeight: '700', color: '#d8ba71'}}>等待规则</Text>
                    <Text style={{fontSize: 14, lineHeight: 22, color: '#c1cddd'}}>
                        1. 主屏完成激活后，终端身份和凭证会写入本机状态。
                    </Text>
                    <Text style={{fontSize: 14, lineHeight: 22, color: '#c1cddd'}}>
                        2. 系统会根据激活结果自动切换主副屏显示内容。
                    </Text>
                    <Text style={{fontSize: 14, lineHeight: 22, color: '#c1cddd'}}>
                        3. 未激活期间，副屏只显示等待态，不再暴露重复输入能力。
                    </Text>
                </View>
            </View>
        </View>
    )
}
