import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
import {useSelector} from 'react-redux'
import {
    selectTopologyDisplayMode,
    selectTopologyStandalone,
    selectTopologySync,
} from '@next/kernel-base-topology-runtime-v3'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@next/ui-base-runtime-react'
import type {RootState} from '@next/kernel-base-state-runtime'
import {useTerminalConnectionSummary} from '../../hooks/useTerminalConnectionSummary'

export const ActivateDeviceSecondaryScreen: React.FC = () => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'secondary'
    const summary = useTerminalConnectionSummary()
    const displayMode = useSelector((state: RootState) => selectTopologyDisplayMode(state) ?? 'SECONDARY')
    const standalone = useSelector((state: RootState) => selectTopologyStandalone(state) ?? true)
    const continuousSyncActive = useSelector((state: RootState) =>
        selectTopologySync(state)?.status === 'active',
    )
    const identityReady = standalone || continuousSyncActive
    const displayDeviceId = identityReady ? summary.deviceId ?? '未记录' : '等待主屏同步'
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
                text: displayDeviceId,
                value: displayDeviceId,
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
        displayDeviceId,
        screenKey,
    ])

    return (
        <View
            testID="ui-base-terminal-activate-device-secondary"
            style={{
                flex: 1,
                justifyContent: 'center',
                backgroundColor: '#eef4f8',
                paddingHorizontal: 28,
                paddingVertical: 22,
            }}
        >
            <View
                style={{
                    width: '100%',
                    maxWidth: 760,
                    alignSelf: 'center',
                    borderRadius: 28,
                    borderWidth: 1,
                    borderColor: '#d7e1ea',
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 28,
                    paddingVertical: 26,
                    gap: 22,
                    boxShadow: '0px 18px 42px rgba(15, 23, 42, 0.10)',
                }}
            >
                <View style={{alignItems: 'center', gap: 12}}>
                    <View
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            backgroundColor: '#eff6ff',
                            borderWidth: 1,
                            borderColor: '#bfdbfe',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 30,
                                fontWeight: '800',
                                color: '#2563eb',
                            }}
                        >
                            ...
                        </Text>
                    </View>
                    <View
                        style={{
                            alignSelf: 'center',
                            borderRadius: 999,
                            backgroundColor: '#f1f5f9',
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: '#475569',
                                letterSpacing: 0.5,
                            }}
                        >
                            SECONDARY STANDBY
                        </Text>
                    </View>
                    <Text
                        testID="ui-base-terminal-activate-device-secondary:title"
                        style={{
                            fontSize: 30,
                            lineHeight: 38,
                            fontWeight: '800',
                            color: '#0f172a',
                            textAlign: 'center',
                        }}
                    >
                        等待主屏完成设备激活
                    </Text>
                    <Text
                        style={{
                            maxWidth: 560,
                            fontSize: 15,
                            lineHeight: 22,
                            color: '#64748b',
                            textAlign: 'center',
                        }}
                    >
                        当前屏幕仅显示等待状态，不承接激活输入。主屏完成激活后，此屏会自动切换为副屏业务欢迎页。
                    </Text>
                </View>

                <View
                    style={{
                        flexDirection: 'row',
                        gap: 14,
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            borderRadius: 18,
                            backgroundColor: '#f8fafc',
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            gap: 6,
                        }}
                    >
                        <Text style={{fontSize: 12, color: '#7a8aa0'}}>当前显示模式</Text>
                        <Text
                            testID="ui-base-terminal-activate-device-secondary:display-mode"
                            style={{fontSize: 18, fontWeight: '800', color: '#0f172a'}}
                        >
                            {displayMode}
                        </Text>
                    </View>
                    <View
                        style={{
                            flex: 1.2,
                            borderRadius: 18,
                            backgroundColor: '#f8fafc',
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            gap: 6,
                        }}
                    >
                        <Text style={{fontSize: 12, color: '#7a8aa0'}}>设备 ID</Text>
                        <Text
                            selectable
                            testID="ui-base-terminal-activate-device-secondary:device-id"
                            style={{fontSize: 17, fontWeight: '700', color: '#0f172a'}}
                        >
                            {displayDeviceId}
                        </Text>
                    </View>
                </View>

                <View
                    style={{
                        borderRadius: 18,
                        backgroundColor: '#f8fafc',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 10,
                    }}
                >
                    <Text style={{fontSize: 13, fontWeight: '800', color: '#334155'}}>等待说明</Text>
                    <Text style={{fontSize: 14, lineHeight: 21, color: '#64748b'}}>
                        1. 主屏提交激活信息后，系统会同步终端身份与凭证。
                    </Text>
                    <Text style={{fontSize: 14, lineHeight: 21, color: '#64748b'}}>
                        2. 激活成功后，主副屏会自动切换到各自的业务页面。
                    </Text>
                    <Text style={{fontSize: 14, lineHeight: 21, color: '#64748b'}}>
                        3. 未激活前，副屏保持只读等待态，避免重复操作。
                    </Text>
                </View>
            </View>
        </View>
    )
}
