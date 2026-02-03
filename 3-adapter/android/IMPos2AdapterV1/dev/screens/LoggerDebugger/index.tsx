import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native'
import { posAdapter } from '../../../src/adapters/PosAdapter'
import type { LogFile } from '@impos2/kernel-base'

/**
 * Logger 调试器
 *
 * 功能:
 * 1. 测试所有日志级别 (debug/log/warn/error)
 * 2. 查看日志文件列表
 * 3. 查看日志文件内容
 * 4. 删除日志文件
 * 5. 清空所有日志
 * 6. 查看日志目录路径
 * 7. 预设测试场景
 */
export default function LoggerDebugger() {
  // 日志写入相关状态
  const [logLevel, setLogLevel] = useState<'debug' | 'log' | 'warn' | 'error'>('log')
  const [logTag, setLogTag] = useState('TestTag')
  const [logMessage, setLogMessage] = useState('测试日志消息')

  // 日志文件相关状态
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [logContent, setLogContent] = useState<string>('')
  const [logDirPath, setLogDirPath] = useState<string>('')

  // 加载日志文件列表
  const loadLogFiles = async () => {
    try {
      const files = await posAdapter.logger.getLogFiles()
      setLogFiles(files)
    } catch (error) {
      Alert.alert('错误', `加载日志文件列表失败: ${error}`)
    }
  }

  // 组件挂载时加载日志文件列表和目录路径
  useEffect(() => {
    loadLogFiles()
    loadLogDirPath()
  }, [])

  // 加载日志目录路径
  const loadLogDirPath = async () => {
    try {
      const path = await posAdapter.logger.getLogDirPath()
      setLogDirPath(path)
    } catch (error) {
      Alert.alert('错误', `获取日志目录路径失败: ${error}`)
    }
  }

  // 写入日志
  const writeLog = () => {
    try {
      switch (logLevel) {
        case 'debug':
          posAdapter.logger.debug(logTag, logMessage)
          break
        case 'log':
          posAdapter.logger.log(logTag, logMessage)
          break
        case 'warn':
          posAdapter.logger.warn(logTag, logMessage)
          break
        case 'error':
          posAdapter.logger.error(logTag, logMessage)
          break
      }
      Alert.alert('成功', `已写入 ${logLevel.toUpperCase()} 日志`)
      // 刷新日志文件列表
      setTimeout(loadLogFiles, 500)
    } catch (error) {
      Alert.alert('错误', `写入日志失败: ${error}`)
    }
  }

  // 查看日志文件内容
  const viewLogContent = async (fileName: string) => {
    try {
      const content = await posAdapter.logger.getLogContent(fileName)
      setSelectedFile(fileName)
      setLogContent(content)
    } catch (error) {
      Alert.alert('错误', `读取日志文件失败: ${error}`)
    }
  }

  // 删除日志文件
  const deleteLog = async (fileName: string) => {
    try {
      const success = await posAdapter.logger.deleteLogFile(fileName)
      if (success) {
        Alert.alert('成功', '日志文件已删除')
        loadLogFiles()
        if (selectedFile === fileName) {
          setSelectedFile('')
          setLogContent('')
        }
      } else {
        Alert.alert('失败', '删除日志文件失败')
      }
    } catch (error) {
      Alert.alert('错误', `删除日志文件失败: ${error}`)
    }
  }

  // 清空所有日志
  const clearAll = async () => {
    Alert.alert(
      '确认',
      '确定要清空所有日志文件吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await posAdapter.logger.clearAllLogs()
              if (success) {
                Alert.alert('成功', '所有日志已清空')
                loadLogFiles()
                setSelectedFile('')
                setLogContent('')
              } else {
                Alert.alert('失败', '清空日志失败')
              }
            } catch (error) {
              Alert.alert('错误', `清空日志失败: ${error}`)
            }
          },
        },
      ]
    )
  }

  // 预设测试场景
  const runPresetTest = (testName: string) => {
    switch (testName) {
      case 'allLevels':
        posAdapter.logger.debug('PresetTest', '这是一条 DEBUG 日志')
        posAdapter.logger.log('PresetTest', '这是一条 INFO 日志')
        posAdapter.logger.warn('PresetTest', '这是一条 WARN 日志')
        posAdapter.logger.error('PresetTest', '这是一条 ERROR 日志')
        Alert.alert('成功', '已写入所有级别的日志')
        setTimeout(loadLogFiles, 500)
        break
      case 'multiLine':
        posAdapter.logger.log('PresetTest', '多行日志测试\n第二行\n第三行\n第四行')
        Alert.alert('成功', '已写入多行日志')
        setTimeout(loadLogFiles, 500)
        break
      case 'longMessage':
        const longMsg = '这是一条很长的日志消息'.repeat(20)
        posAdapter.logger.log('PresetTest', longMsg)
        Alert.alert('成功', '已写入长消息日志')
        setTimeout(loadLogFiles, 500)
        break
      case 'batch':
        for (let i = 0; i < 10; i++) {
          posAdapter.logger.log('BatchTest', `批量日志 ${i + 1}/10`)
        }
        Alert.alert('成功', '已写入 10 条批量日志')
        setTimeout(loadLogFiles, 500)
        break
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Logger 调试器</Text>

      {/* 日志目录路径 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>日志目录</Text>
        <Text style={styles.pathText}>{logDirPath}</Text>
      </View>

      {/* 日志写入区域 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>写入日志</Text>

        {/* 日志级别选择 */}
        <View style={styles.levelContainer}>
          {(['debug', 'log', 'warn', 'error'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelButton,
                logLevel === level && styles.levelButtonActive,
                level === 'debug' && styles.levelDebug,
                level === 'log' && styles.levelLog,
                level === 'warn' && styles.levelWarn,
                level === 'error' && styles.levelError,
              ]}
              onPress={() => setLogLevel(level)}
            >
              <Text
                style={[
                  styles.levelButtonText,
                  logLevel === level && styles.levelButtonTextActive,
                ]}
              >
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tag 输入 */}
        <Text style={styles.label}>Tag:</Text>
        <TextInput
          style={styles.input}
          value={logTag}
          onChangeText={setLogTag}
          placeholder="输入 Tag"
        />

        {/* Message 输入 */}
        <Text style={styles.label}>Message:</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={logMessage}
          onChangeText={setLogMessage}
          placeholder="输入日志消息"
          multiline
        />

        {/* 写入按钮 */}
        <TouchableOpacity style={styles.primaryButton} onPress={writeLog}>
          <Text style={styles.primaryButtonText}>写入日志</Text>
        </TouchableOpacity>
      </View>

      {/* 预设测试场景 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>预设测试场景</Text>
        <View style={styles.presetContainer}>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => runPresetTest('allLevels')}
          >
            <Text style={styles.presetButtonText}>所有级别</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => runPresetTest('multiLine')}
          >
            <Text style={styles.presetButtonText}>多行日志</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => runPresetTest('longMessage')}
          >
            <Text style={styles.presetButtonText}>长消息</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => runPresetTest('batch')}
          >
            <Text style={styles.presetButtonText}>批量写入</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 日志文件列表 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>日志文件列表</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadLogFiles}>
            <Text style={styles.refreshButtonText}>刷新</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
            <Text style={styles.clearButtonText}>清空全部</Text>
          </TouchableOpacity>
        </View>

        {logFiles.length === 0 ? (
          <Text style={styles.emptyText}>暂无日志文件</Text>
        ) : (
          logFiles.map((file) => (
            <View key={file.name} style={styles.fileItem}>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{file.name}</Text>
                <Text style={styles.fileSize}>
                  {(file.size / 1024).toFixed(2)} KB
                </Text>
                <Text style={styles.fileDate}>
                  {new Date(file.lastModified).toLocaleString('zh-CN')}
                </Text>
              </View>
              <View style={styles.fileActions}>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => viewLogContent(file.name)}
                >
                  <Text style={styles.viewButtonText}>查看</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteLog(file.name)}
                >
                  <Text style={styles.deleteButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 日志内容显示 */}
      {selectedFile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日志内容: {selectedFile}</Text>
          <ScrollView style={styles.contentContainer}>
            <Text style={styles.contentText}>{logContent || '(空)'}</Text>
          </ScrollView>
        </View>
      )}
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
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pathText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  messageInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  levelContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  levelButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  levelButtonActive: {
    borderWidth: 2,
  },
  levelDebug: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  levelLog: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  levelWarn: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
  },
  levelError: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  levelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  levelButtonTextActive: {
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  presetButtonText: {
    fontSize: 14,
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 'auto',
    marginRight: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  fileItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    marginBottom: 8,
  },
  fileInfo: {
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 12,
    color: '#999',
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    maxHeight: 300,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
  },
  contentText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
})
