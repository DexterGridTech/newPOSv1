import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { deviceAdapter } from '../../src/foundations/device'
import { C } from '../theme'

export default function DeviceScreen() {
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
            <Text style={s.title}>Device 设备信息</Text>
            <View style={s.row}>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.accent }]}
                    onPress={() => run(() => deviceAdapter.getDeviceInfo(), 'getDeviceInfo')}>
                    <Text style={s.btnText}>getDeviceInfo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.info }]}
                    onPress={() => run(() => deviceAdapter.getSystemStatus(), 'getSystemStatus')}>
                    <Text style={s.btnText}>getSystemStatus</Text>
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
    row:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
    btn:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnText:    { color: C.textInverse, fontSize: 13 },
    result:     { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16 },
    resultText: { color: C.textPrimary, fontSize: 12, fontFamily: 'monospace' },
})
