import React from 'react'
import {Text, View} from 'react-native'
import {useTerminalConnectionSummary} from '../../hooks/useTerminalConnectionSummary'
import {
    formatTerminalActivationStatus,
    formatTerminalCredentialStatus,
    formatTerminalTimestamp,
} from '../../supports/terminalFormatting'
import {
    TerminalInfoList,
    TerminalMetricGrid,
    TerminalScreenShell,
} from '../components/TerminalSectionPrimitives'

export const TerminalSummaryScreen: React.FC = () => {
    const summary = useTerminalConnectionSummary()
    const isActivated = summary.status === 'ACTIVATED'

    return (
        <TerminalScreenShell
            testID="ui-base-terminal-summary"
            badge={isActivated ? '已接入平台' : '待激活'}
            title="终端摘要"
            subtitle="终端 UI 只负责展示当前接入状态和必要的终端上下文，不承接跨模块业务编排。"
        >
            <TerminalMetricGrid
                items={[
                    {
                        key: 'activation-status',
                        label: '激活状态',
                        value: formatTerminalActivationStatus(summary.status),
                        tone: isActivated ? 'ok' : 'warn',
                    },
                    {
                        key: 'credential-status',
                        label: '凭证状态',
                        value: formatTerminalCredentialStatus(summary.credentialStatus),
                        tone: summary.credentialStatus === 'READY' ? 'ok' : 'warn',
                    },
                ]}
            />

            <TerminalInfoList
                items={[
                    {
                        key: 'terminal-id',
                        label: '终端 ID',
                        value: summary.terminalId ?? '未激活',
                    },
                    {
                        key: 'device-id',
                        label: '设备 ID',
                        value: summary.deviceId ?? '未记录',
                    },
                    {
                        key: 'device-model',
                        label: '设备型号',
                        value: summary.deviceModel ?? '未记录',
                    },
                    {
                        key: 'activated-at',
                        label: '激活时间',
                        value: formatTerminalTimestamp(summary.activatedAt),
                    },
                    {
                        key: 'credential-updated-at',
                        label: '凭证更新时间',
                        value: formatTerminalTimestamp(summary.updatedAt),
                    },
                    {
                        key: 'credential-expire-at',
                        label: '凭证过期时间',
                        value: formatTerminalTimestamp(summary.expiresAt),
                    },
                ]}
            />

            <View
                style={{
                    borderRadius: 16,
                    backgroundColor: '#f8fafc',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 6,
                }}
            >
                <Text style={{fontSize: 12, color: '#7a8aa0'}}>摘要说明</Text>
                <Text
                    testID="ui-base-terminal-summary:description"
                    style={{fontSize: 14, lineHeight: 22, color: '#334155'}}
                >
                    {isActivated
                        ? '终端已完成激活，后续业务包可以基于终端号、凭证和绑定上下文继续初始化。'
                        : '终端尚未激活，当前仅允许进入激活流程和管理员控制台。'}
                </Text>
            </View>
        </TerminalScreenShell>
    )
}
