import {formatTimestampMs, type TimestampMs} from '@next/kernel-base-contracts'
import type {AdapterDiagnosticStatus} from '../types'

export const formatAdminTimestamp = (
    value?: TimestampMs | number,
): string => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return '未记录'
    }
    return formatTimestampMs(value as TimestampMs)
}

export const formatAdminStatus = (
    value?: string,
): string => {
    if (!value) {
        return '未知'
    }
    const labels: Record<string, string> = {
        ACTIVATED: '已激活',
        UNACTIVATED: '未激活',
        READY: '可用',
        EMPTY: '未写入',
        EXPIRED: '已过期',
        REFRESHING: '刷新中',
        MASTER: '主机',
        SLAVE: '副机',
        PRIMARY: '主屏',
        SECONDARY: '副屏',
        CONNECTED: '已连接',
        CONNECTING: '连接中',
        DISCONNECTED: '未连接',
        MAIN: '主工作区',
        BRANCH: '分支工作区',
    }
    return labels[value] ?? value
}

export const formatAdapterDiagnosticStatus = (
    status?: AdapterDiagnosticStatus,
): string => {
    const labels: Record<AdapterDiagnosticStatus, string> = {
        idle: '未执行',
        running: '执行中',
        passed: '通过',
        failed: '失败',
        skipped: '跳过',
    }
    return labels[status ?? 'idle']
}
