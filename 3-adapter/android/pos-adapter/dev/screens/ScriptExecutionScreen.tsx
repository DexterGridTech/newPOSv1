import React, {useState, useCallback} from 'react'
import {View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet} from 'react-native'
import {scriptExecutionAdapter} from '../../src/foundations/scriptExecution'
import NativeScriptsTurboModule from '../../src/supports/apis/NativeScriptsTurboModule'
import {C} from '../theme'

type LogEntry = {id: string; script: string; success: boolean; result: string; duration: number}

const PRESETS: {label: string; script: string; params?: string; globals?: string}[] = [
    {
        label: '基础运算',
        script: 'return params.a + params.b',
        params: '{"a": 10, "b": 20}',
    },
    {
        label: '全局变量',
        script: 'return "Hello, " + name + "!"',
        globals: '{"name": "World"}',
    },
    {
        label: '异步脚本',
        script: 'return new Promise(r => setTimeout(() => r("async done"), 100))',
        params: '{}',
    },
    {
        label: '原生函数',
        script: 'return greet(params.name)',
        params: '{"name": "POS"}',
    },
]

export default function ScriptExecutionScreen() {
    const [script, setScript]   = useState(PRESETS[0].script)
    const [params, setParams]   = useState(PRESETS[0].params ?? '{}')
    const [globals, setGlobals] = useState(PRESETS[0].globals ?? '{}')
    const [timeout, setTimeout_] = useState('3000')
    const [log, setLog]         = useState<LogEntry[]>([])
    const [stats, setStats]     = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const addLog = (entry: Omit<LogEntry, 'id'>) =>
        setLog(prev => [{...entry, id: String(Date.now())}, ...prev].slice(0, 30))

    const handleRun = useCallback(async () => {
        setLoading(true)
        const t0 = Date.now()
        try {
            let parsedParams: any = {}
            let parsedGlobals: any = {}
            try { parsedParams = JSON.parse(params) } catch {}
            try { parsedGlobals = JSON.parse(globals) } catch {}

            const result = await scriptExecutionAdapter.executeScript({
                script,
                params: parsedParams,
                globals: parsedGlobals,
                nativeFunctions: {
                    greet: (name: string) => `Hi, ${name}!`,
                },
                timeout: parseInt(timeout) || 3000,
            })
            addLog({script, success: true, result: JSON.stringify(result), duration: Date.now() - t0})
        } catch (e: any) {
            addLog({script, success: false, result: e?.message ?? String(e), duration: Date.now() - t0})
        } finally {
            setLoading(false)
        }
    }, [script, params, globals, timeout])

    const handleGetStats = useCallback(async () => {
        const s = await NativeScriptsTurboModule.getStats()
        setStats(s)
    }, [])

    const handleClearStats = useCallback(async () => {
        await NativeScriptsTurboModule.clearStats()
        setStats(null)
        setLog([])
    }, [])

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>ScriptExecution</Text>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">

                {/* Presets */}
                <Text style={s.label}>预设脚本</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                    <View style={s.row}>
                        {PRESETS.map(p => (
                            <TouchableOpacity key={p.label} style={s.chip} onPress={() => {
                                setScript(p.script)
                                setParams(p.params ?? '{}')
                                setGlobals(p.globals ?? '{}')
                            }}>
                                <Text style={s.chipText}>{p.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                {/* Script */}
                <Text style={s.label}>Script</Text>
                <TextInput style={[s.input, s.inputCode]} value={script} onChangeText={setScript}
                    placeholderTextColor={C.textMuted} placeholder="return ..." multiline />

                {/* Params / Globals */}
                <View style={s.row}>
                    <View style={{flex: 1}}>
                        <Text style={s.label}>Params (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={params} onChangeText={setParams}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                    <View style={{width: 8}} />
                    <View style={{flex: 1}}>
                        <Text style={s.label}>Globals (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={globals} onChangeText={setGlobals}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                </View>

                {/* Timeout */}
                <Text style={s.label}>Timeout (ms)</Text>
                <TextInput style={s.input} value={timeout} onChangeText={setTimeout_}
                    placeholderTextColor={C.textMuted} keyboardType="numeric" />

                {/* Actions */}
                <View style={s.btnRow}>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.accent}]} onPress={handleRun} disabled={loading}>
                        <Text style={s.btnText}>{loading ? '执行中...' : '▶ RUN'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.info}]} onPress={handleGetStats}>
                        <Text style={s.btnText}>STATS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, {backgroundColor: C.danger}]} onPress={handleClearStats}>
                        <Text style={s.btnText}>CLEAR</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                {stats && (
                    <View style={s.statsBox}>
                        <Text style={s.statsTitle}>执行统计</Text>
                        <View style={s.statsRow}>
                            {[
                                {label: '总计', value: stats.total},
                                {label: '成功', value: stats.success, color: C.accent},
                                {label: '失败', value: stats.failed, color: C.danger},
                                {label: '成功率', value: `${stats.successRate?.toFixed(1)}%`},
                                {label: '均耗时', value: `${stats.avgTime?.toFixed(0)}ms`},
                            ].map(item => (
                                <View key={item.label} style={s.statItem}>
                                    <Text style={[s.statValue, item.color ? {color: item.color} : {}]}>{item.value}</Text>
                                    <Text style={s.statLabel}>{item.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Log */}
                <Text style={s.sectionTitle}>执行记录</Text>
                {log.length === 0
                    ? <Text style={s.emptyText}>暂无记录</Text>
                    : log.map(item => (
                        <View key={item.id} style={s.logRow}>
                            <View style={[s.dot, {backgroundColor: item.success ? C.accent : C.danger}]} />
                            <View style={{flex: 1}}>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                    <Text style={s.logScript} numberOfLines={1}>{item.script}</Text>
                                    <Text style={s.logDuration}>{item.duration}ms</Text>
                                </View>
                                <Text style={[s.logResult, {color: item.success ? C.textPrimary : C.danger}]} numberOfLines={2}>
                                    {item.result}
                                </Text>
                            </View>
                        </View>
                    ))
                }
            </ScrollView>
        </View>
    )
}

const s = StyleSheet.create({
    root:        {flex: 1, backgroundColor: C.bgPage},
    header:      {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle: {fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    panel:       {flex: 1, padding: 16},
    label:       {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 10},
    row:         {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    chip:        {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard},
    chipText:    {fontSize: 11, fontWeight: '600', color: C.textSecondary},
    input:       {backgroundColor: C.bgInput, borderRadius: 6, padding: 10, color: C.textPrimary, fontSize: 13, borderWidth: 1, borderColor: C.border},
    inputCode:   {minHeight: 80, fontFamily: 'monospace', textAlignVertical: 'top'},
    inputSmall:  {minHeight: 56, textAlignVertical: 'top', fontSize: 12},
    btnRow:      {flexDirection: 'row', gap: 8, marginTop: 14},
    btn:         {flex: 1, borderRadius: 6, paddingVertical: 10, alignItems: 'center'},
    btnText:     {color: C.textInverse, fontWeight: '700', fontSize: 12},
    statsBox:    {backgroundColor: C.bgCard, borderRadius: 6, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.border},
    statsTitle:  {fontSize: 11, color: C.textSecondary, fontWeight: '600', marginBottom: 8},
    statsRow:    {flexDirection: 'row', justifyContent: 'space-between'},
    statItem:    {alignItems: 'center'},
    statValue:   {fontSize: 16, fontWeight: '700', color: C.textPrimary},
    statLabel:   {fontSize: 10, color: C.textMuted, marginTop: 2},
    sectionTitle:{fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 8},
    logRow:      {flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: 6, padding: 10, marginBottom: 6, gap: 8, borderWidth: 1, borderColor: C.border},
    dot:         {width: 8, height: 8, borderRadius: 4, marginTop: 3},
    logScript:   {fontSize: 11, color: C.textSecondary, flex: 1, fontFamily: 'monospace'},
    logDuration: {fontSize: 10, color: C.textMuted},
    logResult:   {fontSize: 12, marginTop: 3, fontFamily: 'monospace'},
    emptyText:   {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 8},
})
