import React, {useState, useCallback, useRef} from 'react'
import {
    View, Text, ScrollView, TouchableOpacity,
    TextInput, StyleSheet, FlatList,
} from 'react-native'
import {externalConnectorAdapter} from '../../src/foundations/externalConnector'
import type {ChannelType, ChannelDescriptor, ConnectorEvent} from '@impos2/kernel-core-base'
import {C} from '../theme'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type TabKey = 'rr' | 'stream' | 'passive'

type LogEntry = {
    id: string
    ts: number
    mode: TabKey
    channelType: string
    success: boolean
    label: string
    body: string
    duration?: number
}

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const TABS: {key: TabKey; label: string; tag: string}[] = [
    {key: 'rr',      label: 'Req/Resp', tag: 'RR'},
    {key: 'stream',  label: 'Stream',   tag: 'STR'},
    {key: 'passive', label: 'Passive',  tag: 'PSV'},
]

const CHANNEL_TYPES: ChannelType[] = ['INTENT', 'AIDL', 'USB', 'SERIAL', 'BLUETOOTH', 'NETWORK', 'SDK', 'HID']

const TYPE_COLOR: Record<ChannelType, string> = {
    INTENT:    C.info,
    AIDL:      C.accent,
    USB:       '#0891B2',
    SERIAL:    C.warn,
    BLUETOOTH: '#DB2777',
    NETWORK:   '#059669',
    SDK:       '#7C3AED',
    HID:       '#EA580C',
}

const RR_PRESETS: Record<ChannelType, {target: string; action: string; params: string}> = {
    INTENT:    {target: 'com.example.app',          action: 'android.intent.action.VIEW',    params: '{"url":"https://example.com"}'},
    AIDL:      {target: 'com.example.app/.AidlSvc', action: 'com.example.app/.AidlSvc',     params: '{"cmd":"ping"}'},
    USB:       {target: '/dev/bus/usb/001/002',      action: '/dev/bus/usb/001/002',          params: '{"data":"0102030405"}'},
    SERIAL:    {target: '/dev/ttyS0',               action: '/dev/ttyS0',                    params: '{"data":"48656C6C6F"}'},
    BLUETOOTH: {target: 'AA:BB:CC:DD:EE:FF',        action: 'AA:BB:CC:DD:EE:FF',             params: '{"data":"0100","uuid":"00001101-0000-1000-8000-00805F9B34FB"}'},
    NETWORK:   {target: 'http://192.168.1.1/api',   action: 'http://192.168.1.1/api',        params: '{"httpMethod":"GET"}'},
    SDK:       {target: 'com.sdk.Printer',          action: 'com.sdk.Printer#printText',     params: '{"text":"Hello"}'},
    HID:       {target: 'scanner',                  action: 'scanner',                       params: '{}'},
}

const STREAM_PRESETS: Record<ChannelType, {target: string}> = {
    INTENT:    {target: 'com.example.app'},
    AIDL:      {target: 'com.example.app/.AidlSvc'},
    USB:       {target: '/dev/bus/usb/001/002'},
    SERIAL:    {target: '/dev/ttyS0'},
    BLUETOOTH: {target: 'AA:BB:CC:DD:EE:FF'},
    NETWORK:   {target: 'ws://192.168.1.1/ws'},
    SDK:       {target: 'com.sdk.Scanner'},
    HID:       {target: 'scanner'},
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function ExternalConnectorScreen() {
    const [tab, setTab] = useState<TabKey>('rr')
    const [log, setLog] = useState<LogEntry[]>([])
    const [sharedTarget, setSharedTarget] = useState<string | null>(null)

    const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
        setLog(prev => [{...entry, id: String(Date.now() + Math.random()), ts: Date.now()}, ...prev].slice(0, 100))
    }, [])

    const clearLog = useCallback(() => setLog([]), [])

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>ExternalConnector</Text>
                <TouchableOpacity onPress={clearLog} style={s.clearBtn}>
                    <Text style={s.clearBtnText}>CLEAR</Text>
                </TouchableOpacity>
            </View>

            <View style={s.tabBar}>
                {TABS.map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.tabItem, tab === t.key && s.tabItemActive]}
                        onPress={() => setTab(t.key)}>
                        <Text style={[s.tabTag, tab === t.key && s.tabTagActive]}>{t.tag}</Text>
                        <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={s.body}>
                <View style={s.configPanel}>
                    {tab === 'rr'      && <RRPanel      addLog={addLog} sharedTarget={sharedTarget} onTargetSelect={setSharedTarget} />}
                    {tab === 'stream'  && <StreamPanel  addLog={addLog} sharedTarget={sharedTarget} />}
                    {tab === 'passive' && <PassivePanel addLog={addLog} sharedTarget={sharedTarget} />}
                </View>

                <View style={s.logPanel}>
                    <Text style={s.logTitle}>事件日志 ({log.length})</Text>
                    <FlatList
                        data={log}
                        keyExtractor={i => i.id}
                        renderItem={({item}) => <LogRow item={item} />}
                        ListEmptyComponent={<Text style={s.emptyText}>暂无记录</Text>}
                        style={s.logList}
                    />
                </View>
            </View>
        </View>
    )
}

// ─── Request-Response 面板 ────────────────────────────────────────────────────

function RRPanel({addLog, sharedTarget, onTargetSelect}: {
    addLog: (e: Omit<LogEntry, 'id' | 'ts'>) => void
    sharedTarget: string | null
    onTargetSelect: (t: string) => void
}) {
    const [channelType, setChannelType] = useState<ChannelType>('INTENT')
    const [target, setTarget]   = useState(RR_PRESETS.INTENT.target)

    React.useEffect(() => {
        if (sharedTarget !== null) setTarget(sharedTarget)
    }, [sharedTarget])
    const [action, setAction]   = useState(RR_PRESETS.INTENT.action)
    const [params, setParams]   = useState(RR_PRESETS.INTENT.params)
    const [timeout, setTimeout_] = useState('5000')
    const [options, setOptions] = useState('{}')
    const [loading, setLoading] = useState(false)
    const [available, setAvailable] = useState<boolean | null>(null)
    const [targets, setTargets] = useState<string[] | null>(null)

    const applyPreset = useCallback((t: ChannelType) => {
        setChannelType(t)
        setTarget(RR_PRESETS[t].target)
        setAction(RR_PRESETS[t].action)
        setParams(RR_PRESETS[t].params)
        setTargets(null)
        setAvailable(null)
    }, [])

    const buildChannel = (): ChannelDescriptor => ({
        type: channelType,
        target,
        mode: 'request-response',
        options: (() => { try { return JSON.parse(options) } catch { return {} } })(),
    })

    const handleCall = useCallback(async () => {
        setLoading(true)
        const t0 = Date.now()
        try {
            let p: Record<string, any> = {}
            try { p = JSON.parse(params) } catch {}
            const res = await externalConnectorAdapter.call(buildChannel(), action, p, parseInt(timeout) || 5000)
            addLog({
                mode: 'rr', channelType, success: res.success,
                label: `${channelType} → ${action.slice(0, 30)}`,
                body: JSON.stringify(res.data ?? res.message, null, 2),
                duration: Date.now() - t0,
            })
        } catch (e: any) {
            addLog({mode: 'rr', channelType, success: false,
                label: `${channelType} ERROR`, body: e?.message ?? String(e), duration: Date.now() - t0})
        } finally { setLoading(false) }
    }, [channelType, target, action, params, timeout, options])

    const handleCheck = useCallback(async () => {
        try {
            const r = await externalConnectorAdapter.isAvailable(buildChannel())
            setAvailable(r)
            addLog({mode: 'rr', channelType, success: r,
                label: `isAvailable: ${channelType}`, body: r ? '✓ 可用' : '✗ 不可用'})
        } catch (e: any) {
            setAvailable(false)
            addLog({mode: 'rr', channelType, success: false, label: 'isAvailable ERROR', body: e?.message ?? String(e)})
        }
    }, [channelType, target, options])

    const handleGetTargets = useCallback(async () => {
        try {
            const list = await externalConnectorAdapter.getAvailableTargets(channelType)
            setTargets(list)
            addLog({mode: 'rr', channelType, success: true,
                label: `getAvailableTargets: ${channelType}`,
                body: list.length > 0 ? list.join('\n') : '(空)'})
        } catch (e: any) {
            setTargets([])
            addLog({mode: 'rr', channelType, success: false, label: 'getAvailableTargets ERROR', body: e?.message ?? String(e)})
        }
    }, [channelType])

    return (
        <ScrollView contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Channel Type</Text>
            <View style={s.row}>
                {CHANNEL_TYPES.map(t => (
                    <TouchableOpacity key={t}
                        style={[s.chip, channelType === t && {backgroundColor: TYPE_COLOR[t] + '22', borderColor: TYPE_COLOR[t]}]}
                        onPress={() => applyPreset(t)}>
                        <Text style={[s.chipText, {color: TYPE_COLOR[t]}]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.label}>Target</Text>
            <TextInput style={s.input} value={target} onChangeText={setTarget}
                placeholderTextColor={C.textMuted} placeholder="包名 / 设备路径 / MAC / URL" />

            <Text style={s.label}>Action</Text>
            <TextInput style={s.input} value={action} onChangeText={setAction}
                placeholderTextColor={C.textMuted} placeholder="Intent action / 方法名 / 路径" />

            <Text style={s.label}>Params (JSON)</Text>
            <TextInput style={[s.input, s.inputMulti]} value={params} onChangeText={setParams}
                placeholderTextColor={C.textMuted} placeholder="{}" multiline />

            <Text style={s.label}>Options (JSON)</Text>
            <TextInput style={s.input} value={options} onChangeText={setOptions}
                placeholderTextColor={C.textMuted} placeholder='{"uuid":"..."}' />

            <Text style={s.label}>Timeout (ms)</Text>
            <TextInput style={s.input} value={timeout} onChangeText={setTimeout_}
                placeholderTextColor={C.textMuted} keyboardType="numeric" />

            <View style={s.btnRow}>
                <TouchableOpacity style={[s.btn, {backgroundColor: C.accent}]} onPress={handleCall} disabled={loading}>
                    <Text style={s.btnText}>{loading ? '...' : 'CALL'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, {backgroundColor: C.info}]} onPress={handleCheck}>
                    <Text style={s.btnText}>CHECK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, {backgroundColor: '#7C3AED'}]} onPress={handleGetTargets}>
                    <Text style={s.btnText}>TARGETS</Text>
                </TouchableOpacity>
            </View>

            {available !== null && (
                <View style={[s.resultBox, {borderColor: available ? C.accent : C.danger}]}>
                    <Text style={[s.resultText, {color: available ? C.accent : C.danger}]}>
                        {available ? '✓ 通道可用' : '✗ 通道不可用'}
                    </Text>
                </View>
            )}

            {targets !== null && (
                <View style={[s.resultBox, {borderColor: '#7C3AED', marginTop: 6}]}>
                    <Text style={[s.resultText, {color: '#7C3AED', marginBottom: 4}]}>
                        {channelType} 可用 Targets ({targets.length})
                    </Text>
                    {targets.length === 0
                        ? <Text style={s.logBodyPreview}>（无可用 target）</Text>
                        : targets.map((t, i) => (
                            <TouchableOpacity key={i} onPress={() => onTargetSelect(t)}>
                                <Text style={[s.logBodyPreview, {color: C.info}]}>{t}</Text>
                            </TouchableOpacity>
                        ))
                    }
                </View>
            )}
        </ScrollView>
    )
}

// ─── Passive 面板 ─────────────────────────────────────────────────────────────

function PassivePanel({addLog, sharedTarget}: {
    addLog: (e: Omit<LogEntry, 'id' | 'ts'>) => void
    sharedTarget: string | null
}) {
    const [target, setTarget] = useState('')

    React.useEffect(() => {
        if (sharedTarget !== null) setTarget(sharedTarget)
    }, [sharedTarget])
    const [listening, setListening] = useState(false)
    const [eventCount, setEventCount] = useState(0)
    const removeRef = useRef<(() => void) | null>(null)

    const handleListen = useCallback(() => {
        if (listening) return
        setListening(true); setEventCount(0)
        const remove = externalConnectorAdapter.on('connector.passive', (event: ConnectorEvent) => {
            if (target && event.target !== target) return
            setEventCount(c => c + 1)
            addLog({
                mode: 'passive', channelType: 'INTENT', success: true,
                label: `[PASSIVE] ${event.target}`,
                body: JSON.stringify(event.data, null, 2) ?? event.raw ?? '',
            })
        })
        removeRef.current = remove
        addLog({mode: 'passive', channelType: 'INTENT', success: true,
            label: '开始监听被动事件', body: target ? `过滤 target: ${target}` : '接收所有 passive 事件'})
    }, [listening, target])

    const handleStop = useCallback(() => {
        removeRef.current?.(); removeRef.current = null; setListening(false)
        addLog({mode: 'passive', channelType: 'INTENT', success: true,
            label: '停止监听', body: `共收到 ${eventCount} 个事件`})
    }, [eventCount])

    return (
        <ScrollView contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">
            <View style={s.infoBox}>
                <Text style={s.infoText}>
                    Passive 模式监听外部 APP 通过 Intent 主动调用本 APP 的事件。{'\n'}
                    外部 APP 发送 action 为 <Text style={s.infoCode}>com.impos2.connector.PASSIVE</Text> 的广播即可触发。
                </Text>
            </View>

            <Text style={s.label}>Target 过滤（可选）</Text>
            <TextInput style={s.input} value={target} onChangeText={setTarget}
                placeholderTextColor={C.textMuted} placeholder="留空接收全部，或填 action 字符串过滤" />

            <View style={[s.statusBar, {borderColor: listening ? C.accent : C.border}]}>
                <View style={[s.statusDot, {backgroundColor: listening ? C.accent : C.textMuted}]} />
                <Text style={[s.statusText, {color: listening ? C.accent : C.textMuted}]}>
                    {listening ? `监听中 · 已收 ${eventCount} 个事件` : '未监听'}
                </Text>
            </View>

            <View style={s.btnRow}>
                <TouchableOpacity style={[s.btn, {backgroundColor: listening ? C.textMuted : C.accent}]}
                    onPress={handleListen} disabled={listening}>
                    <Text style={s.btnText}>START LISTEN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, {backgroundColor: listening ? C.danger : C.textMuted}]}
                    onPress={handleStop} disabled={!listening}>
                    <Text style={s.btnText}>STOP</Text>
                </TouchableOpacity>
            </View>

            <View style={s.infoBox}>
                <Text style={s.infoTitle}>测试方法（adb）</Text>
                <Text style={s.infoCode}>
                    {'adb shell am broadcast \\\n  -a com.impos2.connector.PASSIVE \\\n  --es key1 value1 \\\n  --es key2 value2'}
                </Text>
            </View>
        </ScrollView>
    )
}

function StreamPanel({addLog, sharedTarget}: {
    addLog: (e: Omit<LogEntry, 'id' | 'ts'>) => void
    sharedTarget: string | null
}) {
    const STREAM_CH: ChannelType[] = ['USB', 'SERIAL', 'BLUETOOTH', 'HID']
    const [channelType, setChannelType] = useState<ChannelType>('USB')
    const [target, setTarget]   = useState(STREAM_PRESETS.USB.target)

    React.useEffect(() => {
        if (sharedTarget !== null) setTarget(sharedTarget)
    }, [sharedTarget])
    const [options, setOptions] = useState('{}')
    const [channelId, setChannelId] = useState<string | null>(null)
    const [subscribing, setSubscribing] = useState(false)
    const [eventCount, setEventCount] = useState(0)

    const applyPreset = useCallback((t: ChannelType) => {
        setChannelType(t); setTarget(STREAM_PRESETS[t].target)
    }, [])

    const buildChannel = (): ChannelDescriptor => ({
        type: channelType, target, mode: 'stream',
        options: (() => { try { return JSON.parse(options) } catch { return {} } })(),
    })

    const handleSubscribe = useCallback(async () => {
        if (subscribing) return
        setSubscribing(true); setEventCount(0)
        try {
            const id = await externalConnectorAdapter.subscribe(
                buildChannel(),
                (event: ConnectorEvent) => {
                    setEventCount(c => c + 1)
                    addLog({mode: 'stream', channelType, success: true,
                        label: `[${channelType}] 数据帧`,
                        body: event.raw ?? JSON.stringify(event.data)})
                },
                (error: ConnectorEvent) => {
                    addLog({mode: 'stream', channelType, success: false,
                        label: `[${channelType}] 错误`, body: error.raw ?? '硬件异常'})
                },
            )
            setChannelId(id)
            addLog({mode: 'stream', channelType, success: true, label: '订阅成功', body: `channelId: ${id}`})
        } catch (e: any) {
            setSubscribing(false)
            addLog({mode: 'stream', channelType, success: false, label: '订阅失败', body: e?.message ?? String(e)})
        }
    }, [subscribing, channelType, target, options])

    const handleUnsubscribe = useCallback(async () => {
        if (!channelId) return
        try {
            await externalConnectorAdapter.unsubscribe(channelId)
            addLog({mode: 'stream', channelType, success: true, label: '已取消订阅', body: `channelId: ${channelId}`})
        } catch (e: any) {
            addLog({mode: 'stream', channelType, success: false, label: '取消订阅失败', body: e?.message ?? String(e)})
        } finally { setChannelId(null); setSubscribing(false) }
    }, [channelId, channelType])

    const handleCheck = useCallback(async () => {
        try {
            const r = await externalConnectorAdapter.isAvailable(buildChannel())
            addLog({mode: 'stream', channelType, success: r,
                label: `isAvailable: ${channelType}`, body: r ? '✓ 可用' : '✗ 不可用'})
        } catch (e: any) {
            addLog({mode: 'stream', channelType, success: false, label: 'isAvailable ERROR', body: e?.message ?? String(e)})
        }
    }, [channelType, target, options])

    return (
        <ScrollView contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Channel Type</Text>
            <View style={s.row}>
                {STREAM_CH.map(t => (
                    <TouchableOpacity key={t}
                        style={[s.chip, channelType === t && {backgroundColor: TYPE_COLOR[t] + '22', borderColor: TYPE_COLOR[t]}]}
                        onPress={() => applyPreset(t)}>
                        <Text style={[s.chipText, {color: TYPE_COLOR[t]}]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.label}>Target（设备路径 / MAC）</Text>
            <TextInput style={s.input} value={target} onChangeText={setTarget}
                placeholderTextColor={C.textMuted} placeholder="/dev/ttyS0 或 AA:BB:CC:DD:EE:FF" />

            <Text style={s.label}>Options (JSON)</Text>
            <TextInput style={s.input} value={options} onChangeText={setOptions}
                placeholderTextColor={C.textMuted} placeholder='{"uuid":"00001101-..."}' />

            <View style={[s.statusBar, {borderColor: subscribing ? TYPE_COLOR[channelType] : C.border}]}>
                <View style={[s.statusDot, {backgroundColor: subscribing ? TYPE_COLOR[channelType] : C.textMuted}]} />
                <Text style={[s.statusText, {color: subscribing ? TYPE_COLOR[channelType] : C.textMuted}]}>
                    {subscribing ? `监听中 · 已收 ${eventCount} 帧` : '未订阅'}
                </Text>
                {channelId && <Text style={s.channelIdText} numberOfLines={1}>{channelId.slice(0, 16)}…</Text>}
            </View>

            <View style={s.btnRow}>
                <TouchableOpacity style={[s.btn, {backgroundColor: subscribing ? C.textMuted : TYPE_COLOR[channelType]}]}
                    onPress={handleSubscribe} disabled={subscribing}>
                    <Text style={s.btnText}>SUBSCRIBE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, {backgroundColor: subscribing ? C.danger : C.textMuted}]}
                    onPress={handleUnsubscribe} disabled={!subscribing}>
                    <Text style={s.btnText}>STOP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, {backgroundColor: C.info}]} onPress={handleCheck}>
                    <Text style={s.btnText}>CHECK</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

// ─── 日志行 ───────────────────────────────────────────────────────────────────

function LogRow({item}: {item: LogEntry}) {
    const [expanded, setExpanded] = useState(false)
    const color = item.success ? C.accent : C.danger
    const modeColor: Record<TabKey, string> = {rr: C.info, stream: C.warn, passive: '#7C3AED'}
    const time = new Date(item.ts).toTimeString().slice(0, 8)

    return (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
            <View style={[s.logRow, {borderLeftColor: color, borderLeftWidth: 3}]}>
                <View style={s.logMeta}>
                    <Text style={[s.logModeBadge, {color: modeColor[item.mode], borderColor: modeColor[item.mode]}]}>
                        {item.mode.toUpperCase()}
                    </Text>
                    <Text style={[s.logTypeBadge, {
                        color: TYPE_COLOR[item.channelType as ChannelType] ?? C.textMuted,
                        borderColor: TYPE_COLOR[item.channelType as ChannelType] ?? C.border,
                    }]}>
                        {item.channelType}
                    </Text>
                    <Text style={s.logTime}>{time}</Text>
                    {item.duration != null && <Text style={s.logDuration}>{item.duration}ms</Text>}
                    <View style={[s.dot, {backgroundColor: color}]} />
                </View>
                <Text style={s.logLabel} numberOfLines={1}>{item.label}</Text>
                {expanded
                    ? <Text style={s.logBody}>{item.body}</Text>
                    : <Text style={s.logBodyPreview} numberOfLines={1}>{item.body}</Text>
                }
            </View>
        </TouchableOpacity>
    )
}

// ─── 样式 ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root:         {flex: 1, backgroundColor: C.bgPage},
    header:       {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                   borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle:  {flex: 1, fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    clearBtn:     {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: C.border},
    clearBtnText: {fontSize: 11, color: C.textMuted, fontWeight: '600'},
    tabBar:       {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard},
    tabItem:      {flex: 1, alignItems: 'center', paddingVertical: 10},
    tabItemActive:{borderBottomWidth: 2, borderBottomColor: C.accent},
    tabTag:       {fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5},
    tabTagActive: {color: C.accent},
    tabLabel:     {fontSize: 11, color: C.textMuted, marginTop: 2},
    tabLabelActive:{color: C.textPrimary, fontWeight: '500'},
    body:         {flex: 1, flexDirection: 'row'},
    configPanel:  {flex: 1, borderRightWidth: 1, borderRightColor: C.border, padding: 12},
    logPanel:     {width: 260, backgroundColor: C.bgCard},
    logTitle:     {fontSize: 11, fontWeight: '600', color: C.textSecondary, letterSpacing: 0.5,
                   textTransform: 'uppercase', padding: 10, borderBottomWidth: 1, borderBottomColor: C.border},
    logList:      {flex: 1},
    emptyText:    {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 16},
    label:        {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5,
                   textTransform: 'uppercase', marginBottom: 4, marginTop: 10},
    row:          {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4},
    chip:         {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1,
                   borderColor: C.border, backgroundColor: C.bgCard},
    chipText:     {fontSize: 10, fontWeight: '700'},
    input:        {backgroundColor: C.bgInput, borderRadius: 6, padding: 9, color: C.textPrimary,
                   fontSize: 12, borderWidth: 1, borderColor: C.border},
    inputMulti:   {minHeight: 56, textAlignVertical: 'top'},
    btnRow:       {flexDirection: 'row', gap: 6, marginTop: 12},
    btn:          {flex: 1, borderRadius: 6, paddingVertical: 9, alignItems: 'center'},
    btnText:      {color: C.textInverse, fontWeight: '700', fontSize: 11},
    resultBox:    {borderRadius: 6, padding: 9, marginTop: 8, borderWidth: 1, backgroundColor: C.bgCard},
    resultText:   {fontSize: 12, fontWeight: '600'},
    statusBar:    {flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, borderWidth: 1,
                   padding: 9, marginTop: 12, backgroundColor: C.bgCard},
    statusDot:    {width: 8, height: 8, borderRadius: 4},
    statusText:   {fontSize: 12, fontWeight: '500', flex: 1},
    channelIdText:{fontSize: 10, color: C.textMuted, fontFamily: 'monospace'},
    infoBox:      {backgroundColor: C.bgSub, borderRadius: 6, padding: 10, marginTop: 10,
                   borderWidth: 1, borderColor: C.border},
    infoTitle:    {fontSize: 11, fontWeight: '700', color: C.textSecondary, marginBottom: 4},
    infoText:     {fontSize: 11, color: C.textSecondary, lineHeight: 17},
    infoCode:     {fontSize: 11, color: C.info, fontFamily: 'monospace', lineHeight: 17},
    logRow:       {padding: 8, marginHorizontal: 6, marginBottom: 4, borderRadius: 6,
                   backgroundColor: C.bgPage, borderWidth: 1, borderColor: C.border},
    logMeta:      {flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3},
    logModeBadge: {fontSize: 9, fontWeight: '700', paddingHorizontal: 4, paddingVertical: 1,
                   borderRadius: 3, borderWidth: 1},
    logTypeBadge: {fontSize: 9, fontWeight: '700', paddingHorizontal: 4, paddingVertical: 1,
                   borderRadius: 3, borderWidth: 1},
    logTime:      {fontSize: 9, color: C.textMuted, flex: 1},
    logDuration:  {fontSize: 9, color: C.textMuted},
    dot:          {width: 6, height: 6, borderRadius: 3},
    logLabel:     {fontSize: 11, color: C.textPrimary, fontWeight: '500'},
    logBodyPreview:{fontSize: 10, color: C.textMuted, marginTop: 2, fontFamily: 'monospace'},
    logBody:      {fontSize: 10, color: C.textPrimary, marginTop: 4, fontFamily: 'monospace',
                   backgroundColor: C.bgSub, padding: 6, borderRadius: 4},
})
