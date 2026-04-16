import React from 'react'
import {Pressable, Text, View} from 'react-native'

export const TerminalScreenShell: React.FC<{
    testID: string
    title: string
    subtitle: string
    badge?: string
    children: React.ReactNode
}> = ({testID, title, subtitle, badge, children}) => (
    <View
        testID={testID}
        style={{
            flex: 1,
            backgroundColor: '#edf4fb',
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
                borderRadius: 28,
                borderWidth: 1,
                borderColor: '#d9e3ef',
                backgroundColor: '#ffffff',
                padding: 24,
                gap: 20,
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            }}
        >
            <View style={{gap: 10}}>
                {badge ? (
                    <View
                        style={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            backgroundColor: '#e0f2fe',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                        }}
                    >
                        <Text style={{fontSize: 12, fontWeight: '700', color: '#075985'}}>
                            {badge}
                        </Text>
                    </View>
                ) : null}
                <Text style={{fontSize: 28, fontWeight: '800', color: '#0f172a'}}>
                    {title}
                </Text>
                <Text style={{fontSize: 15, lineHeight: 22, color: '#526072'}}>
                    {subtitle}
                </Text>
            </View>
            {children}
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
                            ? '#ecfdf5'
                            : item.tone === 'warn'
                                ? '#fff7ed'
                                : '#f8fafc',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 6,
                }}
            >
                <Text style={{fontSize: 12, color: '#7a8aa0'}}>{item.label}</Text>
                <Text style={{fontSize: 16, fontWeight: '700', color: '#0f172a'}}>
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
                    backgroundColor: '#f8fafc',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 4,
                }}
            >
                <Text style={{fontSize: 12, color: '#7a8aa0'}}>{item.label}</Text>
                <Text selectable style={{fontSize: 15, fontWeight: '700', color: '#0f172a'}}>
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
}> = ({testID, label, disabled, onPress}) => (
    <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        style={{
            minHeight: 52,
            borderRadius: 16,
            backgroundColor: disabled ? '#cbd5e1' : '#0b5fff',
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

export const TerminalInlineMessage: React.FC<{
    testID?: string
    tone?: 'info' | 'error' | 'success'
    message?: string
}> = ({testID, tone = 'info', message}) => {
    if (!message) {
        return null
    }

    const backgroundColor = tone === 'error'
        ? '#fef2f2'
        : tone === 'success'
            ? '#ecfdf5'
            : '#eff6ff'
    const textColor = tone === 'error'
        ? '#b91c1c'
        : tone === 'success'
            ? '#047857'
            : '#1d4ed8'

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
