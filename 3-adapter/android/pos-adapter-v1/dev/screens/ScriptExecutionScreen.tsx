import React, {useState} from 'react'
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native'
import {scriptExecution, getExecutionStats, clearCache} from '../../src/foundations/scriptExecution'

const PRESET_SCRIPTS = [
    {
        name: 'Basic Math',
        script: 'const result = params.a + params.b; result',
        params: {a: 10, b: 20},
        globals: {},
        nativeFunctions: []
    },
    {
        name: 'Global Variables',
        script: 'const sum = __globals.x + __globals.y; sum * 2',
        params: {},
        globals: {x: 5, y: 15},
        nativeFunctions: []
    },
    {
        name: 'Native Function',
        script: 'const data = getNativeData(); data.value * 3',
        params: {},
        globals: {},
        nativeFunctions: ['getNativeData']
    },
    {
        name: 'Fibonacci',
        script: `
function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}
fib(params.n)
        `,
        params: {n: 10},
        globals: {},
        nativeFunctions: []
    },
    {
        name: 'Timeout Test',
        script: 'while(true) {}',
        params: {},
        globals: {},
        nativeFunctions: []
    }
]

export default function ScriptExecutionScreen() {
    const [script, setScript] = useState(PRESET_SCRIPTS[0].script)
    const [params, setParams] = useState(JSON.stringify(PRESET_SCRIPTS[0].params, null, 2))
    const [globals, setGlobals] = useState(JSON.stringify(PRESET_SCRIPTS[0].globals, null, 2))
    const [nativeFunctions, setNativeFunctions] = useState('')
    const [timeout, setTimeout] = useState('5000')
    const [result, setResult] = useState('')
    const [stats, setStats] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const executeScript = async () => {
        setLoading(true)
        setResult('')

        try {
            const startTime = Date.now()

            const execResult = await scriptExecution.executeScript({
                script,
                params: JSON.parse(params || '{}'),
                globals: JSON.parse(globals || '{}'),
                nativeFunctions: nativeFunctions.split(',').map(f => f.trim()).filter(Boolean).reduce((acc, name) => {
                    acc[name] = () => ({value: 42})
                    return acc
                }, {} as Record<string, any>),
                timeout: parseInt(timeout, 10)
            })

            const duration = Date.now() - startTime

            setResult(JSON.stringify({success: true, result: execResult}, null, 2))

            setHistory(prev => [{
                timestamp: new Date().toISOString(),
                duration,
                success: true,
                result: execResult
            }, ...prev].slice(0, 20))

            const newStats = await getExecutionStats()
            setStats(newStats)
        } catch (error: any) {
            setResult(JSON.stringify({
                success: false,
                error: error.name || 'ERROR',
                message: error.message,
                stack: error.stack
            }, null, 2))
        } finally {
            setLoading(false)
        }
    }

    const loadPreset = (index: number) => {
        const preset = PRESET_SCRIPTS[index]
        setScript(preset.script)
        setParams(JSON.stringify(preset.params, null, 2))
        setGlobals(JSON.stringify(preset.globals, null, 2))
        setNativeFunctions(preset.nativeFunctions.join(', '))
    }

    const handleClearCache = async () => {
        await clearCache()
        const newStats = await getExecutionStats()
        setStats(newStats)
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Script Execution Test</Text>

            <View style={styles.presetContainer}>
                {PRESET_SCRIPTS.map((preset, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.presetButton}
                        onPress={() => loadPreset(index)}
                    >
                        <Text style={styles.presetText}>{preset.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Script:</Text>
            <TextInput
                style={styles.scriptInput}
                value={script}
                onChangeText={setScript}
                multiline
                placeholder="Enter JavaScript code..."
            />

            <Text style={styles.label}>Params (JSON):</Text>
            <TextInput
                style={styles.input}
                value={params}
                onChangeText={setParams}
                multiline
                placeholder='{"key": "value"}'
            />

            <Text style={styles.label}>Globals (JSON):</Text>
            <TextInput
                style={styles.input}
                value={globals}
                onChangeText={setGlobals}
                multiline
                placeholder='{"key": "value"}'
            />

            <Text style={styles.label}>Native Functions (comma-separated):</Text>
            <TextInput
                style={styles.input}
                value={nativeFunctions}
                onChangeText={setNativeFunctions}
                placeholder="func1, func2"
            />

            <Text style={styles.label}>Timeout (ms):</Text>
            <TextInput
                style={styles.input}
                value={timeout}
                onChangeText={setTimeout}
                keyboardType="numeric"
                placeholder="5000"
            />

            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={executeScript}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Executing...' : 'Execute Script'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearButton} onPress={handleClearCache}>
                <Text style={styles.buttonText}>Clear Cache</Text>
            </TouchableOpacity>

            {result && (
                <>
                    <Text style={styles.label}>Result:</Text>
                    <ScrollView style={styles.resultContainer}>
                        <Text style={styles.resultText}>{result}</Text>
                    </ScrollView>
                </>
            )}

            {stats && (
                <>
                    <Text style={styles.label}>Statistics:</Text>
                    <View style={styles.statsContainer}>
                        <Text>Total Executions: {stats.totalExecutions}</Text>
                        <Text>Cache Hits: {stats.cacheHits}</Text>
                        <Text>Cache Misses: {stats.cacheMisses}</Text>
                        <Text>Hit Rate: {(stats.cacheHitRate * 100).toFixed(2)}%</Text>
                    </View>
                </>
            )}

            {history.length > 0 && (
                <>
                    <Text style={styles.label}>History (Last 20):</Text>
                    {history.map((item, index) => (
                        <View key={index} style={styles.historyItem}>
                            <Text style={styles.historyText}>
                                {item.timestamp} - {item.duration}ms -
                                {item.success ? ' ✓' : ' ✗'}
                            </Text>
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#fff'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16
    },
    presetContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16
    },
    presetButton: {
        backgroundColor: '#007AFF',
        padding: 8,
        borderRadius: 4,
        margin: 4
    },
    presetText: {
        color: '#fff',
        fontSize: 12
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 4
    },
    scriptInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        minHeight: 120,
        fontFamily: 'monospace',
        fontSize: 12
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        minHeight: 60,
        fontFamily: 'monospace',
        fontSize: 12
    },
    button: {
        backgroundColor: '#34C759',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16
    },
    buttonDisabled: {
        backgroundColor: '#ccc'
    },
    clearButton: {
        backgroundColor: '#FF3B30',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    resultContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        maxHeight: 200,
        backgroundColor: '#f5f5f5'
    },
    resultText: {
        fontFamily: 'monospace',
        fontSize: 12
    },
    statsContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 12,
        backgroundColor: '#f9f9f9'
    },
    historyItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 8
    },
    historyText: {
        fontSize: 12,
        fontFamily: 'monospace'
    }
})

