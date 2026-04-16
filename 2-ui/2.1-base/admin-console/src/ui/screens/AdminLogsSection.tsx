import React, {useEffect, useState} from 'react'
import {Text, View} from 'react-native'
import type {AdminLogFileSummary, AdminLogHost} from '../../types'
import {getAdminHostTools} from '../../supports/adminHostToolsRegistry'
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

export interface AdminLogsSectionProps {
    host?: AdminLogHost
}

export const AdminLogsSection: React.FC<AdminLogsSectionProps> = ({
    host = getAdminHostTools().logs,
}) => {
    const [files, setFiles] = useState<readonly AdminLogFileSummary[]>([])
    const [directoryPath, setDirectoryPath] = useState<string | undefined>()
    const [content, setContent] = useState('')
    const [selectedFileName, setSelectedFileName] = useState<string>()
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
                const [nextFiles, nextDirectoryPath] = await Promise.all([
                    host.listFiles(),
                    host.getDirectoryPath(),
                ])
                setFiles(nextFiles)
                setDirectoryPath(nextDirectoryPath)
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '日志列表读取失败')
            } finally {
                setLoading(false)
            }
        })()
    }, [host])

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:logs"
                title="日志"
                message="日志宿主能力未安装"
            />
        )
    }

    const refresh = () => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const [nextFiles, nextDirectoryPath] = await Promise.all([
                    host.listFiles(),
                    host.getDirectoryPath(),
                ])
                setFiles(nextFiles)
                setDirectoryPath(nextDirectoryPath)
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '日志列表刷新失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    const handleOpen = (fileName: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                setContent(await host.readFile(fileName))
                setSelectedFileName(fileName)
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '日志内容读取失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    const handleDelete = (fileName: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await host.deleteFile(fileName)
                if (selectedFileName === fileName) {
                    setSelectedFileName(undefined)
                    setContent('')
                }
                const nextFiles = await host.listFiles()
                setFiles(nextFiles)
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '日志删除失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    const handleClear = () => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await host.clearAll()
                setFiles([])
                setSelectedFileName(undefined)
                setContent('')
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '日志清理失败')
            } finally {
                setLoading(false)
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
                    onPress={refresh}
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
                    <Text selectable>{content}</Text>
                </AdminBlock>
            ) : null}
        </AdminSectionShell>
    )
}
