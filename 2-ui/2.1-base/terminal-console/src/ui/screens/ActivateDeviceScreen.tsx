import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
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
    boxShadow: '0px 12px 32px rgba(15, 23, 42, 0.08)',
} as const

export const ActivateDeviceScreen: React.FC = () => {
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
        <View
            testID="ui-base-terminal-activate-device"
            style={{
                flex: 1,
                backgroundColor: terminalConsolePalette.pageBackground,
                paddingHorizontal: 20,
                paddingVertical: 20,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            <View
                style={{
                    position: 'absolute',
                    top: -180,
                    right: -150,
                    width: 430,
                    height: 430,
                    borderRadius: 999,
                    backgroundColor: 'rgba(3, 105, 161, 0.08)',
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    left: -160,
                    bottom: -180,
                    width: 420,
                    height: 420,
                    borderRadius: 999,
                    backgroundColor: 'rgba(15, 23, 42, 0.05)',
                }}
            />
            <View
                style={{
                    width: '100%',
                    maxWidth: 460,
                    borderRadius: 18,
                    backgroundColor: terminalConsolePalette.cardBackground,
                    borderWidth: 1,
                    borderColor: terminalConsolePalette.cardBorder,
                    paddingHorizontal: 34,
                    paddingVertical: 34,
                    gap: 26,
                    ...activateCardShadowStyle,
                }}
            >
                <View style={{alignItems: 'center', gap: 14}}>
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 14,
                            backgroundColor: '#0f172a',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: 1}}>
                            IM
                        </Text>
                    </View>
                    <View style={{alignItems: 'center', gap: 8}}>
                        <Text
                            testID="ui-base-terminal-activate-device:title"
                            style={{fontSize: 30, fontWeight: '700', color: terminalConsolePalette.textPrimary}}
                        >
                            设备激活
                        </Text>
                        <Text style={{
                            fontSize: 15,
                            lineHeight: 22,
                            color: terminalConsolePalette.textSecondary,
                            textAlign: 'center',
                        }}
                        >
                            请输入管理员提供的激活码以开始使用设备
                        </Text>
                    </View>
                </View>

                <View
                    testID="ui-base-terminal-activate-device:identity"
                    style={{
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        backgroundColor: '#f8fafc',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 10,
                    }}
                >
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', gap: 12}}>
                        <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>设备 ID</Text>
                        <Text
                            selectable
                            testID="ui-base-terminal-activate-device:device-id"
                            style={{fontSize: 13, fontWeight: '800', color: terminalConsolePalette.textPrimary}}
                        >
                            {summary.deviceId ?? '未记录'}
                        </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', gap: 12}}>
                        <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>设备型号</Text>
                        <Text style={{fontSize: 13, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>
                            {summary.deviceModel ?? '未记录'}
                        </Text>
                    </View>
                </View>

                <View style={{gap: 10}}>
                    <Text style={{fontSize: 14, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>沙箱 ID</Text>
                    <InputField
                        testID="ui-base-terminal-activate-device:sandbox"
                        value={model.sandboxId}
                        onChangeText={model.setSandboxId}
                        mode="virtual-identifier"
                        placeholder="请输入 sandboxId"
                    />
                    <Text
                        testID="ui-base-terminal-activate-device:sandbox-value"
                        selectable
                        style={{fontSize: 13, color: terminalConsolePalette.textMuted}}
                    >
                        当前沙箱：{model.sandboxId || '未输入'}
                    </Text>
                </View>

                <View style={{gap: 10}}>
                    <Text style={{fontSize: 14, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>激活码</Text>
                    <InputField
                        testID="ui-base-terminal-activate-device:input"
                        value={model.activationCode}
                        onChangeText={model.setActivationCode}
                        mode="virtual-activation-code"
                        placeholder="请输入至少 6 位激活码"
                    />
                    <Text
                        testID="ui-base-terminal-activate-device:value"
                        selectable
                        style={{fontSize: 13, color: terminalConsolePalette.textMuted}}
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

                <View
                    style={{
                        alignItems: 'center',
                        gap: 6,
                        borderTopWidth: 1,
                        borderTopColor: '#e2e8f0',
                        paddingTop: 18,
                    }}
                >
                    <Text style={{fontSize: 13, lineHeight: 20, color: terminalConsolePalette.textSecondary, textAlign: 'center'}}>
                        激活成功后，主屏会进入业务欢迎页，副屏会进入顾客欢迎态。
                    </Text>
                    <Text style={{fontSize: 12, lineHeight: 18, color: terminalConsolePalette.textMuted, textAlign: 'center'}}>
                        管理员入口：左上角连续点击 5 次。
                    </Text>
                </View>
            </View>
        </View>
    )
}
