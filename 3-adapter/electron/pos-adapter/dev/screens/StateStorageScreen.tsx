import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { stateStorageAdapter } from '../../src/foundations/stateStorage'
import { C } from '../theme'

export default function StateStorageScreen() {
    const [key, setKey] = useState('test-key')
    const [value, setValue] = useState('{"hello":"world"}')
    const [result, setResult] = useState('')

    const run = async (fn: () => Promise<any>, label: string) => {
        try {
            const r = await fn()
            setResult(`[${label}]\n${JSON.stringify(r, null, 2)}`)
        } catch (e: any) {
            setResult(`[${label}] ERROR: ${e.message}`)
        }
    }

    return (
        <ScrollView style={s.root}>
            <Text style={s.title}>StateStorage 状态存储</Text>
            <TextInput style={s.input} value={key} onChangeText={setKey} placeholder="key" />
            <TextInput style={s.input} value={value} onChangeText={setValue} placeholder="value (JSON)" />
            <View style={s.row}>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.accent }]}
                    onPress={() => run(() => stateStorageAdapter.setItem(key, JSON.parse(value)), 'setItem')}>
                    <Text style={s.btnText}>setItem</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.info }]}
                    onPress={() => run(() => stateStorageAdapter.getItem(key), 'getItem')}>
                    <Text style={s.btnText}>getItem</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.danger }]}
                    onPress={() => run(async () => { await stateStorageAdapter.removeItem(key); return 'removed' }, 'removeItem')}>
                    <Text style={s.btnText}>removeItem</Text>
                </TouchableOpacity>
            </View>
            <View style={s.result}>
                <Text style={s.resultText}>{result || '点击按钮测试'}</Text>
            </View>
        </ScrollView>
    )
}

const s = StyleSheet.create({
    root:       { flex: 1, padding: 20, backgroundColor: C.bgPage },
    title:      { fontSize: 16, fontWeight: '600', color: C.textPrimary, marginBottom: 16 },
    input:      { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, fontSize: 13, color: C.textPrimary },
    row:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
    btn:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnText:    { color: C.textInverse, fontSize: 13 },
    result:     { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16 },
    resultText: { color: C.textPrimary, fontSize: 12, fontFamily: 'monospace' },
})
