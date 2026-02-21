import React, {useState, useCallback} from 'react'
import {View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, FlatList} from 'react-native'
import {externalCallAdapter} from '../../src/foundations/externalCall'
import {CallType, CallMethod} from '@impos2/kernel-core-base'
import {C} from '../theme'

type LogEntry = {id: string; success: boolean; method: string; target: string; result: string; duration: number}

const METHODS: CallMethod[] = [CallMethod.INTENT, CallMethod.AIDL, CallMethod.SDK, CallMethod.SERIAL, CallMethod.USB, CallMethod.BLUETOOTH, CallMethod.NETWORK]
const TYPES: CallType[] = [CallType.APP, CallType.HARDWARE, CallType.SYSTEM]

const METHOD_COLOR: Record<CallMethod, string> = {
    [CallMethod.INTENT]:    C.info,
    [CallMethod.AIDL]:      C.accent,
    [CallMethod.SDK]:       '#7C3AED',
    [CallMethod.SERIAL]:    C.warn,
    [CallMethod.USB]:       '#0891B2',
    [CallMethod.BLUETOOTH]: '#DB2777',
    [CallMethod.NETWORK]:   '#059669',
}

export default function ExternalCallScreen() {
    const [type, setType]     = useState<CallType>(CallType.APP)
    const [method, setMethod] = useState<CallMethod>(CallMethod.INTENT)
    const [target, setTarget] = useState('com.example.app')
    const [action, setAction] = useState('android.intent.action.VIEW')
    const [params, setParams] = useState('{}')
    const [timeout, setTimeout_] = useState('5000')
    const [log, setLog]       = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [targets, setTargets] = useState<string[]>([])
    const [available, setAvailable] = useState<boolean | null>(null)

    const addLog = (entry: Omit<LogEntry, 'id'>) =>
        setLog(prev => [{...entry, id: String(Date.now())}, ...prev].slice(0, 50))

    const handleCall = useCallback(async () => {
        setLoading(true)
        try {
            let parsedParams: Record<string, any> = {}
            try { parsedParams = JSON.parse(params) } catch {}
            const res = await externalCallAdapter.call({
                type, method, target, action,
                params: parsedParams,
                timeout: parseInt(timeout) || 5000,
            })
            addLog({
                success: res.success,
                method,
                target,
                result: JSON.stringify(res.data ?? res.message),
                duration: res.duration,
            })
        } catch (e: any) {
            addLog({success: false, method, target, result: e?.message ?? String(e), duration: 0})
        } finally {
            setLoading(false)
        }
    }, [type, method, target, action, params, timeout])

    const handleIsAvailable = useCallback(async () => {
        try {
            const r = await externalCallAdapter.isAvailable(type, target)
            setAvailable(r)
        } catch { setAvailable(false) }
    }, [type, target])

    const handleGetTargets = useCallback(async () => {
        try {
            const r = await externalCallAdapter.getAvailableTargets(type)
            setTargets(r)
        } catch { setTargets([]) }
    }, [type])

    const handleCancel = useCallback(async () => {
        await externalCallAdapter.cancel()
        setLoading(false)
    }, [])

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>ExternalCall</Text>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">

                {/* Type */}
                <Text style={s.label}>Type</Text>
                <View style={s.row}>
                    {TYPES.map(t => (
                        <TouchableOpacity key={t} style={[s.chip, type === t && s.chipActive]} onPress={() => setType(t)}>
                            <Text style={[s.chipText, type === t && s.chipTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Method */}
                <Text style={s.label}>Method</Text>
                <View style={s.row}>
                    {METHODS.map(m => (
                        <TouchableOpacity key={m} style={[s.chip, method === m && {backgroundColor: METHOD_COLOR[m] + '22', borderColor: METHOD_COLOR[m]}]} onPress={() => setMethod(m)}>
                            <Text style={[s.chipText, {color: METHOD_COLOR[m]}]}>{m}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Fields */}
                <Text style={s.label}>Target</Text>
                <TextInput style={s.input} value={target} onChangeText={setTarget} placeholderTextColor={C.textMuted} placeholder="包名 / 设备路径 / URL" />

                <Text style={s.label}>Action</Text>
                <TextInput style={s.input} value={action} onChangeText={setAction} placeholderTextColor={C.textMuted} placeholder="Intent action / 方法名 / 路径" />

                <Text style={s.label}>Params (JSON)</Text>
                <TextInput style={[s.input, s.inputMulti]} value={params} onChangeText={setParams} placeholderTextColor={C.textMuted} placeholder="{}" multiline />

                <Text style={s.label}>Timeout (ms)</Text>
                <TextInput style={s.input} value={timeout} onChangeText={setTimeout_} placeholderTextColor={C.textMuted} keyboardType="numeric" />

                {/* Actions */}
                <View style={s.btnRow}>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.accent}]} onPress={handleCall} disabled={loading}>
                        <Text style={s.btnText}>{loading ? '...' : 'CALL'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.info}]} onPress={handleIsAvailable}>
                        <Text style={s.btnText}>CHECK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.warn}]} onPress={handleGetTargets}>
                        <Text style={s.btnText}>TARGETS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.danger}]} onPress={handleCancel}>
                        <Text style={s.btnText}>CANCEL</Text>
                    </TouchableOpacity>
                </View>

                {/* Available result */}
                {available !== null && (
                    <View style={[s.resultBox, {borderColor: available ? C.accent : C.danger}]}>
                        <Text style={[s.resultText, {color: available ? C.accent : C.danger}]}>
                            {available ? '✓ Available' : '✗ Not Available'}
                        </Text>
                    </View>
                )}

                {/* Targets list */}
                {targets.length > 0 && (
                    <View style={s.targetsBox}>
                        <Text style={s.label}>Available Targets ({targets.length})</Text>
                        {targets.slice(0, 10).map((t, i) => (
                            <TouchableOpacity key={i} onPress={() => setTarget(t)}>
                                <Text style={s.targetItem}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                        {targets.length > 10 && <Text style={s.targetMore}>+{targets.length - 10} more...</Text>}
                    </View>
                )}

                {/* Log */}
                <Text style={s.sectionTitle}>调用记录</Text>
                <FlatList
                    data={log}
                    keyExtractor={i => i.id}
                    scrollEnabled={false}
                    renderItem={({item}) => (
                        <View style={s.logRow}>
                            <View style={[s.dot, {backgroundColor: item.success ? C.accent : C.danger}]} />
                            <View style={{flex: 1}}>
                                <View style={{flexDirection: 'row', gap: 6, alignItems: 'center'}}>
                                    <Text style={[s.methodBadge, {color: METHOD_COLOR[item.method as CallMethod], borderColor: METHOD_COLOR[item.method as CallMethod]}]}>{item.method}</Text>
                                    <Text style={s.logTarget} numberOfLines={1}>{item.target}</Text>
                                    <Text style={s.logDuration}>{item.duration}ms</Text>
                                </View>
                                <Text style={s.logResult} numberOfLines={2}>{item.result}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={s.emptyText}>暂无记录</Text>}
                />
            </ScrollView>
        </View>
    )
}

const s = StyleSheet.create({
    root:         {flex: 1, backgroundColor: C.bgPage},
    header:       {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle:  {fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    panel:        {flex: 1, padding: 16},
    label:        {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 10},
    row:          {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4},
    chip:         {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard},
    chipActive:   {backgroundColor: C.accentBg, borderColor: C.accent},
    chipText:     {fontSize: 11, fontWeight: '600', color: C.textSecondary},
    chipTextActive:{color: C.accent},
    input:        {backgroundColor: C.bgInput, borderRadius: 6, padding: 10, color: C.textPrimary, fontSize: 13, borderWidth: 1, borderColor: C.border},
    inputMulti:   {minHeight: 60, textAlignVertical: 'top'},
    btnRow:       {flexDirection: 'row', gap: 8, marginTop: 14},
    btn:          {flex: 1, borderRadius: 6, paddingVertical: 10, alignItems: 'center'},
    btnText:      {color: C.textInverse, fontWeight: '700', fontSize: 12},
    resultBox:    {borderRadius: 6, padding: 10, marginTop: 10, borderWidth: 1, backgroundColor: C.bgCard},
    resultText:   {fontSize: 13, fontWeight: '600'},
    targetsBox:   {backgroundColor: C.bgCard, borderRadius: 6, padding: 10, marginTop: 10, borderWidth: 1, borderColor: C.border},
    targetItem:   {fontSize: 12, color: C.info, paddingVertical: 3, fontFamily: 'monospace'},
    targetMore:   {fontSize: 11, color: C.textMuted, marginTop: 4},
    sectionTitle: {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 8},
    logRow:       {flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: 6, padding: 10, marginBottom: 6, gap: 8, borderWidth: 1, borderColor: C.border},
    dot:          {width: 8, height: 8, borderRadius: 4, marginTop: 3},
    methodBadge:  {fontSize: 10, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1},
    logTarget:    {fontSize: 11, color: C.textSecondary, flex: 1},
    logDuration:  {fontSize: 10, color: C.textMuted},
    logResult:    {fontSize: 11, color: C.textPrimary, marginTop: 3, fontFamily: 'monospace'},
    emptyText:    {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 8},
})
