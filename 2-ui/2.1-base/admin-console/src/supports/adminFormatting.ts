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
        embedded: '内置包',
        'hot-update': '热更新包',
        rollback: '回滚包',
        'desired-received': '已接收期望版本',
        'compatibility-rejected': '兼容性拒绝',
        'download-pending': '等待下载',
        downloading: '下载中',
        ready: '已就绪',
        failed: '失败',
        applying: '应用中',
        applied: '已应用',
        'desired-cleared': '已清空期望版本',
        paused: '已暂停',
        'package-pruned': '已清理包',
        'version-reported': '已上报版本',
        'restart-pending': '等待重启',
        'restart-waiting-idle': '等待空闲重启',
        'restart-preparing': '准备重启',
        'restart-ready': '可重启',
        pending: '等待中',
        'waiting-idle': '等待空闲',
        preparing: '准备中',
        'ready-to-restart': '可重启',
        immediate: '立即',
        idle: '空闲',
        'next-launch': '下次启动',
        manual: '手动',
        active: '生效中',
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
