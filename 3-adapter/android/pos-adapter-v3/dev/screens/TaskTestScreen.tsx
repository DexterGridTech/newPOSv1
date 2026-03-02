import React, {useState, useCallback, useRef, useEffect} from 'react'
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, Platform, FlatList, Modal,
} from 'react-native'
import {TaskSystem, ProgressData} from '@impos2/kernel-core-task'
import {TEST_TASK_DEFINITIONS} from '../testTask'
import {C} from '../theme'
import {Subscription} from 'rxjs'

type LoopMode = 'once' | 'loop'
type ProgressEntry = ProgressData & {_id: string}

const MONOSPACE = Platform.select({ios: 'Courier New', android: 'monospace'}) as string
const MAX_ENTRIES = 100
let _idCounter = 0
const nextId = () => String(++_idCounter)

const TYPE_COLOR: Record<string, string> = {
    TASK_INIT: C.accent, TASK_COMPLETE: C.accent, TASK_CANCEL: C.textMuted,
    NODE_START: C.info, NODE_PROGRESS: C.info, NODE_COMPLETE: C.info,
    NODE_SKIP: C.warn, NODE_RETRY: C.warn, COMPENSATION: C.warn, CONDITION_CHECK: C.warn,
    NODE_ERROR: C.danger,
}
const TYPE_BG: Record<string, string> = {
    TASK_INIT: C.accentBg, TASK_COMPLETE: C.accentBg, TASK_CANCEL: C.bgSub,
    NODE_START: C.infoBg, NODE_PROGRESS: C.infoBg, NODE_COMPLETE: C.infoBg,
    NODE_SKIP: C.warnBg, NODE_RETRY: C.warnBg, COMPENSATION: C.warnBg, CONDITION_CHECK: C.warnBg,
    NODE_ERROR: C.dangerBg,
}

function Dropdown({value, options, onChange, disabled}: {
    value: string
    options: {label: string; key: string}[]
    onChange: (v: string) => void
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const sel = options.find(o => o.key === value)
    return (
        <View style={dd.wrap}>
            <TouchableOpacity
                style={[dd.trigger, open && dd.triggerOpen]}
                onPress={() => !disabled && setOpen(v => !v)}
                disabled={disabled}
                activeOpacity={0.8}>
                <View style={{flex: 1}}>
                    <Text style={dd.name}>{sel?.label ?? value}</Text>
                    <Text style={dd.key}>{sel?.key ?? ''}</Text>
                </View>
                <Text style={dd.arrow}>{open ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {open && (
                <View style={dd.list}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt.key}
                            style={[dd.item, opt.key === value && dd.itemSel]}
                            onPress={() => { onChange(opt.key); setOpen(false) }}
                            activeOpacity={0.7}>
                            <Text style={[dd.itemName, opt.key === value && {color: C.accent}]}>{opt.label}</Text>
                            <Text style={dd.itemKey}>{opt.key}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    )
}

const dd = StyleSheet.create({
    wrap:       {marginHorizontal: 12},
    trigger:    {flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8,
                 borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard},
    triggerOpen:{borderColor: C.accent, backgroundColor: C.accentBg},
    name:       {fontSize: 12, fontWeight: '600', color: C.textPrimary},
    key:        {fontSize: 10, color: C.textMuted, marginTop: 2, fontFamily: MONOSPACE},
    arrow:      {fontSize: 10, color: C.textMuted, marginLeft: 6},
    list:       {position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                 elevation: 8, backgroundColor: C.bgCard, borderRadius: 8,
                 borderWidth: 1, borderColor: C.accent, marginTop: 2,
                 shadowColor: '#000', shadowOffset: {width: 0, height: 2},
                 shadowOpacity: 0.12, shadowRadius: 4},
    item:       {padding: 10, borderBottomWidth: 1, borderBottomColor: C.border},
    itemSel:    {backgroundColor: C.accentBg},
    itemName:   {fontSize: 12, fontWeight: '600', color: C.textPrimary},
    itemKey:    {fontSize: 10, color: C.textMuted, marginTop: 2, fontFamily: MONOSPACE},
})

function JsonNode({k, v, depth, onShowString}: {k?: string; v: any; depth: number; onShowString?: (s: string) => void}) {
    const isObj = v !== null && typeof v === 'object'
    const [open, setOpen] = useState(depth < 1)
    const pad = 8 + depth * 12

    if (!isObj) {
        const valColor = typeof v === 'string' ? C.accent
            : typeof v === 'boolean' ? C.warn
            : typeof v === 'number' ? C.info
            : C.textSecondary
        const isLong = typeof v === 'string' && v.length > 60
        return (
            <TouchableOpacity
                style={[jt.row, {paddingLeft: pad}]}
                onPress={isLong ? () => onShowString?.(v) : undefined}
                activeOpacity={isLong ? 0.7 : 1}
                disabled={!isLong}>
                {k != null && <Text style={jt.key}>{k}: </Text>}
                <Text style={[jt.val, {color: valColor}]} numberOfLines={isLong ? 2 : undefined}>
                    {JSON.stringify(v)}
                </Text>
                {isLong && <Text style={jt.tapHint}>↗</Text>}
            </TouchableOpacity>
        )
    }

    const isArr = Array.isArray(v)
    const keys = Object.keys(v)
    return (
        <View>
            <TouchableOpacity style={[jt.row, {paddingLeft: pad}]} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
                <Text style={jt.toggle}>{open ? '▼' : '▶'} </Text>
                {k != null && <Text style={jt.key}>{k}: </Text>}
                <Text style={jt.bracket}>{isArr ? `Array[${keys.length}]` : `Object{${keys.length}}`}</Text>
            </TouchableOpacity>
            {open && keys.map(ck => (
                <JsonNode key={ck} k={isArr ? `[${ck}]` : ck} v={v[ck]} depth={depth + 1} onShowString={onShowString} />
            ))}
        </View>
    )
}

const jt = StyleSheet.create({
    row:     {flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 3,
              borderBottomWidth: 1, borderBottomColor: C.border + '66'},
    key:     {fontSize: 11, color: C.textSecondary, fontFamily: MONOSPACE, fontWeight: '600'},
    val:     {flex: 1, fontSize: 11, fontFamily: MONOSPACE},
    toggle:  {fontSize: 9, color: C.textMuted, width: 14},
    bracket: {fontSize: 11, color: C.textMuted, fontFamily: MONOSPACE},
    tapHint: {fontSize: 10, color: C.info, marginLeft: 4, alignSelf: 'flex-start'},
})

const m = StyleSheet.create({
    backdrop: {flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center'},
    box:      {width: '85%', maxHeight: '70%', backgroundColor: C.bgCard, borderRadius: 10,
               borderWidth: 1, borderColor: C.border, overflow: 'hidden'},
    scroll:   {maxHeight: 400},
    text:     {fontSize: 12, color: C.textPrimary, fontFamily: MONOSPACE, lineHeight: 18},
    closeBtn: {padding: 12, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center'},
    closeText:{fontSize: 13, fontWeight: '600', color: C.accent},
})

export default function TaskTestScreen() {
    const [selectedKey, setSelectedKey] = useState<string>(TEST_TASK_DEFINITIONS[0]?.key ?? '')
    const [loopMode, setLoopMode]       = useState<LoopMode>('once')
    const [running, setRunning]         = useState(false)
    const [entries, setEntries]         = useState<ProgressEntry[]>([])
    const [strModal, setStrModal]       = useState<string | null>(null)

    const cancelRef = useRef<(() => void) | null>(null)
    const subRef    = useRef<Subscription | null>(null)
    const listRef   = useRef<FlatList<ProgressEntry>>(null)
    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const selectedDef = TEST_TASK_DEFINITIONS.find(d => d.key === selectedKey)

    useEffect(() => () => {
        subRef.current?.unsubscribe()
        cancelRef.current?.()
    }, [])

    const pushEntry = useCallback((data: ProgressData) => {
        console.log('[TaskTest]', data.type, JSON.stringify(data))
        setEntries(prev => [...prev, {...data, _id: nextId()}].slice(-MAX_ENTRIES))
        if (scrollTimer.current) clearTimeout(scrollTimer.current)
        scrollTimer.current = setTimeout(() => listRef.current?.scrollToEnd({animated: false}), 100)
    }, [])

    const handleRun = useCallback(() => {
        if (!selectedDef || running) return
        setEntries([])
        setRunning(true)
        const taskSystem = TaskSystem.getInstance()
        taskSystem.registerTask(selectedDef)
        const requestId = `test_${selectedDef.key}_${Date.now()}`
        const obs = taskSystem.task(selectedDef.key).run(requestId, selectedDef.testContext ?? {}, loopMode === 'loop')
        subRef.current?.unsubscribe()
        subRef.current = obs.subscribe({
            next: pushEntry,
            error: () => setRunning(false),
            complete: () => setRunning(false),
        })
        cancelRef.current = () => taskSystem.cancel(requestId)
    }, [selectedDef, running, loopMode, pushEntry])

    const handleStop = useCallback(() => {
        cancelRef.current?.()
        subRef.current?.unsubscribe()
        subRef.current = null
        cancelRef.current = null
        setRunning(false)
    }, [])

    const handleClear = useCallback(() => setEntries([]), [])

    const dropdownOptions = TEST_TASK_DEFINITIONS.map(d => ({label: d.name, key: d.key}))

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>Task Test</Text>
                <View style={s.headerRight}>
                    {running && <View style={s.runningDot} />}
                    <Text style={[s.headerStatus, {color: running ? C.accent : C.textMuted}]}>
                        {running ? 'RUNNING' : 'IDLE'}
                    </Text>
                </View>
            </View>

            <View style={s.body}>
                <View style={s.controlPanel}>
                    <View style={s.dropdownSection}>
                        <Text style={s.label}>TaskDefinition</Text>
                        <Dropdown
                            value={selectedKey}
                            options={dropdownOptions}
                            onChange={setSelectedKey}
                            disabled={running}
                        />
                    </View>
                    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 24}}>
                        <Text style={s.label}>详情</Text>
                        <View style={s.jsonBox}>
                            {selectedDef
                                ? <JsonNode v={selectedDef} depth={0} onShowString={setStrModal} />
                                : <Text style={s.emptyDetail}>未选择</Text>
                            }
                        </View>
                    </ScrollView>
                </View>

                <View style={s.streamPanel}>
                    <View style={s.ctrlBar}>
                        <View style={s.modeRow}>
                            {(['once', 'loop'] as LoopMode[]).map(mode => (
                                <TouchableOpacity
                                    key={mode}
                                    style={[s.modeChip, loopMode === mode && s.modeChipActive]}
                                    onPress={() => !running && setLoopMode(mode)}
                                    disabled={running}>
                                    <Text style={[s.modeChipText, loopMode === mode && s.modeChipTextActive]}>
                                        {mode === 'once' ? '单次' : '循环'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={s.btnRow}>
                            <TouchableOpacity
                                style={[s.btn, {backgroundColor: running ? C.textMuted : C.accent}]}
                                onPress={handleRun}
                                disabled={running || !selectedDef}>
                                <Text style={s.btnText}>▶ RUN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.btn, {backgroundColor: running ? C.danger : C.textMuted}]}
                                onPress={handleStop}
                                disabled={!running}>
                                <Text style={s.btnText}>■ STOP</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={s.streamHeader}>
                        <Text style={s.streamTitle}>Progress Stream ({entries.length})</Text>
                        <TouchableOpacity onPress={handleClear} disabled={running}>
                            <Text style={[s.clearText, running && {color: C.textMuted}]}>清空</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={listRef}
                        data={entries}
                        keyExtractor={e => e._id}
                        renderItem={({item}) => <ProgressRow entry={item} />}
                        ListEmptyComponent={
                            <Text style={s.emptyText}>点击 RUN 开始执行，progressData 将实时显示在这里</Text>
                        }
                        contentContainerStyle={{paddingBottom: 16}}
                        style={s.streamList}
                    />
                </View>
            </View>

            <Modal visible={strModal !== null} transparent animationType="fade" onRequestClose={() => setStrModal(null)}>
                <TouchableOpacity style={m.backdrop} onPress={() => setStrModal(null)} activeOpacity={1}>
                    <View style={m.box}>
                        <ScrollView style={m.scroll} contentContainerStyle={{padding: 12}}>
                            <Text style={m.text} selectable>{strModal ?? ''}</Text>
                        </ScrollView>
                        <TouchableOpacity style={m.closeBtn} onPress={() => setStrModal(null)}>
                            <Text style={m.closeText}>关闭</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    )
}

const ProgressRow = React.memo(function ProgressRow({entry}: {entry: ProgressEntry}) {
    const [expanded, setExpanded] = useState(false)
    const color   = TYPE_COLOR[entry.type] ?? C.textSecondary
    const bgColor = TYPE_BG[entry.type] ?? C.bgSub
    const time    = new Date(entry.timestamp).toTimeString().slice(0, 8)

    return (
        <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            activeOpacity={0.8}
            style={[p.row, {backgroundColor: bgColor, borderLeftColor: color}]}>

            <View style={p.topRow}>
                <View style={[p.typeBadge, {backgroundColor: color + '22', borderColor: color}]}>
                    <Text style={[p.typeText, {color}]}>{entry.type}</Text>
                </View>
                <View style={p.progressBar}>
                    <View style={[p.progressFill, {width: `${entry.progress}%` as any, backgroundColor: color}]} />
                </View>
                <Text style={p.progressNum}>{entry.progress}%</Text>
                <Text style={p.time}>{time}</Text>
            </View>

            <View style={p.metaRow}>
                {entry.nodeKey ? <Text style={p.nodeKey} numberOfLines={1}>node: {entry.nodeKey}</Text> : null}
                <Text style={[p.state, {color: entry.state === 'COMPLETED' ? C.accent : entry.state === 'PARTIAL_FAILED' ? C.danger : C.textMuted}]}>
                    {entry.state}
                </Text>
            </View>

            {entry.error && (
                <View style={p.errorBox}>
                    <Text style={p.errorCode}>[{entry.error.code}]</Text>
                    <Text style={p.errorMsg} numberOfLines={expanded ? undefined : 2}>{entry.error.message}</Text>
                </View>
            )}

            {expanded && entry.payload !== undefined && (
                <View style={p.payloadBox}>
                    <Text style={p.payloadLabel}>payload</Text>
                    <Text style={[p.payloadText, {fontFamily: MONOSPACE}]}>
                        {JSON.stringify(entry.payload, null, 2)}
                    </Text>
                </View>
            )}

            {expanded && (entry.type === 'TASK_INIT' || entry.type === 'TASK_COMPLETE' || entry.type === 'NODE_COMPLETE') && (
                <View style={p.payloadBox}>
                    <Text style={p.payloadLabel}>context</Text>
                    <Text style={[p.payloadText, {fontFamily: MONOSPACE}]}>
                        {JSON.stringify(entry.context, null, 2)}
                    </Text>
                </View>
            )}

            {!expanded && (entry.payload !== undefined || entry.type === 'TASK_COMPLETE') && (
                <Text style={p.expandHint}>点击展开详情</Text>
            )}
        </TouchableOpacity>
    )
})

const p = StyleSheet.create({
    row:          {borderLeftWidth: 3, borderRadius: 6, padding: 8, marginHorizontal: 8,
                   marginBottom: 4, borderWidth: 1, borderColor: C.border},
    topRow:       {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4},
    typeBadge:    {paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1},
    typeText:     {fontSize: 9, fontWeight: '700', letterSpacing: 0.3},
    progressBar:  {flex: 1, height: 4, backgroundColor: C.bgSub, borderRadius: 2, overflow: 'hidden'},
    progressFill: {height: 4, borderRadius: 2},
    progressNum:  {fontSize: 10, color: C.textMuted, width: 30, textAlign: 'right'},
    time:         {fontSize: 9, color: C.textMuted},
    metaRow:      {flexDirection: 'row', alignItems: 'center', gap: 8},
    nodeKey:      {flex: 1, fontSize: 10, color: C.textSecondary, fontFamily: MONOSPACE},
    state:        {fontSize: 9, fontWeight: '700'},
    errorBox:     {marginTop: 4, backgroundColor: C.dangerBg, borderRadius: 4, padding: 6},
    errorCode:    {fontSize: 9, fontWeight: '700', color: C.danger, marginBottom: 2},
    errorMsg:     {fontSize: 10, color: C.danger, fontFamily: MONOSPACE},
    payloadBox:   {marginTop: 4, backgroundColor: C.bgSub, borderRadius: 4, padding: 6},
    payloadLabel: {fontSize: 9, fontWeight: '700', color: C.textMuted, marginBottom: 2},
    payloadText:  {fontSize: 10, color: C.textPrimary},
    expandHint:   {fontSize: 9, color: C.textMuted, marginTop: 3, textAlign: 'right'},
})

const s = StyleSheet.create({
    root:         {flex: 1, backgroundColor: C.bgPage},
    header:       {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                   paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle:  {flex: 1, fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    headerRight:  {flexDirection: 'row', alignItems: 'center', gap: 6},
    runningDot:   {width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent},
    headerStatus: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5},
    body:         {flex: 1, flexDirection: 'row'},
    controlPanel:    {width: 260, borderRightWidth: 1, borderRightColor: C.border},
    dropdownSection: {zIndex: 10, elevation: 10},
    label:           {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5,
                      textTransform: 'uppercase', marginBottom: 6, marginTop: 12, paddingHorizontal: 12},
    jsonBox:         {marginHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border,
                      backgroundColor: C.bgCard, overflow: 'hidden'},
    emptyDetail:     {fontSize: 12, color: C.textMuted, padding: 12},
    streamPanel:     {flex: 1},
    ctrlBar:         {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
                      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
                      backgroundColor: C.bgCard},
    modeRow:         {flexDirection: 'row', gap: 6},
    modeChip:        {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1,
                      borderColor: C.border, backgroundColor: C.bgSub},
    modeChipActive:  {borderColor: C.accent, backgroundColor: C.accentBg},
    modeChipText:    {fontSize: 11, fontWeight: '600', color: C.textSecondary},
    modeChipTextActive: {color: C.accent},
    btnRow:          {flexDirection: 'row', gap: 6, marginLeft: 'auto'},
    btn:             {borderRadius: 6, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center'},
    btnText:         {color: C.textInverse, fontWeight: '700', fontSize: 11},
    streamHeader:    {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 12, paddingVertical: 8,
                      borderBottomWidth: 1, borderBottomColor: C.border},
    streamTitle:     {fontSize: 11, fontWeight: '600', color: C.textSecondary, letterSpacing: 0.5,
                      textTransform: 'uppercase'},
    clearText:       {fontSize: 11, color: C.danger, fontWeight: '600'},
    streamList:      {flex: 1, paddingTop: 8},
    emptyText:       {fontSize: 12, color: C.textMuted, textAlign: 'center',
                      paddingVertical: 32, paddingHorizontal: 24, lineHeight: 20},
})
