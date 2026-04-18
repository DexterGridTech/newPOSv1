import React from 'react'
import {Pressable, Text, View} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
} from '@impos2/ui-base-runtime-react'
import type {
    AdminDetailItem,
    AdminStatusItem,
    AdminStatusTone,
} from '../../types'

const toneTextMap: Record<AdminStatusTone, string> = {
    neutral: 'normal',
    ok: 'ok',
    warn: 'warn',
    error: 'error',
}

const formatAdminValue = (
    value: AdminDetailItem['value'],
): string => {
    if (value === undefined || value === null || value === '') {
        return '未提供'
    }
    if (typeof value === 'boolean') {
        return value ? '是' : '否'
    }
    return `${value}`
}

export const AdminSectionShell: React.FC<{
    testID: string
    title: string
    description?: string
    children: React.ReactNode
}> = ({testID, title, description, children}) => (
    <View
        testID={testID}
        style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: '#d7e1ec',
            backgroundColor: '#ffffff',
            padding: 18,
            gap: 16,
            boxShadow: '0px 14px 28px rgba(15, 23, 42, 0.08)',
        }}
    >
        <View style={{gap: 6}}>
            <Text style={{fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.8}}>
                ADMIN SECTION
            </Text>
            <Text style={{fontSize: 20, fontWeight: '800', color: '#0f172a'}}>{title}</Text>
            {description ? (
                <Text style={{fontSize: 13, color: '#526072', lineHeight: 20}}>{description}</Text>
            ) : null}
        </View>
        {children}
    </View>
)

export const AdminSummaryGrid: React.FC<{
    children: React.ReactNode
}> = ({children}) => (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
        {children}
    </View>
)

export const AdminSummaryCard: React.FC<{
    label: string
    value: string
    detail?: string
    tone?: 'primary' | 'ok' | 'warn' | 'danger' | 'neutral'
}> = ({label, value, detail, tone = 'neutral'}) => {
    const toneMap = {
        primary: {backgroundColor: '#eff6ff', borderColor: '#bfdbfe', valueColor: '#0b5fff'},
        ok: {backgroundColor: '#ecfdf5', borderColor: '#bbf7d0', valueColor: '#15803d'},
        warn: {backgroundColor: '#fff7ed', borderColor: '#fed7aa', valueColor: '#c2410c'},
        danger: {backgroundColor: '#fef2f2', borderColor: '#fecaca', valueColor: '#b91c1c'},
        neutral: {backgroundColor: '#f8fafc', borderColor: '#d7e1ec', valueColor: '#0f172a'},
    } as const
    const toneStyle = toneMap[tone]

    return (
        <View
            style={{
                minWidth: 160,
                flexGrow: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: toneStyle.borderColor,
                backgroundColor: toneStyle.backgroundColor,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 4,
            }}
        >
            <Text style={{fontSize: 12, color: '#64748b'}}>{label}</Text>
            <Text style={{fontSize: 17, fontWeight: '800', color: toneStyle.valueColor}}>
                {value}
            </Text>
            {detail ? (
                <Text style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
                    {detail}
                </Text>
            ) : null}
        </View>
    )
}

export const AdminBlock: React.FC<{
    title: string
    description?: string
    children: React.ReactNode
}> = ({title, description, children}) => (
    <View
        style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#d7e1ec',
            backgroundColor: '#f8fafc',
            padding: 14,
            gap: 12,
        }}
    >
        <View style={{gap: 4}}>
            <Text style={{fontSize: 15, color: '#0f172a', fontWeight: '800'}}>{title}</Text>
            {description ? (
                <Text style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
                    {description}
                </Text>
            ) : null}
        </View>
        {children}
    </View>
)

export const AdminActionGroup: React.FC<{
    children: React.ReactNode
}> = ({children}) => (
    <View style={{gap: 10, flexDirection: 'row', flexWrap: 'wrap'}}>
        {children}
    </View>
)

export const AdminSectionUnavailable: React.FC<{
    testID: string
    title: string
    message: string
}> = ({testID, title, message}) => (
    <AdminSectionShell testID={testID} title={title}>
        <Text testID={`${testID}:unavailable`} style={{color: '#7a8aa0'}}>{message}</Text>
    </AdminSectionShell>
)

export const AdminSectionMessage: React.FC<{
    message?: string
}> = ({message}) => message ? (
    <View
        style={{
            borderRadius: 12,
            backgroundColor: '#eff6ff',
            paddingHorizontal: 12,
            paddingVertical: 10,
        }}
    >
        <Text style={{color: '#163a74'}}>{message}</Text>
    </View>
) : null

export const AdminActionButton: React.FC<{
    testID?: string
    label: string
    tone?: 'primary' | 'secondary' | 'danger'
    disabled?: boolean
    onPress: () => void
}> = ({testID, label, tone = 'secondary', disabled, onPress}) => {
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? 'runtime'
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const toneMap = {
        primary: {
            borderColor: '#0b5fff',
            backgroundColor: '#0b5fff',
            textColor: '#ffffff',
        },
        secondary: {
            borderColor: '#bfd2e8',
            backgroundColor: '#eff6ff',
            textColor: '#0b5fff',
        },
        danger: {
            borderColor: '#fecaca',
            backgroundColor: '#fff1f2',
            textColor: '#b91c1c',
        },
    } as const
    const toneStyle = toneMap[tone]

    React.useEffect(() => {
        if (!automationBridge || !testID) {
            return undefined
        }
        return automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'admin-console',
            mountId: `admin-action:${testID}`,
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
                minHeight: 42,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: disabled ? '#d7e1ec' : toneStyle.borderColor,
                backgroundColor: disabled ? '#f8fafc' : toneStyle.backgroundColor,
                paddingHorizontal: 14,
                paddingVertical: 10,
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 120,
            }}
        >
            <Text style={{color: disabled ? '#94a3b8' : toneStyle.textColor, fontWeight: '700'}}>{label}</Text>
        </Pressable>
    )
}

export const AdminDetailList: React.FC<{
    items: readonly AdminDetailItem[]
}> = ({items}) => (
    <View style={{gap: 10}}>
        {items.map(item => (
            <View
                key={item.key}
                style={{
                    borderRadius: 14,
                    backgroundColor: '#f7fafc',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 4,
                }}
            >
                <Text style={{fontSize: 12, color: '#7a8aa0'}}>{item.label}</Text>
                <Text selectable style={{fontSize: 15, color: '#0f172a', fontWeight: '600'}}>
                    {formatAdminValue(item.value)}
                </Text>
            </View>
        ))}
    </View>
)

export const AdminStatusList: React.FC<{
    items: readonly AdminStatusItem[]
}> = ({items}) => (
    <View style={{gap: 10}}>
        {items.map(item => (
            <View
                key={item.key}
                style={{
                    borderRadius: 14,
                    backgroundColor: '#f7fafc',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 4,
                }}
            >
                <Text style={{fontSize: 12, color: '#7a8aa0'}}>{item.label}</Text>
                <Text style={{fontSize: 15, color: '#0f172a', fontWeight: '600'}}>
                    {item.value ?? toneTextMap[item.tone ?? 'neutral']}
                </Text>
                {item.detail ? <Text selectable style={{color: '#526072'}}>{item.detail}</Text> : null}
            </View>
        ))}
    </View>
)
