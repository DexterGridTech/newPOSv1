import React, {useState, useCallback} from 'react'
import {View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, FlatList} from 'react-native'
import {stateStorageAdapter} from '../../src/foundations/stateStorage'
import {C} from '../theme'

type LogEntry = {id: string; type: 'get' | 'set' | 'remove' | 'error'; key: string; value?: string}

export default function StateStorageScreen() {
    const [key, setKey] = useState('')
    const [value, setValue] = useState('')
    const [result, setResult] = useState<string | null>(null)
    const [log, setLog] = useState<LogEntry[]>([])

    const addLog = (entry: Omit<LogEntry, 'id'>) =>
        setLog(prev => [{...entry, id: String(Date.now())}, ...prev].slice(0, 50))

    const handleGet = useCallback(async () => {
        if (!key.trim()) return
        try {
            const val = await stateStorageAdapter.getItem(key.trim())
            const display = val === null ? '(null)' : JSON.stringify(val)
            setResult(display)
            addLog({type: 'get', key: key.trim(), value: display})
        } catch (e: any) {
            addLog({type: 'error', key: key.trim(), value: e?.message ?? String(e)})
        }
    }, [key])

    const handleSet = useCallback(async () => {
        if (!key.trim()) return
        try {
            let parsed: any = value
            try { parsed = JSON.parse(value) } catch {}
            await stateStorageAdapter.setItem(key.trim(), parsed)
            setResult('OK')
            addLog({type: 'set', key: key.trim(), value})
        } catch (e: any) {
            addLog({type: 'error', key: key.trim(), value: e?.message ?? String(e)})
        }
    }, [key, value])

    const handleRemove = useCallback(async () => {
        if (!key.trim()) return
        try {
            await stateStorageAdapter.removeItem(key.trim())
            setResult('Removed')
            addLog({type: 'remove', key: key.trim()})
        } catch (e: any) {
            addLog({type: 'error', key: key.trim(), value: e?.message ?? String(e)})
        }
    }, [key])

    return (
        <View style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitle}>StateStorage</Text>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">
                <View style={s.card}>
                    <Text style={s.label}>Key</Text>
                    <TextInput style={s.input} value={key} onChangeText={setKey} placeholder="输入 key" placeholderTextColor="#475569" />
                    <Text style={s.label}>Value (JSON)</Text>
                    <TextInput style={[s.input, s.inputMulti]} value={value} onChangeText={setValue}
                        placeholder="输入 value（支持 JSON）" placeholderTextColor="#475569" multiline />
                    <View style={s.btnRow}>
                        <TouchableOpacity style={[s.btn, s.btnGet]} onPress={handleGet}>
                            <Text style={s.btnText}>GET</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnSet]} onPress={handleSet}>
                            <Text style={s.btnText}>SET</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnRemove]} onPress={handleRemove}>
                            <Text style={s.btnText}>REMOVE</Text>
                        </TouchableOpacity>
                    </View>
                    {result !== null && (
                        <View style={s.resultBox}>
                            <Text style={s.resultLabel}>结果</Text>
                            <Text style={s.resultText}>{result}</Text>
                        </View>
                    )}
                </View>

                <Text style={s.sectionTitle}>操作记录</Text>
                <FlatList
                    data={log}
                    keyExtractor={i => i.id}
                    scrollEnabled={false}
                    renderItem={({item}) => (
                        <View style={s.logRow}>
                            <Text style={[s.logBadge, s[`badge_${item.type}`]]}>{item.type.toUpperCase()}</Text>
                            <View style={{flex: 1}}>
                                <Text style={s.logKey}>{item.key}</Text>
                                {item.value !== undefined && <Text style={s.logVal} numberOfLines={2}>{item.value}</Text>}
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
    root:           {flex: 1, backgroundColor: C.bgPage},
    header:         {paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border},
    headerTitle:    {fontSize: 16, fontWeight: '600', color: C.textPrimary, letterSpacing: 0.5},
    panel:          {flex: 1, padding: 16},
    card:           {backgroundColor: C.bgCard, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border},
    label:          {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 8},
    input:          {backgroundColor: C.bgInput, borderRadius: 6, padding: 10, color: C.textPrimary, fontSize: 13, borderWidth: 1, borderColor: C.border},
    inputMulti:     {minHeight: 72, textAlignVertical: 'top'},
    btnRow:         {flexDirection: 'row', gap: 8, marginTop: 12},
    btn:            {flex: 1, borderRadius: 6, paddingVertical: 10, alignItems: 'center'},
    btnGet:         {backgroundColor: C.info},
    btnSet:         {backgroundColor: C.accent},
    btnRemove:      {backgroundColor: C.danger},
    btnText:        {color: C.textInverse, fontWeight: '700', fontSize: 12},
    resultBox:      {backgroundColor: C.accentBg, borderRadius: 6, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0'},
    resultLabel:    {fontSize: 10, color: C.textSecondary, marginBottom: 4},
    resultText:     {fontSize: 13, color: C.accentText, fontFamily: 'monospace'},
    sectionTitle:   {fontSize: 11, color: C.textSecondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 8},
    logRow:         {flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: 6, padding: 10, marginBottom: 6, gap: 8, borderWidth: 1, borderColor: C.border},
    logBadge:       {fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', minWidth: 52, textAlign: 'center'},
    badge_get:      {backgroundColor: C.infoBg, color: C.info},
    badge_set:      {backgroundColor: C.accentBg, color: C.accent},
    badge_remove:   {backgroundColor: C.dangerBg, color: C.danger},
    badge_error:    {backgroundColor: C.warnBg, color: C.warn},
    logKey:         {fontSize: 12, color: C.textPrimary, fontFamily: 'monospace'},
    logVal:         {fontSize: 11, color: C.textSecondary, marginTop: 2},
    emptyText:      {fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 8},
})
