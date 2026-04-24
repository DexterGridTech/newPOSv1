import React, {useEffect, useState} from 'react'
import {
    createCommand,
    type KernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import type {
    AdminAppControlHost,
    AdminControlSnapshot,
} from '../../types'
import {adminConsoleCommandDefinitions} from '../../features/commands'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSectionUnavailable,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'

export interface AdminControlSectionProps {
    runtime?: KernelRuntimeV2
    host?: AdminAppControlHost
}

export const AdminControlSection: React.FC<AdminControlSectionProps> = ({
    runtime,
    host,
}) => {
    const [snapshot, setSnapshot] = useState<AdminControlSnapshot | undefined>()
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!host) {
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                setSnapshot(await host.getSnapshot())
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '控制状态读取失败')
            } finally {
                setLoading(false)
            }
        })()
    }, [host])

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:control"
                title="应用控制"
                message="APP 控制宿主能力未安装"
            />
        )
    }

    const runAction = (action: () => Promise<void>, successMessage?: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await action()
                setSnapshot(await host.getSnapshot())
                if (successMessage) {
                    setMessage(successMessage)
                }
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '宿主控制执行失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:control"
            title="应用控制"
            description="执行宿主级界面控制、空间切换、状态清理和应用重启。"
        >
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="全屏状态"
                    value={snapshot?.isFullScreen ? '已开启' : '已关闭'}
                    detail="控制系统栏和应用显示区域。"
                    tone={snapshot?.isFullScreen ? 'ok' : 'neutral'}
                />
                <AdminSummaryCard
                    label="锁定状态"
                    value={snapshot?.isAppLocked ? '已锁定' : '未锁定'}
                    detail="限制用户离开当前应用。"
                    tone={snapshot?.isAppLocked ? 'warn' : 'neutral'}
                />
                <AdminSummaryCard
                    label="当前空间"
                    value={snapshot?.selectedSpace ?? '未配置'}
                    detail="当前业务正在使用的服务器空间。"
                    tone={snapshot?.selectedSpace ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="可控能力"
                    value={[
                        snapshot?.supportsFullScreenControl ? '全屏' : undefined,
                        snapshot?.supportsLockControl ? '锁定' : undefined,
                        snapshot?.supportsClearCache ? '清缓存' : undefined,
                        snapshot?.supportsRestart ? '重启' : undefined,
                    ].filter(Boolean).join(' / ') || '仅支持状态查看'}
                    detail="当前宿主实际实现的管理能力。"
                    tone="primary"
                />
            </AdminSummaryGrid>
            <AdminSectionMessage message={message || undefined} />
            <AdminBlock
                title="界面控制"
                description="控制全屏和应用锁定等宿主界面行为。没有对应宿主实现的动作不会显示。"
            >
                <AdminActionGroup>
                    {host.setFullScreen ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:control:toggle-fullscreen"
                            label={snapshot?.isFullScreen ? '关闭全屏' : '开启全屏'}
                            disabled={loading}
                            onPress={() => runAction(
                                async () => host.setFullScreen?.(!snapshot?.isFullScreen),
                                snapshot?.isFullScreen ? '已关闭全屏' : '已开启全屏',
                            )}
                        />
                    ) : null}
                    {host.setAppLocked ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:control:toggle-lock"
                            label={snapshot?.isAppLocked ? '解除锁定' : '锁定应用'}
                            disabled={loading}
                            onPress={() => runAction(
                                async () => host.setAppLocked?.(!snapshot?.isAppLocked),
                                snapshot?.isAppLocked ? '已解除应用锁定' : '已锁定应用',
                            )}
                        />
                    ) : null}
                </AdminActionGroup>
            </AdminBlock>
            {snapshot?.availableSpaces?.length ? (
                <AdminBlock
                    title="空间切换"
                    description="切换当前应用所使用的服务器空间。切换后后续网络请求会命中新空间配置。"
                >
                    <AdminActionGroup>
                        {snapshot.availableSpaces.map(space => (
                            <AdminActionButton
                                key={space}
                                testID={`ui-base-admin-section:control:switch-space:${space}`}
                                label={
                                    space === snapshot.selectedSpace
                                        ? `当前空间：${space}`
                                        : `切换到 ${space}`
                                }
                                disabled={loading || !runtime || !host.restartApp || space === snapshot.selectedSpace}
                                onPress={() => runAction(
                                    async () => {
                                        if (!runtime) {
                                            throw new Error('Runtime command dispatcher is unavailable')
                                        }
                                        const result = await runtime.dispatchCommand(createCommand(
                                            adminConsoleCommandDefinitions.switchServerSpace,
                                            {selectedSpace: space},
                                        ))
                                        if (result.status !== 'COMPLETED') {
                                            throw new Error(result.actorResults[0]?.error?.message ?? '空间切换失败')
                                        }
                                        setSnapshot(await host.getSnapshot())
                                    },
                                    `已切换到 ${space} 空间`,
                                )}
                            />
                        ))}
                    </AdminActionGroup>
                </AdminBlock>
            ) : null}
            <AdminBlock
                title="数据与应用"
                description="高风险操作集中放在这里，避免与普通切换动作混在一起。清空缓存会清除本机持久化状态，重启用于触发整机运行态重新装载。"
            >
                <AdminActionGroup>
                    {host.clearCache ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:control:clear-cache"
                            label="清空缓存"
                            tone="danger"
                            disabled={loading}
                            onPress={() => runAction(
                                async () => host.clearCache?.(),
                                '已清空本地缓存',
                            )}
                        />
                    ) : null}
                    {host.restartApp ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:control:restart"
                            label="重启应用"
                            tone="danger"
                            disabled={loading}
                            onPress={() => runAction(
                                async () => host.restartApp?.(),
                                '已发出应用重启指令',
                            )}
                        />
                    ) : null}
                </AdminActionGroup>
            </AdminBlock>
        </AdminSectionShell>
    )
}
