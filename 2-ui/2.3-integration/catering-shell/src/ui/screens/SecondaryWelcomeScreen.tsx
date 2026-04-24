import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@impos2/ui-base-runtime-react'
import type {CateringSecondaryWelcomeScreenProps} from '../../types'

const brandPalette = {
    background: '#07111f',
    backgroundGlow: 'rgba(180, 131, 44, 0.18)',
    frameBorder: 'rgba(216, 186, 113, 0.34)',
    frameSurface: 'rgba(9, 21, 38, 0.72)',
    eyebrow: '#d8ba71',
    title: '#f6ecd2',
    subtitle: '#b8c5d6',
    metricLabel: '#8fa0b5',
    metricValue: '#f6ecd2',
    brandText: '#d8ba71',
    footer: '#8b98aa',
} as const

export const SecondaryWelcomeScreen: React.FC<CateringSecondaryWelcomeScreenProps> = ({
    terminalId,
}) => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'secondary'
    const screenKey = 'ui.integration.catering-shell.secondary-welcome'
    const secondaryWelcomeTitle = '欢迎来到万象城 · OTA E2E V21'

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
                nodeId: 'ui-integration-catering-shell:secondary-welcome',
                testID: 'ui-integration-catering-shell:secondary-welcome',
                semanticId: 'ui-integration-catering-shell:secondary-welcome',
                role: 'screen',
                text: secondaryWelcomeTitle,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:title`,
                nodeId: 'ui-integration-catering-shell:secondary-welcome:title',
                testID: 'ui-integration-catering-shell:secondary-welcome:title',
                semanticId: 'ui-integration-catering-shell:secondary-welcome:title',
                role: 'text',
                text: secondaryWelcomeTitle,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:terminal-id`,
                nodeId: 'ui-integration-catering-shell:secondary-welcome:terminal-id',
                testID: 'ui-integration-catering-shell:secondary-welcome:terminal-id',
                semanticId: 'ui-integration-catering-shell:secondary-welcome:terminal-id',
                role: 'text',
                text: terminalId ?? 'terminal:unactivated',
                value: terminalId ?? 'terminal:unactivated',
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
        secondaryWelcomeTitle,
        screenKey,
        terminalId,
    ])

    return (
        <View
            testID="ui-integration-catering-shell:secondary-welcome"
            style={{
                flex: 1,
                backgroundColor: brandPalette.background,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 36,
                paddingVertical: 40,
            }}
        >
            <View
                style={{
                    position: 'absolute',
                    top: -140,
                    left: -120,
                    width: 380,
                    height: 380,
                    borderRadius: 999,
                    backgroundColor: brandPalette.backgroundGlow,
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    right: -80,
                    bottom: -110,
                    width: 300,
                    height: 300,
                    borderRadius: 999,
                    backgroundColor: 'rgba(11, 95, 255, 0.14)',
                }}
            />

            <View
                style={{
                    width: '100%',
                    maxWidth: 900,
                    borderRadius: 30,
                    borderWidth: 1,
                    borderColor: brandPalette.frameBorder,
                    backgroundColor: brandPalette.frameSurface,
                    paddingHorizontal: 44,
                    paddingVertical: 42,
                    alignItems: 'center',
                    gap: 22,
                }}
            >
                <Text
                    testID="ui-integration-catering-shell:secondary-welcome:eyebrow"
                    style={{
                        fontSize: 13,
                        fontWeight: '800',
                        color: brandPalette.eyebrow,
                        letterSpacing: 6,
                    }}
                >
                    MIXC SECONDARY DISPLAY
                </Text>

                <View style={{alignItems: 'center', gap: 12}}>
                    <Text
                        testID="ui-integration-catering-shell:secondary-welcome:title"
                        style={{
                            fontSize: 42,
                            lineHeight: 50,
                            fontWeight: '700',
                            color: brandPalette.title,
                            textAlign: 'center',
                            letterSpacing: 1.4,
                        }}
                    >
                        {secondaryWelcomeTitle}
                    </Text>
                    <Text
                        testID="ui-integration-catering-shell:secondary-welcome:subtitle"
                        style={{
                            fontSize: 18,
                            lineHeight: 28,
                            color: brandPalette.subtitle,
                            textAlign: 'center',
                        }}
                    >
                        副屏已进入欢迎态，后续将承接品牌展示、营销内容与顾客可见信息。
                    </Text>
                </View>

                <View
                    style={{
                        width: '100%',
                        maxWidth: 560,
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: 'rgba(216, 186, 113, 0.2)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        paddingHorizontal: 22,
                        paddingVertical: 20,
                        gap: 8,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: brandPalette.metricLabel,
                            letterSpacing: 1,
                        }}
                    >
                        当前终端
                    </Text>
                    <Text
                        selectable
                        testID="ui-integration-catering-shell:secondary-welcome:terminal-id"
                        style={{
                            fontSize: 24,
                            fontWeight: '800',
                            color: brandPalette.metricValue,
                            textAlign: 'center',
                        }}
                    >
                        {terminalId ?? 'terminal:unactivated'}
                    </Text>
                </View>

                <Text
                    testID="ui-integration-catering-shell:secondary-welcome:brand"
                    style={{
                        fontSize: 16,
                        lineHeight: 24,
                        color: brandPalette.brandText,
                        letterSpacing: 8,
                        textAlign: 'center',
                    }}
                >
                    MIXC WORLD
                </Text>
            </View>

            <Text
                testID="ui-integration-catering-shell:secondary-welcome:footer"
                style={{
                    position: 'absolute',
                    bottom: 28,
                    fontSize: 12,
                    color: brandPalette.footer,
                    letterSpacing: 4,
                }}
            >
                CUSTOMER DISPLAY READY
            </Text>
        </View>
    )
}
