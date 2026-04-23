import React, {useEffect} from 'react'
import {ScrollView, Text, View, useWindowDimensions} from 'react-native'
import {InputField, inputRuntimeDefaultFields} from '@impos2/ui-base-input-runtime'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@impos2/ui-base-runtime-react'
import {useTerminalConnectionSummary} from '../../hooks/useTerminalConnectionSummary'
import {useDeviceActivation} from '../../hooks/useDeviceActivation'
import {
    TerminalActionButton,
    TerminalInlineMessage,
    terminalConsolePalette,
} from '../components/TerminalSectionPrimitives'

const activateCardShadowStyle = {
    boxShadow: '0px 16px 42px rgba(15, 23, 42, 0.10)',
} as const

const activationFlowSteps = [
    '确认设备已接入网络并保持在线',
    '输入管理员分配的沙箱 ID 与激活码',
    '提交后系统会自动写入终端身份',
] as const

export const ActivateDeviceScreen: React.FC = () => {
    const {width, height} = useWindowDimensions()
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const model = useDeviceActivation(runtime)
    const summary = useTerminalConnectionSummary()
    const helperMessage = model.errorMessage
        ? model.errorMessage
        : !model.eligibilityAllowed
            ? model.eligibilityMessage
            : model.activationCode.length > 0
            ? '确认激活码无误后点击“立即激活”，系统会自动完成终端接入。'
            : model.eligibilityMessage
    const screenKey = 'ui.base.terminal.activate-device'
    const isWideLayout = width >= 860
    const isCompactHeight = height < 760
    const pagePaddingVertical = isCompactHeight ? 14 : 22
    const cardPadding = isCompactHeight ? 18 : 24
    const cardGap = isCompactHeight ? 14 : 18

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
                nodeId: 'ui-base-terminal-activate-device',
                testID: 'ui-base-terminal-activate-device',
                semanticId: 'ui-base-terminal-activate-device',
                role: 'screen',
                text: '设备激活',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:title`,
                nodeId: 'ui-base-terminal-activate-device:title',
                testID: 'ui-base-terminal-activate-device:title',
                semanticId: 'ui-base-terminal-activate-device:title',
                role: 'text',
                text: '设备激活',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:device-id`,
                nodeId: 'ui-base-terminal-activate-device:device-id',
                testID: 'ui-base-terminal-activate-device:device-id',
                semanticId: 'ui-base-terminal-activate-device:device-id',
                role: 'text',
                text: summary.deviceId ?? '未记录',
                value: summary.deviceId ?? '未记录',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:sandbox-value`,
                nodeId: 'ui-base-terminal-activate-device:sandbox-value',
                testID: 'ui-base-terminal-activate-device:sandbox-value',
                semanticId: 'ui-base-terminal-activate-device:sandbox-value',
                role: 'text',
                text: `当前沙箱：${model.sandboxId || '未输入'}`,
                value: model.sandboxId,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:value`,
                nodeId: 'ui-base-terminal-activate-device:value',
                testID: 'ui-base-terminal-activate-device:value',
                semanticId: 'ui-base-terminal-activate-device:value',
                role: 'text',
                text: `当前输入：${model.activationCode || '未输入'}`,
                value: model.activationCode,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:message`,
                nodeId: 'ui-base-terminal-activate-device:message',
                testID: 'ui-base-terminal-activate-device:message',
                semanticId: 'ui-base-terminal-activate-device:message',
                role: 'text',
                text: helperMessage,
                value: model.eligibilityReasonCode,
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
        helperMessage,
        model.activationCode,
        model.eligibilityReasonCode,
        model.sandboxId,
        screenKey,
        summary.deviceId,
    ])

    return (
        <ScrollView
            testID="ui-base-terminal-activate-device"
            style={{
                flex: 1,
                backgroundColor: '#f3f7fb',
            }}
            contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: isWideLayout ? 28 : 18,
                paddingVertical: pagePaddingVertical,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <View
                style={{
                    width: '100%',
                    maxWidth: 980,
                    borderRadius: 24,
                    backgroundColor: terminalConsolePalette.cardBackground,
                    borderWidth: 1,
                    borderColor: '#dbe5f0',
                    padding: cardPadding,
                    gap: cardGap,
                    ...activateCardShadowStyle,
                }}
            >
                <View
                    style={{
                        flexDirection: isWideLayout ? 'row' : 'column',
                        justifyContent: 'space-between',
                        alignItems: isWideLayout ? 'center' : 'flex-start',
                        gap: 12,
                    }}
                >
                    <View style={{gap: 6, flex: 1}}>
                        <Text style={{fontSize: 12, fontWeight: '800', color: '#2563eb', letterSpacing: 0.8}}>
                            DEVICE ONBOARDING
                        </Text>
                        <Text
                            testID="ui-base-terminal-activate-device:title"
                            style={{
                                fontSize: isCompactHeight ? 28 : 32,
                                lineHeight: isCompactHeight ? 34 : 38,
                                fontWeight: '800',
                                color: '#111827',
                            }}
                        >
                            设备激活
                        </Text>
                        <Text style={{
                            maxWidth: 560,
                            fontSize: 14,
                            lineHeight: 21,
                            color: '#5f6f82',
                        }}
                        >
                            输入设备接入信息后完成终端身份绑定。
                        </Text>
                    </View>
                    <View
                        style={{
                            borderRadius: 999,
                            backgroundColor: '#eff6ff',
                            borderWidth: 1,
                            borderColor: '#bfdbfe',
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                        }}
                    >
                        <Text style={{fontSize: 13, fontWeight: '800', color: '#1d4ed8'}}>
                            等待激活
                        </Text>
                    </View>
                </View>

                <View
                    style={{
                        flexDirection: isWideLayout ? 'row' : 'column',
                        gap: 16,
                        alignItems: 'stretch',
                    }}
                >
                    <View style={{flex: isWideLayout ? 0.92 : undefined, gap: 12}}>
                        <View
                            testID="ui-base-terminal-activate-device:identity"
                            style={{
                                borderRadius: 18,
                                borderWidth: 1,
                                borderColor: '#dbe5f0',
                                backgroundColor: '#f8fafc',
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                                gap: 12,
                            }}
                        >
                            <Text style={{fontSize: 13, fontWeight: '800', color: '#334155'}}>
                                本机信息
                            </Text>
                            <View style={{gap: 5}}>
                                <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>设备 ID</Text>
                                <Text
                                    selectable
                                    testID="ui-base-terminal-activate-device:device-id"
                                    style={{
                                        fontSize: 13,
                                        lineHeight: 18,
                                        fontWeight: '800',
                                        color: terminalConsolePalette.textPrimary,
                                    }}
                                >
                                    {summary.deviceId ?? '未记录'}
                                </Text>
                            </View>
                            <View style={{gap: 5}}>
                                <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>设备型号</Text>
                                <Text style={{fontSize: 13, lineHeight: 18, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>
                                    {summary.deviceModel ?? '未记录'}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={{
                                borderRadius: 18,
                                backgroundColor: '#f1f5f9',
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                                gap: 10,
                            }}
                        >
                            <Text style={{fontSize: 13, fontWeight: '800', color: '#334155'}}>
                                接入流程
                            </Text>
                            {activationFlowSteps.map((step, index) => (
                                <View key={step} style={{flexDirection: 'row', gap: 9, alignItems: 'flex-start'}}>
                                    <View
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 10,
                                            backgroundColor: '#dbeafe',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginTop: 1,
                                        }}
                                    >
                                        <Text style={{fontSize: 11, fontWeight: '900', color: '#1d4ed8'}}>
                                            {index + 1}
                                        </Text>
                                    </View>
                                    <Text style={{flex: 1, fontSize: 13, lineHeight: 20, color: '#526072'}}>
                                        {step}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View
                        style={{
                            flex: isWideLayout ? 1.08 : undefined,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            backgroundColor: '#ffffff',
                            paddingHorizontal: 16,
                            paddingVertical: 16,
                            gap: 12,
                        }}
                    >
                        <View style={{gap: 6}}>
                            <Text style={{fontSize: 14, fontWeight: '800', color: terminalConsolePalette.textPrimary}}>
                                沙箱 ID
                            </Text>
                            <InputField
                                testID="ui-base-terminal-activate-device:sandbox"
                                value={model.sandboxId}
                                onChangeText={model.setSandboxId}
                                mode="virtual-identifier"
                                placeholder="请输入环境沙箱ID"
                            />
                            <Text
                                testID="ui-base-terminal-activate-device:sandbox-value"
                                selectable
                                style={{fontSize: 12, lineHeight: 17, color: terminalConsolePalette.textMuted}}
                            >
                                当前沙箱：{model.sandboxId || '未输入'}
                            </Text>
                        </View>

                        <View style={{gap: 6}}>
                            <Text style={{fontSize: 14, fontWeight: '800', color: terminalConsolePalette.textPrimary}}>
                                激活码
                            </Text>
                            <InputField
                                testID="ui-base-terminal-activate-device:input"
                                value={model.activationCode}
                                onChangeText={model.setActivationCode}
                                mode="virtual-activation-code"
                                placeholder="请输入设备激活码"
                            />
                            <Text
                                testID="ui-base-terminal-activate-device:value"
                                selectable
                                style={{fontSize: 12, lineHeight: 17, color: terminalConsolePalette.textMuted}}
                            >
                                当前输入：{model.activationCode || '未输入'}
                            </Text>
                        </View>

                        <TerminalInlineMessage
                            testID="ui-base-terminal-activate-device:message"
                            tone={model.errorMessage || !model.eligibilityAllowed ? 'error' : 'info'}
                            message={helperMessage}
                        />

                        <TerminalActionButton
                            testID="ui-base-terminal-activate-device:submit"
                            label={model.submitLabel}
                            disabled={!model.canSubmit}
                            onPress={() => {
                                void model.submit()
                            }}
                        />
                    </View>
                </View>
            </View>
        </ScrollView>
    )
}
