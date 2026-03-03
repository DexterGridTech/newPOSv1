import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { loggerAdapter } from '../../src/foundations/logger'
import { C } from '../theme'

export default function LoggerScreen() {
    const [result, setResult] = useState('')

    const run = async (fn: () => Promise<any>, label: string) => {
        try {
            const r = await fn()
            setResult(`[${label}]\n${JSON.stringify(r, null, 2)}`)
        } catch (e: any) {
            setResult(`[${label}] ERROR: ${e.message}`)
        }
    }

    const levels = ['debug', 'log', 'warn', 'error'] as const
    const levelColors: Record<string, string> = {
        debug: C.logDebug, log: C.logLog, warn: C.logWarn, error: C.logError,
    }

    return (
        <ScrollView style={s.root}>
            <Text style={s.title}>Logger 日志</Text>
            <View style={s.row}>
                {levels.map(level => (
                    <TouchableOpacity key={level}
                        style={[s.btn, { backgroundColor: levelColors[level] }]}
                        onPress={() => {
                            loggerAdapter[level](['dev', 'test'], `test ${level} message`, { ts: Date.now() })
                            setResult(`已调用 ${level}，查看控制台`)
                        }}>
                        <Text style={s.btnText}>{level}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={s.row}>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.info }]}
                    onPress={() => run(() => loggerAdapter.getLogFiles(), 'getLogFiles')}>
                    <Text style={s.btnText}>getLogFiles</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.accent }]}
                    onPress={() => run(() => loggerAdapter.getLogDirPath(), 'getLogDirPath')}>
                    <Text style={s.btnText}>getLogDirPath</Text>
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
    row:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    btn:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnText:    { color: C.textInverse, fontSize: 13 },
    result:     { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16 },
    resultText: { color: C.textPrimary, fontSize: 12, fontFamily: 'monospace' },
})
