import React, {useCallback, useState} from 'react'
import {Text, View} from 'react-native'
import type {AdminLogFileSummary, AdminLogHost} from '../../types'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminDetailList,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSectionUnavailable,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import {
    useAdminMountedRef,
    useAdminRefreshWhileScreenActive,
} from './useAdminScreenActivity'

export interface AdminLogsSectionProps {
    host?: AdminLogHost
}

export const AdminLogsSection: React.FC<AdminLogsSectionProps> = ({
    host,
}) => {
    const mountedRef = useAdminMountedRef()
    const [files, setFiles] = useState<readonly AdminLogFileSummary[]>([])
    const [directoryPath, setDirectoryPath] = useState<string | undefined>()
    const [content, setContent] = useState('')
    const [selectedFileName, setSelectedFileName] = useState<string>()
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const refresh = useCallback((errorMessage: string) => {
        if (!host) {
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const [nextFiles, nextDirectoryPath] = await Promise.all([
                    host.listFiles(),
                    host.getDirectoryPath(),
                ])
                if (mountedRef.current) {
                    setFiles(nextFiles)
                    setDirectoryPath(nextDirectoryPath)
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : errorMessage)
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }, [host, mountedRef])

    useAdminRefreshWhileScreenActive(
        () => refresh('日志列表刷新失败'),
        host ? 'host-ready' : 'host-missing',
    )

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:logs"
                title="日志"
                message="日志宿主能力未安装"
            />
        )
    }

    const handleOpen = (fileName: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const nextContent = await host.readFile(fileName)
                if (mountedRef.current) {
                    setContent(nextContent)
                    setSelectedFileName(fileName)
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : '日志内容读取失败')
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }

    const handleDelete = (fileName: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await host.deleteFile(fileName)
                if (mountedRef.current && selectedFileName === fileName) {
                    setSelectedFileName(undefined)
                    setContent('')
                }
                const nextFiles = await host.listFiles()
                if (mountedRef.current) {
                    setFiles(nextFiles)
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : '日志删除失败')
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }

    const handleClear = () => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await host.clearAll()
                if (mountedRef.current) {
                    setFiles([])
                    setSelectedFileName(undefined)
                    setContent('')
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : '日志清理失败')
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:logs"
            title="日志"
            description="查看日志目录、日志文件列表，并执行读取、删除和清空操作。"
        >
            <AdminActionGroup>
                <AdminActionButton
                    testID="ui-base-admin-section:logs:refresh"
                    label={loading ? '刷新中' : '刷新日志'}
                    tone="primary"
                    disabled={loading}
                    onPress={() => refresh('日志列表刷新失败')}
                />
                <AdminActionButton
                    testID="ui-base-admin-section:logs:clear"
                    label="清空全部"
                    tone="danger"
                    disabled={loading}
                    onPress={handleClear}
                />
            </AdminActionGroup>
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="日志目录"
                    value={directoryPath ?? '未提供'}
                    detail="日志文件所在目录。"
                    tone={directoryPath ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="日志文件数"
                    value={`${files.length}`}
                    detail="当前目录下可读取的日志文件数量。"
                    tone={files.length > 0 ? 'ok' : 'neutral'}
                />
                <AdminSummaryCard
                    label="当前查看"
                    value={selectedFileName ?? '未选择'}
                    detail="当前打开的日志文件。"
                    tone={selectedFileName ? 'primary' : 'neutral'}
                />
            </AdminSummaryGrid>
            <AdminSectionMessage message={message || undefined} />
            {files.map((file, index) => (
                <AdminBlock
                    key={file.fileName}
                    title={file.fileName}
                    description="单个日志文件的读取与删除操作。"
                >
                    <AdminSummaryGrid>
                        <AdminSummaryCard
                            label="文件大小"
                            value={`${file.fileSizeBytes ?? 0}`}
                            detail="日志文件字节大小。"
                            tone="neutral"
                        />
                    </AdminSummaryGrid>
                    <AdminActionGroup>
                        <AdminActionButton
                            testID={`ui-base-admin-section:logs:open:${index}`}
                            label="查看内容"
                            disabled={loading}
                            onPress={() => handleOpen(file.fileName)}
                        />
                        <AdminActionButton
                            testID={`ui-base-admin-section:logs:delete:${index}`}
                            label="删除文件"
                            tone="danger"
                            disabled={loading}
                            onPress={() => handleDelete(file.fileName)}
                        />
                    </AdminActionGroup>
                </AdminBlock>
            ))}
            {content ? (
                <AdminBlock
                    title={selectedFileName ?? '日志内容'}
                    description="当前文件的原始日志内容。"
                >
                    <AdminDetailList
                        items={[
                            {
                                key: 'log-content',
                                label: '日志内容',
                                value: content,
                            },
                        ]}
                    />
                    <Text selectable>{content}</Text>
                </AdminBlock>
            ) : null}
        </AdminSectionShell>
    )
}
