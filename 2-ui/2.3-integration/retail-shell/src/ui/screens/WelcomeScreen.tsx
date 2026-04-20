import React, {useEffect} from 'react'
import {Text, View} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@impos2/ui-base-runtime-react'
import type {RetailWelcomeScreenProps} from '../../types'

const welcomeCardShadowStyle = {
    boxShadow: '0px 16px 40px rgba(15, 23, 42, 0.08)',
} as const

const welcomeTitle = '欢迎进入零售终端 · OTA E2E V9'

export const WelcomeScreen: React.FC<RetailWelcomeScreenProps> = ({
    terminalId,
}) => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const screenKey = 'ui.integration.retail-shell.welcome'

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
                nodeId: 'ui-integration-retail-shell:welcome',
                testID: 'ui-integration-retail-shell:welcome',
                semanticId: 'ui-integration-retail-shell:welcome',
                role: 'screen',
                text: welcomeTitle,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:title`,
                nodeId: 'ui-integration-retail-shell:welcome:title',
                testID: 'ui-integration-retail-shell:welcome:title',
                semanticId: 'ui-integration-retail-shell:welcome:title',
                role: 'text',
                text: welcomeTitle,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:terminal-id`,
                nodeId: 'ui-integration-retail-shell:welcome:terminal-id',
                testID: 'ui-integration-retail-shell:welcome:terminal-id',
                semanticId: 'ui-integration-retail-shell:welcome:terminal-id',
                role: 'text',
                text: terminalId ?? 'terminal:unactivated',
                value: terminalId ?? 'terminal:unactivated',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:summary`,
                nodeId: 'ui-integration-retail-shell:welcome:summary',
                testID: 'ui-integration-retail-shell:welcome:summary',
                semanticId: 'ui-integration-retail-shell:welcome:summary',
                role: 'text',
                text: '终端接入已经完成，主屏将承接操作员可见的业务入口，副屏将承接顾客可见的欢迎展示与后续营销内容，不再重复激活流程。',
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
        screenKey,
        terminalId,
    ])

    return (
        <View
            testID="ui-integration-retail-shell:welcome"
            style={{
                flex: 1,
                paddingHorizontal: 32,
                paddingVertical: 28,
                justifyContent: 'center',
                backgroundColor: '#eef4fb',
            }}
        >
            <View
                style={{
                    borderRadius: 28,
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 32,
                    paddingVertical: 30,
                    gap: 22,
                    borderWidth: 1,
                    borderColor: '#dbe7f3',
                    ...welcomeCardShadowStyle,
                }}
            >
                <View style={{gap: 8}}>
                    <Text
                        testID="ui-integration-retail-shell:welcome:eyebrow"
                        style={{fontSize: 12, fontWeight: '800', color: '#2563eb'}}
                    >
                        RETAIL SHELL
                    </Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:title"
                        style={{fontSize: 34, lineHeight: 42, fontWeight: '800', color: '#0f172a'}}
                    >
                        {welcomeTitle}
                    </Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:subtitle"
                        style={{fontSize: 16, lineHeight: 24, color: '#475569'}}
                    >
                        终端已完成激活，当前页面用于承接品牌欢迎页、收银工作台和后续业务入口。
                    </Text>
                </View>

                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 16}}>
                    <View
                        style={{
                            flexGrow: 1,
                            flexBasis: 260,
                            borderRadius: 20,
                            backgroundColor: '#f8fbff',
                            padding: 18,
                            gap: 8,
                        }}
                    >
                        <Text style={{fontSize: 12, color: '#64748b', fontWeight: '700'}}>当前终端</Text>
                        <Text
                            selectable
                            testID="ui-integration-retail-shell:welcome:terminal-id"
                            style={{fontSize: 24, fontWeight: '800', color: '#0f172a'}}
                        >
                            {terminalId ?? 'terminal:unactivated'}
                        </Text>
                        <Text style={{fontSize: 13, lineHeight: 20, color: '#64748b'}}>
                            主屏已具备加载欢迎页、收银页和管理员工作台的基础运行条件。
                        </Text>
                    </View>

                    <View
                        style={{
                            flexGrow: 1,
                            flexBasis: 220,
                            borderRadius: 20,
                            backgroundColor: '#eff6ff',
                            padding: 18,
                            gap: 10,
                        }}
                    >
                        <Text style={{fontSize: 12, color: '#2563eb', fontWeight: '800'}}>启动完成</Text>
                        <Text style={{fontSize: 18, lineHeight: 26, fontWeight: '800', color: '#0f172a'}}>
                            主副屏已经进入业务欢迎态
                        </Text>
                        <Text style={{fontSize: 13, lineHeight: 20, color: '#475569'}}>
                            之后只需要继续装载品牌业务内容，不会再回到激活流程。
                        </Text>
                    </View>
                </View>

                <View style={{gap: 10}}>
                    <Text style={{fontSize: 13, fontWeight: '700', color: '#334155'}}>当前状态</Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:summary"
                        style={{fontSize: 15, lineHeight: 24, color: '#475569'}}
                    >
                        终端接入已经完成，主屏将承接操作员可见的业务入口，副屏将承接顾客可见的欢迎展示与后续营销内容，不再重复激活流程。
                    </Text>
                </View>
            </View>
        </View>
    )
}
