import React, {useState, useCallback, useRef, useEffect} from 'react'
import {View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform} from 'react-native'
import {executeScriptAsObservable, executeConditionScriptAsObservable, registerScriptsExecution} from '@impos2/kernel-core-base'
import {scriptExecutionAdapter} from '../../src/foundations/scriptExecution'
import {C} from '../theme'
import {Subscription} from 'rxjs'

type LogEntry = {id: string; type: string; success: boolean; result: string; duration: number}

const SCRIPT_PRESETS = [
    {label: '基础运算', script: 'return params.a * params.b', args: '{"a": 6, "b": 7}', ctx: '{}'},
    {label: '上下文读取', script: 'return "Hello " + name', args: '{}', ctx: '{"name": "TaskSystem"}'},
    {label: '异步脚本', script: 'return new Promise(r => setTimeout(() => r(params.val + 1), 200))', args: '{"val": 41}', ctx: '{}'},
    {label: '脚本错误', script: 'throw new Error("intentional error")', args: '{}', ctx: '{}'},
]

const CONDITION_PRESETS = [
    {label: '条件为真', script: 'return params.x > 0', args: '{"x": 5}', ctx: '{}'},
    {label: '条件为假', script: 'return params.x > 0', args: '{"x": -1}', ctx: '{}'},
    {label: '条件错误', script: 'throw new Error("condition error")', args: '{}', ctx: '{}'},
]

const MONOSPACE = Platform.select({ios: 'Courier New', android: 'monospace'}) as string

let idCounter = 0
const nextId = () => String(++idCounter)

function tryParseJson(text: string): {value: any; error: string | null} {
    try {
        return {value: JSON.parse(text), error: null}
    } catch (e: any) {
        return {value: {}, error: e?.message ?? 'JSON 格式错误'}
    }
}

export default function TaskSystemScreen() {
    const [scriptCode, setScriptCode] = useState(SCRIPT_PRESETS[0].script)
    const [scriptArgs, setScriptArgs] = useState(SCRIPT_PRESETS[0].args)
    const [scriptCtx, setScriptCtx]   = useState(SCRIPT_PRESETS[0].ctx)
    const [condCode, setCondCode]     = useState(CONDITION_PRESETS[0].script)
    const [condArgs, setCondArgs]     = useState(CONDITION_PRESETS[0].args)
    const [condCtx, setCondCtx]       = useState(CONDITION_PRESETS[0].ctx)
    const [log, setLog]               = useState<LogEntry[]>([])
    const [scriptLoading, setScriptLoading] = useState(false)
    const [condLoading, setCondLoading]     = useState(false)

    const scriptSubRef = useRef<Subscription | null>(null)
    const condSubRef   = useRef<Subscription | null>(null)

    // 注册 adapter（在组件挂载时注册，避免模块顶层时序问题）
    useEffect(() => {
        registerScriptsExecution(scriptExecutionAdapter)
        return () => {
            // 组件卸载时清理所有订阅
            scriptSubRef.current?.unsubscribe()
            condSubRef.current?.unsubscribe()
        }
    }, [])

    const addLog = useCallback((entry: Omit<LogEntry, 'id'>) =>
        setLog(prev => [{...entry, id: nextId()}, ...prev].slice(0, 40)), [])

    const handleRunScript = useCallback(() => {
        const argsResult = tryParseJson(scriptArgs)
        const ctxResult  = tryParseJson(scriptCtx)

        if (argsResult.error) {
            addLog({type: 'parseError', success: false, result: `Args JSON 错误: ${argsResult.error}`, duration: 0})
            return
        }
        if (ctxResult.error) {
            addLog({type: 'parseError', success: false, result: `Context JSON 错误: ${ctxResult.error}`, duration: 0})
            return
        }

        setScriptLoading(true)
        const t0 = Date.now()
        scriptSubRef.current?.unsubscribe()
        scriptSubRef.current = executeScriptAsObservable(scriptCode, argsResult.value, ctxResult.value).subscribe({
            next: result => {
                addLog({
                    type: 'executeScript',
                    success: result.success,
                    result: result.success
                        ? JSON.stringify(result.data)
                        : `[${result.error?.code}] ${result.error?.message}`,
                    duration: Date.now() - t0,
                })
            },
            complete: () => setScriptLoading(false),
            error: () => setScriptLoading(false),
        })
    }, [scriptCode, scriptArgs, scriptCtx, addLog])

    const handleRunCondition = useCallback(() => {
        const argsResult = tryParseJson(condArgs)
        const ctxResult  = tryParseJson(condCtx)

        if (argsResult.error) {
            addLog({type: 'parseError', success: false, result: `Args JSON 错误: ${argsResult.error}`, duration: 0})
            return
        }
        if (ctxResult.error) {
            addLog({type: 'parseError', success: false, result: `Context JSON 错误: ${ctxResult.error}`, duration: 0})
            return
        }

        setCondLoading(true)
        const t0 = Date.now()
        condSubRef.current?.unsubscribe()
        condSubRef.current = executeConditionScriptAsObservable(condCode, argsResult.value, ctxResult.value).subscribe({
            next: result => {
                addLog({
                    type: 'conditionScript',
                    success: true,
                    result: `condition = ${result}`,
                    duration: Date.now() - t0,
                })
            },
            complete: () => setCondLoading(false),
            error: () => setCondLoading(false),
        })
    }, [condCode, condArgs, condCtx, addLog])

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>TaskSystem Observable</Text>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">

                {/* executeScriptAsObservable */}
                <Text style={s.sectionTitle}>executeScriptAsObservable</Text>

                <Text style={s.label}>预设</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                    <View style={s.row}>
                        {SCRIPT_PRESETS.map(p => (
                            <TouchableOpacity key={p.label} style={s.chip} onPress={() => {
                                setScriptCode(p.script)
                                setScriptArgs(p.args)
                                setScriptCtx(p.ctx)
                            }}>
                                <Text style={s.chipText}>{p.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <Text style={s.label}>Script</Text>
                <TextInput style={[s.input, s.inputCode, {fontFamily: MONOSPACE}]} value={scriptCode}
                    onChangeText={setScriptCode} placeholderTextColor={C.textMuted}
                    placeholder="return ..." multiline />

                <View style={s.twoCol}>
                    <View style={s.colItem}>
                        <Text style={s.label}>Args (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={scriptArgs} onChangeText={setScriptArgs}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                    <View style={s.colItem}>
                        <Text style={s.label}>Context (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={scriptCtx} onChangeText={setScriptCtx}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                </View>

                <TouchableOpacity style={[s.btn, {backgroundColor: C.accent}]}
                    onPress={handleRunScript} disabled={scriptLoading}>
                    <Text style={s.btnText}>{scriptLoading ? '执行中...' : '▶ RUN executeScript'}</Text>
                </TouchableOpacity>

                {/* executeConditionScriptAsObservable */}
                <Text style={[s.sectionTitle, {marginTop: 20}]}>executeConditionScriptAsObservable</Text>

                <Text style={s.label}>预设</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                    <View style={s.row}>
                        {CONDITION_PRESETS.map(p => (
                            <TouchableOpacity key={p.label} style={s.chip} onPress={() => {
                                setCondCode(p.script)
                                setCondArgs(p.args)
                                setCondCtx(p.ctx)
                            }}>
                                <Text style={s.chipText}>{p.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <Text style={s.label}>Condition Script</Text>
                <TextInput style={[s.input, s.inputCode, {fontFamily: MONOSPACE}]} value={condCode}
                    onChangeText={setCondCode} placeholderTextColor={C.textMuted}
                    placeholder="return true/false" multiline />

                <View style={s.twoCol}>
                    <View style={s.colItem}>
                        <Text style={s.label}>Args (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={condArgs} onChangeText={setCondArgs}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                    <View style={s.colItem}>
                        <Text style={s.label}>Context (JSON)</Text>
                        <TextInput style={[s.input, s.inputSmall]} value={condCtx} onChangeText={setCondCtx}
                            placeholderTextColor={C.textMuted} placeholder="{}" multiline />
                    </View>
                </View>

                <TouchableOpacity style={[s.btn, {backgroundColor: '#7C3AED'}]}
                    onPress={handleRunCondition} disabled={condLoading}>
                    <Text style={s.btnText}>{condLoading ? '执行中...' : '▶ RUN conditionScript'}</Text>
                </TouchableOpacity>

                {/* Log */}
                <View style={s.logHeader}>
                    <Text style={s.sectionTitle}>执行记录</Text>
                    <TouchableOpacity onPress={() => setLog([])}>
                        <Text style={s.clearText}>清空</Text>
                    </TouchableOpacity>
                </View>
                {log.length === 0
                    ? <Text style={s.emptyText}>暂无记录</Text>
                    : log.map(item => (
                        <View key={item.id} style={s.logRow}>
                            <View style={[s.dot, {backgroundColor: item.success ? C.accent : C.danger}]} />
                            <View style={{flex: 1}}>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                    <Text style={[s.logType, {
                                        color: item.type === 'conditionScript' ? '#7C3AED'
                                             : item.type === 'parseError' ? C.warn
                                             : C.info
                                    }]}>
                                        {item.type}
                                    </Text>
                                    {item.duration > 0 && <Text style={s.logDuration}>{item.duration}ms</Text>}
                                </View>
                                <Text style={[s.logResult, {
                                    color: item.success ? C.textPrimary : C.danger,
                                    fontFamily: MONOSPACE,
                                }]} numberOfLines={3}>
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
    sectionTitle:{fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6},
    label:       {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 8},
    row:         {flexDirection: 'row', flexWrap: 'wrap'},
    chip:        {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard, marginRight: 6},
    chipText:    {fontSize: 11, fontWeight: '600', color: C.textSecondary},
    twoCol:      {flexDirection: 'row'},
    colItem:     {flex: 1, marginRight: 4},
    input:       {backgroundColor: C.bgInput, borderRadius: 6, padding: 10, color: C.textPrimary, fontSize: 13, borderWidth: 1, borderColor: C.border},
    inputCode:   {minHeight: 64, textAlignVertical: 'top'},
    inputSmall:  {minHeight: 48, textAlignVertical: 'top', fontSize: 12},
    btn:         {borderRadius: 6, paddingVertical: 10, alignItems: 'center', marginTop: 10},
    btnText:     {color: C.textInverse, fontWeight: '700', fontSize: 12},
    logHeader:   {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8},
    clearText:   {fontSize: 11, color: C.danger},
    logRow:      {flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: 6, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.border},
    dot:         {width: 8, height: 8, borderRadius: 4, marginTop: 3, marginRight: 8},
    logType:     {fontSize: 10, fontWeight: '700', letterSpacing: 0.3},
    logDuration: {fontSize: 10, color: C.textMuted},
    logResult:   {fontSize: 12, marginTop: 3},
    emptyText:   {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 8},
})
