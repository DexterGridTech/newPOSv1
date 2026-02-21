import React, {useState, useCallback} from 'react'
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    FlatList,
} from 'react-native'
import {loggerAdapter, LogFile} from '../../src/foundations/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'write' | 'files'
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

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVELS: LogLevel[] = ['debug', 'log', 'warn', 'error']

const LEVEL_COLOR: Record<LogLevel, string> = {
    debug: '#64748B',
    log:   '#22C55E',
    warn:  '#F59E0B',
    error: '#EF4444',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoggerScreen() {
    const [tab, setTab] = useState<Tab>('write')

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>Logger</Text>
                <View style={s.tabs}>
                    {(['write', 'files'] as Tab[]).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[s.tab, tab === t && s.tabActive]}
                            onPress={() => setTab(t)}>
                            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                                {t === 'write' ? '写入' : '文件'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {tab === 'write' ? <WritePanel /> : <FilesPanel />}
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
            loggerAdapter[level](tags.split('.'), message, parsedData)
            setHistory(h => [{
                id: String(Date.now()),
                level, tags, message, data,
                result: 'ok',
                ts: Date.now(),
            }, ...h].slice(0, 50))
        } catch (e) {
            setHistory(h => [{
                id: String(Date.now()),
                level, tags, message, data,
                result: 'error',
                ts: Date.now(),
            }, ...h].slice(0, 50))
        }
    }, [level, tags, message, data])

    return (
        <View style={s.panel}>
            {/* Level selector */}
            <View style={s.row}>
                {LEVELS.map(l => (
                    <TouchableOpacity
                        key={l}
                        style={[s.levelBtn, level === l && {backgroundColor: LEVEL_COLOR[l] + '33', borderColor: LEVEL_COLOR[l]}]}
                        onPress={() => setLevel(l)}>
                        <Text style={[s.levelText, {color: LEVEL_COLOR[l]}]}>{l}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Field label="Tags" value={tags} onChangeText={setTags} placeholder="pos.module.action" />
            <Field label="Message" value={message} onChangeText={setMessage} placeholder="日志内容" />
            <Field label="Data (JSON)" value={data} onChangeText={setData} placeholder='{"key":"value"}' multiline />

            <TouchableOpacity style={s.sendBtn} onPress={send}>
                <Text style={s.sendText}>发送日志</Text>
            </TouchableOpacity>

            {/* History */}
            {history.length > 0 && (
                <FlatList
                    data={history}
                    keyExtractor={i => i.id}
                    style={s.history}
                    renderItem={({item}) => (
                        <View style={s.historyItem}>
                            <View style={[s.dot, {backgroundColor: item.result === 'ok' ? LEVEL_COLOR[item.level] : '#EF4444'}]} />
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
            const list = await loggerAdapter.getLogFiles()
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
            const text = await loggerAdapter.getLogContent(fileName)
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
            await loggerAdapter.deleteLogFile(fileName)
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
            await loggerAdapter.clearAllLogs()
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
            const p = await loggerAdapter.getLogDirPath()
            setDirPath(p)
        } catch (e: any) {
            setStatus(`获取路径失败: ${e?.message ?? e}`)
        }
    }, [])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            {/* Actions */}
            <View style={s.row}>
                <ActionBtn label="刷新列表" onPress={load} />
                <ActionBtn label="清空全部" onPress={clearAll} danger />
                <ActionBtn label="日志目录" onPress={getDir} />
            </View>

            {loading && <ActivityIndicator color="#22C55E" style={{marginVertical: 12}} />}

            {dirPath && <Text style={s.dirPath}>{dirPath}</Text>}
            {status && <Text style={s.statusText}>{status}</Text>}

            {/* File list */}
            {files.map(f => (
                <View key={f.fileName} style={s.fileRow}>
                    <View style={s.fileInfo}>
                        <Text style={s.fileName}>{f.fileName}</Text>
                        <Text style={s.fileMeta}>{(f.fileSize / 1024).toFixed(1)} KB</Text>
                    </View>
                    <View style={s.fileActions}>
                        <TouchableOpacity style={s.fileBtn} onPress={() => viewContent(f.fileName)}>
                            <Text style={s.fileBtnText}>查看</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.fileBtn, s.fileBtnDanger]} onPress={() => deleteFile(f.fileName)}>
                            <Text style={[s.fileBtnText, {color: '#EF4444'}]}>删除</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}

            {/* Content viewer */}
            {content != null && (
                <View style={s.contentBox}>
                    <View style={s.contentHeader}>
                        <Text style={s.contentTitle}>文件内容</Text>
                        <TouchableOpacity onPress={() => setContent(null)}>
                            <Text style={s.closeBtn}>关闭</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={s.contentScroll} nestedScrollEnabled>
                        <Text style={s.contentText}>{content}</Text>
                    </ScrollView>
                </View>
            )}
        </ScrollView>
    )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
                placeholderTextColor="#475569"
                multiline={multiline}
            />
        </View>
    )
}

function ActionBtn({label, onPress, danger}: {label: string; onPress: () => void; danger?: boolean}) {
    return (
        <TouchableOpacity style={[s.actionBtn, danger && s.actionBtnDanger]} onPress={onPress}>
            <Text style={[s.actionBtnText, danger && {color: '#EF4444'}]}>{label}</Text>
        </TouchableOpacity>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root:            {flex: 1, backgroundColor: '#0F172A'},
    header:          {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B'},
    headerTitle:     {fontSize: 16, fontWeight: '600', color: '#F8FAFC', letterSpacing: 0.5},
    tabs:            {flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 8, padding: 2},
    tab:             {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6},
    tabActive:       {backgroundColor: '#334155'},
    tabText:         {fontSize: 13, color: '#64748B'},
    tabTextActive:   {color: '#F8FAFC', fontWeight: '500'},
    panel:           {flex: 1, padding: 16},
    row:             {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
    levelBtn:        {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#334155'},
    levelText:       {fontSize: 12, fontWeight: '600', letterSpacing: 0.5},
    field:           {marginBottom: 10},
    fieldLabel:      {fontSize: 11, color: '#64748B', marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase'},
    input:           {backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#F8FAFC', fontSize: 13, height: 42},
    sendBtn:         {backgroundColor: '#22C55E', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4, marginBottom: 16},
    sendText:        {color: '#0F172A', fontWeight: '700', fontSize: 14},
    history:         {maxHeight: 240},
    historyItem:     {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 6},
    dot:             {width: 6, height: 6, borderRadius: 3},
    historyLevel:    {fontSize: 11, fontWeight: '600', color: '#64748B', width: 36},
    historyTag:      {fontSize: 11, color: '#475569', width: 80},
    historyMsg:      {fontSize: 12, color: '#94A3B8', flex: 1},
    actionBtn:       {paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1E293B', borderRadius: 8, borderWidth: 1, borderColor: '#334155'},
    actionBtnDanger: {borderColor: '#EF444433'},
    actionBtnText:   {fontSize: 12, color: '#94A3B8', fontWeight: '500'},
    dirPath:         {fontSize: 11, color: '#22C55E', backgroundColor: '#1E293B', padding: 10, borderRadius: 6, marginBottom: 10, fontFamily: 'monospace'},
    statusText:      {fontSize: 12, color: '#F59E0B', marginBottom: 10},
    fileRow:         {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E293B', borderRadius: 8, padding: 12, marginBottom: 8},
    fileInfo:        {flex: 1},
    fileName:        {fontSize: 13, color: '#F8FAFC', fontFamily: 'monospace'},
    fileMeta:        {fontSize: 11, color: '#64748B', marginTop: 2},
    fileActions:     {flexDirection: 'row', gap: 8},
    fileBtn:         {paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#334155', borderRadius: 6},
    fileBtnDanger:   {backgroundColor: '#EF444411'},
    fileBtnText:     {fontSize: 12, color: '#94A3B8'},
    contentBox:      {backgroundColor: '#1E293B', borderRadius: 8, marginTop: 12, overflow: 'hidden'},
    contentHeader:   {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155'},
    contentTitle:    {fontSize: 13, color: '#F8FAFC', fontWeight: '600'},
    closeBtn:        {fontSize: 12, color: '#64748B'},
    contentScroll:   {maxHeight: 300},
    contentText:     {fontSize: 11, color: '#94A3B8', padding: 12, fontFamily: 'monospace', lineHeight: 18},
})
