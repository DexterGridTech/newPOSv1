import {formatTimestampMs, type TimestampMs} from '@impos2/kernel-base-contracts'

const activationStatusLabels = {
    UNACTIVATED: '未激活',
    ACTIVATING: '激活中',
    ACTIVATED: '已激活',
    FAILED: '激活失败',
} as const

const credentialStatusLabels = {
    EMPTY: '未下发',
    READY: '已就绪',
    REFRESHING: '刷新中',
    EXPIRED: '已过期',
} as const

export const formatTerminalActivationStatus = (status: string): string =>
    activationStatusLabels[status as keyof typeof activationStatusLabels] ?? status

export const formatTerminalCredentialStatus = (status?: string): string => {
    if (!status) {
        return '未下发'
    }
    return credentialStatusLabels[status as keyof typeof credentialStatusLabels] ?? status
}

export const formatTerminalTimestamp = (
    value?: TimestampMs | number,
    fallback = '未记录',
): string => {
    if (!value || Number.isNaN(Number(value))) {
        return fallback
    }
    return formatTimestampMs(Number(value) as TimestampMs)
}
