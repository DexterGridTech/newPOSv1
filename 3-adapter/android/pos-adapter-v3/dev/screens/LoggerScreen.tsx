import React, {useState, useCallback} from 'react'
import {
    View, Text, ScrollView, Pressable, TextInput,
    StyleSheet, ActivityIndicator, FlatList,
} from 'react-native'
import type {LogFile} from '../../src/foundations/logger'
import {C} from '../theme'
import {logger} from "@impos2/kernel-core-base";

type Tab = 'write' | 'files' | 'upload'
type LogLevel = 'debug' | 'log' | 'warn' | 'error'

interface LogEntry {
    id: string
    level: LogLevel
    tags: string
    message: string
    data: string
    result: 'ok' | 'error'
    ts: number
}

const LEVELS: LogLevel[] = ['debug', 'log', 'warn', 'error']

const LEVEL_COLOR: Record<LogLevel, string> = {
    debug: C.info,
    log: C.accent,
    warn: C.warn,
    error: C.danger,
}

export default function LoggerScreen() {
    const [tab, setTab] = useState<Tab>('write')

    return (
        <View style={s.root}>
            <View style={s.header}>
                <View>
                    <Text style={s.headerTitle}>Logger</Text>
                    <Text style={s.headerSubtitle}>日志管理与上传</Text>
                </View>
                <View style={s.tabs}>
                    {(['write', 'files', 'upload'] as Tab[]).map(t => (
                        <Pressable
                            key={t}
                            style={({pressed}) => [
                                s.tab,
                                tab === t && s.tabActive,
                                pressed && s.tabPressed
                            ]}
                            onPress={() => setTab(t)}>
                            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                                {t === 'write' ? '写入' : t === 'files' ? '文件' : '上传'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {tab === 'write' && <WritePanel />}
            {tab === 'files' && <FilesPanel />}
            {tab === 'upload' && <UploadPanel />}
        </View>
    )
}

// ─── Write Panel ─────────────────────────────────────────────────────────────

function WritePanel() {
    const [level, setLevel] = useState<LogLevel>('log')
    const [tags, setTags] = useState('pos.test')
    const [message, setMessage] = useState('Hello Logger')
    const [data, setData] = useState('')
    const [history, setHistory] = useState<LogEntry[]>([])

    const send = useCallback(() => {
        const parsedData = data.trim()
            ? (() => { try { return JSON.parse(data) } catch { return data } })()
            : undefined
        try {
            logger[level](tags.split('.'), message, parsedData)
            setHistory(h => [{
                id: String(Date.now()),
                level, tags, message, data,
                result: 'ok' as const,
                ts: Date.now(),
            }, ...h].slice(0, 50))
        } catch (e) {
            setHistory(h => [{
                id: String(Date.now()),
                level, tags, message, data,
                result: 'error' as const,
                ts: Date.now(),
            }, ...h].slice(0, 50))
        }
    }, [level, tags, message, data])

    return (
        <View style={s.panel}>
            <View style={s.row}>
                {LEVELS.map(l => (
                    <Pressable
                        key={l}
                        style={({pressed}) => [
                            s.levelBtn,
                            level === l && {backgroundColor: LEVEL_COLOR[l] + '22', borderColor: LEVEL_COLOR[l]},
                            pressed && {opacity: 0.7}
                        ]}
                        onPress={() => setLevel(l)}>
                        <Text style={[s.levelText, {color: LEVEL_COLOR[l]}]}>{l}</Text>
                    </Pressable>
                ))}
            </View>

            <Field label="Tags" value={tags} onChangeText={setTags} placeholder="pos.module.action" />
            <Field label="Message" value={message} onChangeText={setMessage} placeholder="日志内容" />
            <Field label="Data (JSON)" value={data} onChangeText={setData} placeholder='{"key":"value"}' multiline />

            <Pressable
                style={({pressed}) => [s.sendBtn, pressed && {opacity: 0.8}]}
                onPress={send}>
                <Text style={s.sendText}>发送日志</Text>
            </Pressable>

            {history.length > 0 && (
                <FlatList
                    data={history}
                    keyExtractor={i => i.id}
                    style={s.history}
                    renderItem={({item}) => (
                        <View style={s.historyItem}>
                            <View style={[s.dot, {backgroundColor: item.result === 'ok' ? LEVEL_COLOR[item.level] : C.danger}]} />
                            <Text style={s.historyLevel}>{item.level}</Text>
                            <Text style={s.historyTag}>[{item.tags}]</Text>
                            <Text style={s.historyMsg} numberOfLines={1}>{item.message}</Text>
                        </View>
                    )}
                />
            )}
        </View>
    )
}

// ─── Files Panel ─────────────────────────────────────────────────────────────

function FilesPanel() {
    const [files, setFiles] = useState<LogFile[]>([])
    const [loading, setLoading] = useState(false)
    const [content, setContent] = useState<string | null>(null)
    const [dirPath, setDirPath] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setContent(null)
        setStatus(null)
        try {
            const list = await logger.getLogFiles()
            setFiles(list)
        } catch (e: any) {
            setStatus(`获取失败: ${e?.message ?? e}`)
        } finally {
            setLoading(false)
        }
    }, [])

    const viewContent = useCallback(async (fileName: string) => {
        setLoading(true)
        setStatus(null)
        try {
            const text = await logger.getLogContent(fileName)
            setContent(text)
        } catch (e: any) {
            setStatus(`读取失败: ${e?.message ?? e}`)
        } finally {
            setLoading(false)
        }
    }, [])

    const deleteFile = useCallback(async (fileName: string) => {
        setLoading(true)
        try {
            await logger.deleteLogFile(fileName)
            setStatus(`已删除: ${fileName}`)
            setFiles(f => f.filter(x => x.fileName !== fileName))
        } catch (e: any) {
            setStatus(`删除失败: ${e?.message ?? e}`)
        } finally {
            setLoading(false)
        }
    }, [])

    const clearAll = useCallback(async () => {
        setLoading(true)
        try {
            await logger.clearAllLogs()
            setFiles([])
            setContent(null)
            setStatus('已清空所有日志')
        } catch (e: any) {
            setStatus(`清空失败: ${e?.message ?? e}`)
        } finally {
            setLoading(false)
        }
    }, [])

    const getDir = useCallback(async () => {
        try {
            const p = await logger.getLogDirPath()
            setDirPath(p)
        } catch (e: any) {
            setStatus(`获取路径失败: ${e?.message ?? e}`)
        }
    }, [])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            <View style={s.row}>
                <ActionBtn label="刷新列表" onPress={load} />
                <ActionBtn label="清空全部" onPress={clearAll} danger />
                <ActionBtn label="日志目录" onPress={getDir} />
            </View>

            {loading && <ActivityIndicator color={C.accent} style={{marginVertical: 12}} />}

            {dirPath && <Text style={s.dirPath}>{dirPath}</Text>}
            {status && <Text style={s.statusText}>{status}</Text>}

            {files.map(f => (
                <View key={f.fileName} style={s.fileRow}>
                    <View style={s.fileInfo}>
                        <Text style={s.fileName}>{f.fileName}</Text>
                        <Text style={s.fileMeta}>{(f.fileSize / 1024).toFixed(1)} KB</Text>
                    </View>
                    <View style={s.fileActions}>
                        <Pressable
                            style={({pressed}) => [s.fileBtn, pressed && {opacity: 0.7}]}
                            onPress={() => viewContent(f.fileName)}>
                            <Text style={s.fileBtnText}>查看</Text>
                        </Pressable>
                        <Pressable
                            style={({pressed}) => [s.fileBtn, s.fileBtnDanger, pressed && {opacity: 0.7}]}
                            onPress={() => deleteFile(f.fileName)}>
                            <Text style={[s.fileBtnText, {color: C.danger}]}>删除</Text>
                        </Pressable>
                    </View>
                </View>
            ))}

            {content != null && (
                <View style={s.contentBox}>
                    <View style={s.contentHeader}>
                        <Text style={s.contentTitle}>文件内容</Text>
                        <Pressable onPress={() => setContent(null)}>
                            <Text style={s.closeBtn}>关闭</Text>
                        </Pressable>
                    </View>
                    <ScrollView style={s.contentScroll} nestedScrollEnabled>
                        <Text style={s.contentText}>{content}</Text>
                    </ScrollView>
                </View>
            )}
        </ScrollView>
    )
}

// ─── Upload Panel ────────────────────────────────────────────────────────────

function UploadPanel() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [serverURL, setServerURL] = useState('https://example.com/api/logs')
    const [params, setParams] = useState('{}')
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    const upload = useCallback(async () => {
        setUploading(true)
        setResult(null)
        try {
            const dateObj = new Date(date)
            const paramsObj = JSON.parse(params)
            const success = await logger.sendLogFileToServer(dateObj, serverURL, paramsObj)
            setResult(success ? '✅ 上传成功' : '❌ 上传失败')
        } catch (e: any) {
            setResult(`❌ 上传失败: ${e?.message ?? e}`)
        } finally {
            setUploading(false)
        }
    }, [date, serverURL, params])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            <Field
                label="日期 (YYYY-MM-DD)"
                value={date}
                onChangeText={setDate}
                placeholder="2024-03-01"
            />
            <Field
                label="服务器 URL"
                value={serverURL}
                onChangeText={setServerURL}
                placeholder="https://example.com/api/logs"
            />
            <Field
                label="额外参数 (JSON)"
                value={params}
                onChangeText={setParams}
                placeholder='{"deviceId":"xxx","userId":"yyy"}'
                multiline
            />

            <Pressable
                style={({pressed}) => [
                    s.uploadBtn,
                    uploading && s.uploadBtnDisabled,
                    pressed && !uploading && {opacity: 0.8}
                ]}
                onPress={upload}
                disabled={uploading}>
                <Text style={s.uploadBtnText}>
                    {uploading ? '上传中...' : '上传日志文件'}
                </Text>
            </Pressable>

            {uploading && <ActivityIndicator color={C.accent} style={{marginTop: 16}} />}

            {result && (
                <View style={[s.resultBox, result.startsWith('✅') ? s.resultSuccess : s.resultError]}>
                    <Text style={s.resultText}>{result}</Text>
                </View>
            )}

            <View style={s.infoBox}>
                <Text style={s.infoTitle}>📝 说明</Text>
                <Text style={s.infoText}>• 日期格式: YYYY-MM-DD (如 2024-03-01)</Text>
                <Text style={s.infoText}>• 将上传指定日期的日志文件到服务器</Text>
                <Text style={s.infoText}>• 额外参数会合并到请求 body 中</Text>
                <Text style={s.infoText}>• 请求方式: POST application/json</Text>
            </View>
        </ScrollView>
    )
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Field({label, value, onChangeText, placeholder, multiline}: {
    label: string
    value: string
    onChangeText: (v: string) => void
    placeholder?: string
    multiline?: boolean
}) {
    return (
        <View style={s.field}>
            <Text style={s.fieldLabel}>{label}</Text>
            <TextInput
                style={[s.input, multiline && {height: 72, textAlignVertical: 'top'}]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={C.textMuted}
                multiline={multiline}
            />
        </View>
    )
}

function ActionBtn({label, onPress, danger}: {label: string; onPress: () => void; danger?: boolean}) {
    return (
        <Pressable
            style={({pressed}) => [
                s.actionBtn,
                danger && s.actionBtnDanger,
                pressed && {opacity: 0.7}
            ]}
            onPress={onPress}>
            <Text style={[s.actionBtnText, danger && {color: C.danger}]}>{label}</Text>
        </Pressable>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: {flex: 1, backgroundColor: C.bgPage},
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: C.bgCard,
    },
    headerTitle: {fontSize: 18, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.5},
    headerSubtitle: {fontSize: 12, color: C.textMuted, marginTop: 2},
    tabs: {flexDirection: 'row', backgroundColor: C.bgSub, borderRadius: 8, padding: 3},
    tab: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6},
    tabActive: {
        backgroundColor: C.bgCard,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tabPressed: {opacity: 0.7},
    tabText: {fontSize: 12, color: C.textMuted, fontWeight: '500'},
    tabTextActive: {color: C.textPrimary, fontWeight: '600'},
    panel: {flex: 1, padding: 16},
    row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
    levelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.bgCard,
    },
    levelText: {fontSize: 12, fontWeight: '600', letterSpacing: 0.5},
    field: {marginBottom: 10},
    fieldLabel: {
        fontSize: 11,
        color: C.textSecondary,
        marginBottom: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: C.bgCard,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: C.textPrimary,
        fontSize: 13,
        height: 42,
    },
    sendBtn: {
        backgroundColor: C.accent,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    sendText: {color: C.textInverse, fontWeight: '700', fontSize: 14},
    history: {maxHeight: 240},
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: C.bgSub,
        gap: 6,
    },
    dot: {width: 6, height: 6, borderRadius: 3},
    historyLevel: {fontSize: 11, fontWeight: '600', color: C.textSecondary, width: 36},
    historyTag: {fontSize: 11, color: C.textMuted, width: 80},
    historyMsg: {fontSize: 12, color: C.textSecondary, flex: 1},
    actionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: C.bgCard,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    actionBtnDanger: {borderColor: C.dangerBg},
    actionBtnText: {fontSize: 12, color: C.textSecondary, fontWeight: '500'},
    dirPath: {
        fontSize: 11,
        color: C.accentText,
        backgroundColor: C.accentBg,
        padding: 10,
        borderRadius: 6,
        marginBottom: 10,
        fontFamily: 'monospace',
    },
    statusText: {fontSize: 12, color: C.warn, marginBottom: 10},
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.bgCard,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    fileInfo: {flex: 1},
    fileName: {fontSize: 13, color: C.textPrimary, fontFamily: 'monospace'},
    fileMeta: {fontSize: 11, color: C.textMuted, marginTop: 2},
    fileActions: {flexDirection: 'row', gap: 8},
    fileBtn: {paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.bgSub, borderRadius: 6},
    fileBtnDanger: {backgroundColor: C.dangerBg},
    fileBtnText: {fontSize: 12, color: C.textSecondary},
    contentBox: {
        backgroundColor: C.bgCard,
        borderRadius: 8,
        marginTop: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.bgSub,
    },
    contentTitle: {fontSize: 13, color: C.textPrimary, fontWeight: '600'},
    closeBtn: {fontSize: 12, color: C.textMuted},
    contentScroll: {maxHeight: 300},
    contentText: {
        fontSize: 11,
        color: C.textSecondary,
        padding: 12,
        fontFamily: 'monospace',
        lineHeight: 18,
    },
    uploadBtn: {
        backgroundColor: C.info,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    uploadBtnDisabled: {backgroundColor: C.textMuted, opacity: 0.5},
    uploadBtnText: {color: C.textInverse, fontWeight: '700', fontSize: 14},
    resultBox: {
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
    },
    resultSuccess: {
        backgroundColor: C.successBg,
        borderColor: C.success,
    },
    resultError: {
        backgroundColor: C.dangerBg,
        borderColor: C.danger,
    },
    resultText: {fontSize: 13, fontWeight: '500'},
    infoBox: {
        backgroundColor: C.infoBg,
        borderRadius: 8,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: C.info,
    },
    infoTitle: {fontSize: 13, fontWeight: '600', color: C.info, marginBottom: 8},
    infoText: {fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 4},
})

