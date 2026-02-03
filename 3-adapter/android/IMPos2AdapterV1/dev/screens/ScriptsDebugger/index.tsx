import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native'
import { posAdapter } from '../../../src/adapters/PosAdapter'

/**
 * Scripts 调试器
 *
 * 功能:
 * 1. 执行自定义 JavaScript 脚本
 * 2. 支持参数传递、全局变量、原生函数注册
 * 3. 显示执行结果和错误信息
 * 4. 显示执行统计信息
 * 5. 提供常用脚本示例
 */
export default function ScriptsDebugger() {
  const [script, setScript] = useState('')
  const [params, setParams] = useState('{}')
  const [globals, setGlobals] = useState('{}')
  const [timeout, setTimeout] = useState('5000')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number>(0)
  const [stats, setStats] = useState<any>(null)

  // 执行脚本
  const executeScript = async () => {
    setResult(null)
    setError(null)
    setExecutionTime(0)

    try {
      // 解析参数
      const parsedParams = params ? JSON.parse(params) : {}
      const parsedGlobals = globals ? JSON.parse(globals) : {}
      const parsedTimeout = parseInt(timeout) || 5000

      const startTime = Date.now()

      // 执行脚本
      const scriptResult = await posAdapter.scripts.executeScript({
        script,
        params: parsedParams,
        globals: parsedGlobals,
        timeout: parsedTimeout,
      })

      const endTime = Date.now()
      setExecutionTime(endTime - startTime)
      setResult(scriptResult)
      Alert.alert('成功', '脚本执行成功')
    } catch (err: any) {
      setError(err.message || String(err))
      Alert.alert('错误', `脚本执行失败: ${err.message || String(err)}`)
    }
  }

  // 获取执行统计信息
  const loadStats = async () => {
    try {
      const statsData = await posAdapter.scripts.getExecutionStats()
      setStats(statsData)
    } catch (err: any) {
      Alert.alert('错误', `获取统计信息失败: ${err.message}`)
    }
  }

  // 清除统计信息
  const clearStats = async () => {
    try {
      await posAdapter.scripts.clearExecutionStats()
      setStats(null)
      Alert.alert('成功', '统计信息已清除')
    } catch (err: any) {
      Alert.alert('错误', `清除统计信息失败: ${err.message}`)
    }
  }

  // 加载示例脚本
  const loadExample = (exampleType: string) => {
    switch (exampleType) {
      case 'simple':
        setScript('return 1 + 1')
        setParams('{}')
        setGlobals('{}')
        break
      case 'params':
        setScript('return params.a + params.b')
        setParams('{"a": 10, "b": 20}')
        setGlobals('{}')
        break
      case 'globals':
        setScript('return x * y')
        setParams('{}')
        setGlobals('{"x": 5, "y": 6}')
        break
      case 'complex':
        setScript(`
const sum = params.numbers.reduce((acc, num) => acc + num, 0);
const avg = sum / params.numbers.length;
return { sum, avg, count: params.numbers.length };
        `.trim())
        setParams('{"numbers": [1, 2, 3, 4, 5]}')
        setGlobals('{}')
        break
      case 'string':
        setScript('return params.text.toUpperCase()')
        setParams('{"text": "hello world"}')
        setGlobals('{}')
        break
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Scripts 调试器</Text>

      {/* 示例脚本按钮 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>示例脚本</Text>
        <View style={styles.exampleButtons}>
          <TouchableOpacity
            style={styles.exampleButton}
            onPress={() => loadExample('simple')}
          >
            <Text style={styles.exampleButtonText}>简单计算</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exampleButton}
            onPress={() => loadExample('params')}
          >
            <Text style={styles.exampleButtonText}>使用参数</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exampleButton}
            onPress={() => loadExample('globals')}
          >
            <Text style={styles.exampleButtonText}>全局变量</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.exampleButtons}>
          <TouchableOpacity
            style={styles.exampleButton}
            onPress={() => loadExample('complex')}
          >
            <Text style={styles.exampleButtonText}>复杂计算</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exampleButton}
            onPress={() => loadExample('string')}
          >
            <Text style={styles.exampleButtonText}>字符串处理</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 脚本输入 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>脚本代码</Text>
        <TextInput
          style={styles.scriptInput}
          value={script}
          onChangeText={setScript}
          placeholder="输入 JavaScript 代码..."
          multiline
          numberOfLines={6}
        />
      </View>

      {/* 参数输入 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>参数 (JSON)</Text>
        <TextInput
          style={styles.input}
          value={params}
          onChangeText={setParams}
          placeholder='{"key": "value"}'
          multiline
        />
      </View>

      {/* 全局变量输入 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>全局变量 (JSON)</Text>
        <TextInput
          style={styles.input}
          value={globals}
          onChangeText={setGlobals}
          placeholder='{"x": 10, "y": 20}'
          multiline
        />
      </View>

      {/* 超时设置 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>超时时间 (毫秒)</Text>
        <TextInput
          style={styles.input}
          value={timeout}
          onChangeText={setTimeout}
          placeholder="5000"
          keyboardType="numeric"
        />
      </View>

      {/* 执行按钮 */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.button} onPress={executeScript}>
          <Text style={styles.buttonText}>执行脚本</Text>
        </TouchableOpacity>
      </View>

      {/* 执行结果 */}
      {result !== null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>执行结果</Text>
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>
              {typeof result === 'object'
                ? JSON.stringify(result, null, 2)
                : String(result)}
            </Text>
          </View>
          <Text style={styles.infoText}>执行时间: {executionTime}ms</Text>
        </View>
      )}

      {/* 错误信息 */}
      {error && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>错误信息</Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      )}

      {/* 统计信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>执行统计</Text>
        <View style={styles.statsButtons}>
          <TouchableOpacity style={styles.statsButton} onPress={loadStats}>
            <Text style={styles.statsButtonText}>获取统计</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statsButton} onPress={clearStats}>
            <Text style={styles.statsButtonText}>清除统计</Text>
          </TouchableOpacity>
        </View>
        {stats && (
          <View style={styles.statsBox}>
            <Text style={styles.infoText}>总执行次数: {stats.totalExecutions}</Text>
            <Text style={styles.infoText}>成功次数: {stats.successfulExecutions}</Text>
            <Text style={styles.infoText}>失败次数: {stats.failedExecutions}</Text>
            <Text style={styles.infoText}>
              成功率: {stats.successRate.toFixed(2)}%
            </Text>
            <Text style={styles.infoText}>
              平均执行时间: {stats.averageExecutionTime.toFixed(2)}ms
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  exampleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exampleButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  exampleButtonText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  scriptInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#2e7d32',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 4,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#c62828',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  statsButtonText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  statsBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
  },
})

