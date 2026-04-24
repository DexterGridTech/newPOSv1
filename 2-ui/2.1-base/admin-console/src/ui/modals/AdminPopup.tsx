import React, {useMemo} from 'react'
import {Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import {InputField} from '@next/ui-base-input-runtime'
import {useOptionalInputRuntime} from '@next/ui-base-input-runtime'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@next/ui-base-runtime-react'
import {useStore} from 'react-redux'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {adminConsoleGroups, adminConsoleTabs} from '../../foundations'
import {createAdminPasswordVerifier} from '../../supports/adminPasswordVerifier'
import {getAdminHostTools} from '../../supports/adminHostToolsRegistry'
import {getAdminConsoleSectionRegistry} from '../../supports/adminSectionRegistry'
import {useAdminPopupState} from '../../hooks'

export interface AdminPopupProps {
    deviceId: string
    onClose: () => void
}

const colors = {
    overlay: 'rgba(15, 23, 42, 0.24)',
    surface: '#ffffff',
    page: '#eef3f8',
    pageStrong: '#dbe7f2',
    text: '#0f172a',
    muted: '#64748b',
    border: '#d7e1ec',
    borderStrong: '#bfd2e8',
    primary: '#0b5fff',
    primarySoft: '#e8f0ff',
    primaryDeep: '#123b74',
    danger: '#d14343',
    dangerSoft: '#fdecec',
} as const

const selectedTabShadowStyle = {
    boxShadow: '0px 10px 20px rgba(11, 95, 255, 0.18)',
} as const

const PANEL_WIDTH = '96%'
const PANEL_MAX_WIDTH = 1380
const SIDEBAR_WIDTH = 228
const COMPACT_SIDEBAR_WIDTH = 208
const PANEL_BREAKPOINT = 980

const Shell: React.FC<{
    testID: string
    children: React.ReactNode
}> = ({testID, children}) => (
    <View
        testID={testID}
        style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        }}
    >
        <View
            style={{
                position: 'absolute',
                top: 36,
                right: 44,
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: 'rgba(11, 95, 255, 0.12)',
            }}
        />
        <View
            style={{
                position: 'absolute',
                bottom: 28,
                left: 38,
                width: 220,
                height: 220,
                borderRadius: 999,
                backgroundColor: 'rgba(15, 23, 42, 0.08)',
            }}
        />
        {children}
    </View>
)

const Action: React.FC<{
    testID: string
    label: string
    tone?: 'primary' | 'secondary'
    onPress: () => void
}> = ({testID, label, tone = 'secondary', onPress}) => (
    <Pressable
        testID={testID}
        onPress={onPress}
        style={{
            minHeight: 44,
            borderRadius: 14,
            paddingHorizontal: 16,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: tone === 'primary' ? colors.primary : colors.primarySoft,
        }}
    >
        <Text style={{
            color: tone === 'primary' ? '#ffffff' : colors.primary,
            fontWeight: '800',
        }}
        >
            {label}
        </Text>
    </Pressable>
)

export const AdminPopup: React.FC<AdminPopupProps> = ({
    deviceId,
    onClose,
}) => {
    const {width: windowWidth} = useWindowDimensions()
    const runtime = useUiRuntime()
    const inputRuntime = useOptionalInputRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const store = useStore() as EnhancedStore
    const popupState = useAdminPopupState()
    const verifier = useMemo(() => createAdminPasswordVerifier({
        deviceIdProvider: () => deviceId,
    }), [deviceId])
    const passwordPlaceholder = useMemo(() => {
        if (runtime.environmentMode !== 'DEV') {
            return '请输入 6 位动态密码'
        }
        return `开发密码提示：${verifier.deriveFor(new Date())}`
    }, [runtime.environmentMode, verifier])
    const isCompactPanel = windowWidth < PANEL_BREAKPOINT
    const sections = getAdminConsoleSectionRegistry().list()
    const hostTools = getAdminHostTools(runtime.localNodeId)
    const activeSection = sections.find(section => section.tab === popupState.selectedTab)

    const handleSubmit = () => {
        if (!verifier.verify(popupState.password)) {
            popupState.setError('管理员密码不正确')
            return
        }
        inputRuntime?.deactivateInput()
        popupState.setError('')
        popupState.setScreen('panel')
    }

    React.useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const screenKey = `admin-popup:${popupState.screen}`
        const unregisters: Array<() => void> = [
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:root`,
                nodeId: `ui-base-admin-popup:${popupState.screen}`,
                testID: `ui-base-admin-popup:${popupState.screen}`,
                semanticId: `ui-base-admin-popup:${popupState.screen}`,
                role: 'dialog',
                text: popupState.screen === 'login' ? '管理员登录' : '系统管理工作台',
                visible: true,
                enabled: true,
                persistent: true,
                availableActions: [],
            }),
        ]
        if (popupState.screen === 'login') {
            unregisters.push(
                automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:device-id`,
                    nodeId: 'ui-base-admin-popup:device-id',
                    testID: 'ui-base-admin-popup:device-id',
                    semanticId: 'ui-base-admin-popup:device-id',
                    role: 'text',
                    text: deviceId,
                    value: deviceId,
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: [],
                }),
                automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:submit`,
                    nodeId: 'ui-base-admin-popup:submit',
                    testID: 'ui-base-admin-popup:submit',
                    semanticId: 'ui-base-admin-popup:submit',
                    role: 'button',
                    text: '进入工作台',
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: ['press'],
                    onAutomationAction: () => {
                        handleSubmit()
                        return {ok: true}
                    },
                }),
                automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:close-login`,
                    nodeId: 'ui-base-admin-popup:close-login',
                    testID: 'ui-base-admin-popup:close-login',
                    semanticId: 'ui-base-admin-popup:close-login',
                    role: 'button',
                    text: '关闭',
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: ['press'],
                    onAutomationAction: () => {
                        inputRuntime?.deactivateInput()
                        onClose()
                        return {ok: true}
                    },
                }),
            )
        }
        if (popupState.screen === 'panel') {
            unregisters.push(
                automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:selected-tab`,
                    nodeId: 'ui-base-admin-popup:selected-tab',
                    testID: 'ui-base-admin-popup:selected-tab',
                    semanticId: 'ui-base-admin-popup:selected-tab',
                    role: 'text',
                    text: popupState.selectedTab,
                    value: popupState.selectedTab,
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: [],
                }),
                automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:close-panel`,
                    nodeId: 'ui-base-admin-popup:close-panel',
                    testID: 'ui-base-admin-popup:close-panel',
                    semanticId: 'ui-base-admin-popup:close-panel',
                    role: 'button',
                    text: '关闭',
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: ['press'],
                    onAutomationAction: () => {
                        inputRuntime?.deactivateInput()
                        onClose()
                        return {ok: true}
                    },
                }),
                ...adminConsoleTabs.map(tab => automationBridge.registerNode({
                    target: automationTarget,
                    runtimeId: automationRuntimeId,
                    screenKey,
                    mountId: `${screenKey}:tab:${tab.key}`,
                    nodeId: `ui-base-admin-popup:tab:${tab.key}`,
                    testID: `ui-base-admin-popup:tab:${tab.key}`,
                    semanticId: `ui-base-admin-popup:tab:${tab.key}`,
                    role: 'button',
                    text: tab.title,
                    value: tab.key,
                    visible: true,
                    enabled: true,
                    persistent: true,
                    availableActions: ['press'],
                    onAutomationAction: () => {
                        popupState.setSelectedTab(tab.key)
                        return {ok: true}
                    },
                })),
            )
        }
        return () => {
            unregisters.forEach(unregister => unregister())
        }
    }, [
        automationBridge,
        automationRuntimeId,
        automationTarget,
        deviceId,
        handleSubmit,
        inputRuntime,
        onClose,
        popupState.screen,
        popupState.selectedTab,
        popupState.setSelectedTab,
    ])

    if (popupState.screen === 'login') {
        return (
            <Shell testID="ui-base-admin-popup:login">
                <View
                    style={{
                        width: '100%',
                        maxWidth: 450,
                        borderRadius: 28,
                        backgroundColor: colors.surface,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <View
                        style={{
                            padding: 24,
                            backgroundColor: '#0f172a',
                            gap: 8,
                        }}
                    >
                        <Text style={{color: '#93c5fd', fontSize: 12, fontWeight: '800'}}>SYSTEM ADMIN</Text>
                        <Text style={{color: '#ffffff', fontSize: 28, fontWeight: '800'}}>管理员登录</Text>
                    </View>
                    <View style={{padding: 24, gap: 16}}>
                        <View
                            testID="ui-base-admin-popup:device-identity"
                            style={{
                                borderRadius: 18,
                                backgroundColor: colors.page,
                                padding: 16,
                                gap: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                            }}
                        >
                            <View
                                style={{
                                    width: 124,
                                    height: 124,
                                    borderRadius: 18,
                                    backgroundColor: '#ffffff',
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: 8,
                                }}
                            >
                                <QRCode
                                    value={deviceId}
                                    size={96}
                                    backgroundColor="transparent"
                                />
                            </View>
                            <View style={{flex: 1, minWidth: 220, gap: 6}}>
                                <Text style={{color: colors.muted, fontSize: 12}}>本机 ID</Text>
                                <Text
                                    testID="ui-base-admin-popup:device-id"
                                    selectable
                                    style={{color: colors.text, fontSize: 16, fontWeight: '800'}}
                                >
                                    {deviceId}
                                </Text>
                                <Text style={{color: colors.muted, lineHeight: 20}}>
                                    管理员可通过设备 ID 扫码或人工录入后生成动态密码。
                                </Text>
                            </View>
                        </View>
                        <View style={{gap: 8}}>
                            <Text style={{color: colors.text, fontWeight: '700'}}>管理员密码</Text>
                            <InputField
                                testID="ui-base-admin-popup:password"
                                value={popupState.password}
                                onChangeText={popupState.setPassword}
                                mode="virtual-pin"
                                secureTextEntry
                                maxLength={6}
                                placeholder={passwordPlaceholder}
                            />
                        </View>
                        {popupState.error ? (
                            <View style={{borderRadius: 12, padding: 12, backgroundColor: colors.dangerSoft}}>
                                <Text style={{color: colors.danger}}>{popupState.error}</Text>
                            </View>
                        ) : null}
                        <View style={{flexDirection: 'row', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                            <Action
                                testID="ui-base-admin-popup:close-login"
                                label="关闭"
                                onPress={() => {
                                    inputRuntime?.deactivateInput()
                                    onClose()
                                }}
                            />
                            <Action testID="ui-base-admin-popup:submit" label="进入工作台" tone="primary" onPress={handleSubmit} />
                        </View>
                    </View>
                </View>
            </Shell>
        )
    }

    return (
        <Shell testID="ui-base-admin-popup:panel">
            <View
                style={{
                    width: PANEL_WIDTH,
                    maxWidth: PANEL_MAX_WIDTH,
                    height: '92%',
                    borderRadius: 28,
                    backgroundColor: colors.page,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <View
                    style={{
                        padding: 18,
                        backgroundColor: '#0f172a',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <View style={{gap: 6}}>
                        <Text style={{color: '#93c5fd', fontSize: 12, fontWeight: '800'}}>ADMIN WORKBENCH</Text>
                        <Text style={{color: '#ffffff', fontSize: 24, fontWeight: '800'}}>系统管理工作台</Text>
                        <Text style={{color: '#cbd5e1', fontSize: 13, lineHeight: 18}}>
                            统一查看终端运行态、拓扑连接、宿主能力与适配器调试结果。
                        </Text>
                    </View>
                    <Action
                        testID="ui-base-admin-popup:close-panel"
                        label="关闭"
                        onPress={() => {
                            inputRuntime?.deactivateInput()
                            onClose()
                        }}
                    />
                </View>
                <View
                    style={{
                        flex: 1,
                        flexDirection: isCompactPanel ? 'column' : 'row',
                        minWidth: 0,
                    }}
                >
                    <ScrollView
                        style={{
                            width: '100%',
                            maxWidth: isCompactPanel ? undefined : SIDEBAR_WIDTH,
                            minWidth: isCompactPanel ? undefined : COMPACT_SIDEBAR_WIDTH,
                            borderRightWidth: isCompactPanel ? 0 : 1,
                            borderRightColor: colors.border,
                            borderBottomWidth: isCompactPanel ? 1 : 0,
                            borderBottomColor: colors.border,
                            backgroundColor: '#f8fbff',
                            flexShrink: 1,
                            maxHeight: isCompactPanel ? 236 : undefined,
                        }}
                        contentContainerStyle={{
                            padding: 12,
                            gap: 10,
                        }}
                    >
                        {adminConsoleGroups.map(group => (
                            <View
                                key={group.key}
                                style={{
                                    gap: 6,
                                    padding: 10,
                                    borderRadius: 18,
                                    backgroundColor: '#ffffff',
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <View
                                    testID={`ui-base-admin-popup:group:${group.key}`}
                                    style={{
                                        borderRadius: 16,
                                        backgroundColor: group.key === 'runtime' ? '#eff6ff' : '#fff7ed',
                                        padding: 12,
                                        gap: 6,
                                    }}
                                >
                                    <Text style={{color: colors.text, fontWeight: '800', fontSize: 16}}>
                                        {group.title}
                                    </Text>
                                    <Text style={{color: colors.muted, fontSize: 12, lineHeight: 17}}>
                                        {group.hint}
                                    </Text>
                                </View>
                                {adminConsoleTabs
                                    .filter(tab => tab.group === group.key)
                                    .map(tab => {
                                        const selected = tab.key === popupState.selectedTab
                                        return (
                                            <Pressable
                                                key={tab.key}
                                                testID={`ui-base-admin-popup:tab:${tab.key}`}
                                                onPress={() => popupState.setSelectedTab(tab.key)}
                                                style={{
                                                    borderRadius: 16,
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 11,
                                                    backgroundColor: selected ? colors.primary : '#ffffff',
                                                    borderWidth: 1,
                                                    borderColor: selected ? colors.primary : colors.borderStrong,
                                                    gap: 3,
                                                    ...(selected ? selectedTabShadowStyle : {}),
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: selected ? '#bfdbfe' : colors.primary,
                                                        fontSize: 10,
                                                        fontWeight: '800',
                                                        letterSpacing: 0.6,
                                                    }}
                                                >
                                                    {group.title}
                                                </Text>
                                                <Text style={{
                                                    color: selected ? '#ffffff' : colors.text,
                                                    fontWeight: '800',
                                                    fontSize: 14,
                                                }}
                                                >
                                                    {tab.title}
                                                </Text>
                                                <Text style={{
                                                    color: selected ? '#dbeafe' : colors.muted,
                                                    fontSize: 11,
                                                    lineHeight: 16,
                                                }}
                                                >
                                                    {tab.hint}
                                                </Text>
                                            </Pressable>
                                        )
                                    })}
                            </View>
                        ))}
                    </ScrollView>
                    <ScrollView
                        style={{flex: 1, minWidth: 0}}
                        contentContainerStyle={{
                            paddingHorizontal: isCompactPanel ? 16 : 18,
                            paddingVertical: isCompactPanel ? 16 : 18,
                            gap: 14,
                            minWidth: 0,
                        }}
                    >
                        <Text
                            testID="ui-base-admin-popup:selected-tab"
                            style={{color: colors.primaryDeep, fontWeight: '800'}}
                        >
                            {popupState.selectedTab}
                        </Text>
                        {activeSection?.render({
                            runtime,
                            store,
                            closePanel: () => {
                                inputRuntime?.deactivateInput()
                                onClose()
                            },
                            hostTools,
                        }) ?? null}
                    </ScrollView>
                </View>
            </View>
        </Shell>
    )
}
