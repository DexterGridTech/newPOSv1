import React from 'react'
import {Pressable, Text, View} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
} from '@next/ui-base-runtime-react'

export const terminalConsolePalette = {
    pageBackground: '#edf4fb',
    cardBackground: '#ffffff',
    cardBorder: '#d9e3ef',
    textPrimary: '#0f172a',
    textSecondary: '#526072',
    textMuted: '#7a8aa0',
    accentSoft: '#e0f2fe',
    accentText: '#075985',
    surfaceSoft: '#f8fafc',
    infoBackground: '#eff6ff',
    infoText: '#1d4ed8',
    errorBackground: '#fef2f2',
    errorText: '#b91c1c',
    successBackground: '#ecfdf5',
    successText: '#047857',
    buttonPrimary: '#0b5fff',
    buttonDisabled: '#cbd5e1',
} as const

const terminalCardShadowStyle = {
    boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.08)',
} as const

export const TerminalShellHeader: React.FC<{
    badge?: string
    title: string
    subtitle: string
    eyebrow?: string
}> = ({badge, title, subtitle, eyebrow}) => (
    <View style={{gap: 10}}>
        {badge ? (
            <View
                style={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    backgroundColor: terminalConsolePalette.accentSoft,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                }}
            >
                <Text style={{fontSize: 12, fontWeight: '700', color: terminalConsolePalette.accentText}}>
                    {badge}
                </Text>
            </View>
        ) : null}
        {eyebrow ? (
            <Text style={{fontSize: 12, fontWeight: '800', color: '#2563eb', letterSpacing: 0.4}}>
                {eyebrow}
            </Text>
        ) : null}
        <Text style={{fontSize: 28, fontWeight: '800', color: terminalConsolePalette.textPrimary}}>
            {title}
        </Text>
        <Text style={{fontSize: 15, lineHeight: 22, color: terminalConsolePalette.textSecondary}}>
            {subtitle}
        </Text>
    </View>
)

export const TerminalCardShell: React.FC<{
    title: string
    subtitle: string
    badge?: string
    eyebrow?: string
    children: React.ReactNode
}> = ({title, subtitle, badge, eyebrow, children}) => (
    <View
        style={{
            width: '100%',
            borderRadius: 28,
            borderWidth: 1,
            borderColor: terminalConsolePalette.cardBorder,
            backgroundColor: terminalConsolePalette.cardBackground,
            padding: 24,
            gap: 20,
            ...terminalCardShadowStyle,
        }}
    >
        <TerminalShellHeader badge={badge} eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
    </View>
)

export const TerminalScreenShell: React.FC<{
    testID: string
    title: string
    subtitle: string
    badge?: string
    eyebrow?: string
    children: React.ReactNode
}> = ({testID, title, subtitle, badge, eyebrow, children}) => (
    <View
        testID={testID}
        style={{
            flex: 1,
            backgroundColor: terminalConsolePalette.pageBackground,
            paddingHorizontal: 20,
            paddingVertical: 28,
            justifyContent: 'center',
        }}
    >
        <View
            style={{
                width: '100%',
                maxWidth: 520,
                alignSelf: 'center',
            }}
        >
            <TerminalCardShell badge={badge} eyebrow={eyebrow} title={title} subtitle={subtitle}>
                {children}
            </TerminalCardShell>
        </View>
    </View>
)

export const TerminalMetricGrid: React.FC<{
    items: ReadonlyArray<{
        key: string
        label: string
        value: string
        tone?: 'neutral' | 'ok' | 'warn'
    }>
}> = ({items}) => (
    <View
        style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        }}
    >
        {items.map(item => (
            <View
                key={item.key}
                testID={`ui-base-terminal-metric:${item.key}`}
                style={{
                    minWidth: 150,
                    flexGrow: 1,
                    borderRadius: 18,
                    backgroundColor:
                        item.tone === 'ok'
                            ? terminalConsolePalette.successBackground
                            : item.tone === 'warn'
                                ? '#fff7ed'
                                : terminalConsolePalette.surfaceSoft,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 6,
                }}
            >
                <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>{item.label}</Text>
                <Text style={{fontSize: 16, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>
                    {item.value}
                </Text>
            </View>
        ))}
    </View>
)

export const TerminalInfoList: React.FC<{
    items: ReadonlyArray<{
        key: string
        label: string
        value: string
    }>
}> = ({items}) => (
    <View style={{gap: 10}}>
        {items.map(item => (
            <View
                key={item.key}
                style={{
                    borderRadius: 16,
                    backgroundColor: terminalConsolePalette.surfaceSoft,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 4,
                }}
            >
                <Text style={{fontSize: 12, color: terminalConsolePalette.textMuted}}>{item.label}</Text>
                <Text selectable style={{fontSize: 15, fontWeight: '700', color: terminalConsolePalette.textPrimary}}>
                    {item.value}
                </Text>
            </View>
        ))}
    </View>
)

export const TerminalActionButton: React.FC<{
    testID?: string
    label: string
    disabled?: boolean
    onPress: () => void
}> = ({testID, label, disabled, onPress}) => {
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? 'runtime'
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'

    React.useEffect(() => {
        if (!automationBridge || !testID) {
            return undefined
        }
        return automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'terminal-console',
            mountId: `terminal-action:${testID}`,
            nodeId: testID,
            testID,
            semanticId: testID,
            role: 'button',
            text: label,
            visible: true,
            enabled: !disabled,
            persistent: true,
            availableActions: ['press'],
            onAutomationAction: () => {
                if (!disabled) {
                    onPress()
                }
                return {ok: !disabled}
            },
        })
    }, [automationBridge, automationRuntimeId, automationTarget, disabled, label, onPress, testID])

    return (
        <Pressable
            testID={testID}
            disabled={disabled}
            onPress={onPress}
            style={{
                minHeight: 52,
                borderRadius: 16,
                backgroundColor: disabled ? terminalConsolePalette.buttonDisabled : terminalConsolePalette.buttonPrimary,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 18,
            }}
        >
            <Text style={{fontSize: 16, fontWeight: '800', color: '#ffffff'}}>
                {label}
            </Text>
        </Pressable>
    )
}

export const TerminalInlineMessage: React.FC<{
    testID?: string
    tone?: 'info' | 'error' | 'success'
    message?: string
}> = ({testID, tone = 'info', message}) => {
    if (!message) {
        return null
    }

    const backgroundColor = tone === 'error'
        ? terminalConsolePalette.errorBackground
        : tone === 'success'
            ? terminalConsolePalette.successBackground
            : terminalConsolePalette.infoBackground
    const textColor = tone === 'error'
        ? terminalConsolePalette.errorText
        : tone === 'success'
            ? terminalConsolePalette.successText
            : terminalConsolePalette.infoText

    return (
        <View
            testID={testID}
            style={{
                borderRadius: 14,
                backgroundColor,
                paddingHorizontal: 14,
                paddingVertical: 12,
            }}
        >
            <Text style={{fontSize: 14, lineHeight: 20, color: textColor}}>
                {message}
            </Text>
        </View>
    )
}
