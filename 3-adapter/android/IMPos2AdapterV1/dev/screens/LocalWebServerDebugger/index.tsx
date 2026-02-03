import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native'
import { posAdapter } from '../../../src/adapters/PosAdapter'
import type { LocalWebServerInfo, ServerStats, LocalWebServerStatus } from '@impos2/kernel-base'

/**
 * LocalWebServer 调试器
 *
 * 功能:
 * 1. 启动/停止 LocalWebServer
 * 2. 配置服务器参数（端口、路径、心跳间隔）
 * 3. 显示服务器状态和地址列表
 * 4. 显示统计信息（Master/Slave 设备数量、运行时间）
 * 5. 实时刷新服务器状态
 */
export default function LocalWebServerDebugger() {
  const [serverInfo, setServerInfo] = useState<LocalWebServerInfo | null>(null)
  const [serverStats, setServerStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(false)

  // 配置参数
  const [port, setPort] = useState('8888')
  const [basePath, setBasePath] = useState('/localServer')
  const [heartbeatInterval, setHeartbeatInterval] = useState('30000')
  const [heartbeatTimeout, setHeartbeatTimeout] = useState('60000')

  // 加载服务器状态
  const loadServerStatus = async () => {
    setLoading(true)
    try {
      const status = await posAdapter.localWebServer.getLocalWebServerStatus()
      setServerInfo(status)

      // 如果服务器正在运行，获取统计信息
      if (status.status === 'RUNNING' || status.status === 'running') {
        const stats = await posAdapter.localWebServer.getLocalWebServerStats()
        setServerStats(stats)
      } else {
        setServerStats(null)
      }
    } catch (error) {
      Alert.alert('错误', `获取服务器状态失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时加载状态
  useEffect(() => {
    loadServerStatus()
  }, [])

  // 启动服务器
  const startServer = async () => {
    try {
      setLoading(true)
      const config = {
        port: parseInt(port, 10),
        basePath,
        heartbeatInterval: parseInt(heartbeatInterval, 10),
        heartbeatTimeout: parseInt(heartbeatTimeout, 10),
      }

      // startLocalWebServer 现在返回地址列表
      const addresses = await posAdapter.localWebServer.startLocalWebServer(config)

      // 启动后重新获取完整状态
      await loadServerStatus()

      Alert.alert('成功', `服务器启动成功，获取到 ${addresses.length} 个地址`)
    } catch (error) {
      Alert.alert('错误', `启动服务器失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 停止服务器
  const stopServer = async () => {
    try {
      setLoading(true)

      // stopLocalWebServer 现在返回 void
      await posAdapter.localWebServer.stopLocalWebServer()

      // 停止后重新获取状态
      await loadServerStatus()

      Alert.alert('成功', '服务器已停止')
    } catch (error) {
      Alert.alert('错误', `停止服务器失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 获取状态样式
  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return styles.statusRunning
      case 'STOPPED':
        return styles.statusStopped
      case 'ERROR':
        return styles.statusError
      default:
        return styles.statusUnknown
    }
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadServerStatus} />
      }
    >
      <Text style={styles.title}>LocalWebServer 调试器</Text>

      {/* 操作按钮 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={startServer}
          disabled={loading || serverInfo?.status === 'RUNNING' || serverInfo?.status === 'running'}
        >
          <Text style={styles.buttonText}>启动服务器</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={stopServer}
          disabled={loading || (serverInfo?.status !== 'RUNNING' && serverInfo?.status !== 'running')}
        >
          <Text style={styles.buttonText}>停止服务器</Text>
        </TouchableOpacity>
      </View>

      {/* 服务器状态 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务器状态</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>状态:</Text>
          <Text style={[styles.value, getStatusStyle(serverInfo?.status)]}>
            {serverInfo?.status || 'UNKNOWN'}
          </Text>
        </View>
        {serverInfo?.error && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>错误:</Text>
            <Text style={[styles.value, styles.errorText]}>{serverInfo.error}</Text>
          </View>
        )}
      </View>

      {/* 配置参数 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>配置参数</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>端口:</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="numeric"
            editable={serverInfo?.status !== 'RUNNING' && serverInfo?.status !== 'running'}
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>路径:</Text>
          <TextInput
            style={styles.input}
            value={basePath}
            onChangeText={setBasePath}
            editable={serverInfo?.status !== 'RUNNING' && serverInfo?.status !== 'running'}
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>心跳间隔(ms):</Text>
          <TextInput
            style={styles.input}
            value={heartbeatInterval}
            onChangeText={setHeartbeatInterval}
            keyboardType="numeric"
            editable={serverInfo?.status !== 'RUNNING' && serverInfo?.status !== 'running'}
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>心跳超时(ms):</Text>
          <TextInput
            style={styles.input}
            value={heartbeatTimeout}
            onChangeText={setHeartbeatTimeout}
            keyboardType="numeric"
            editable={serverInfo?.status !== 'RUNNING' && serverInfo?.status !== 'running'}
          />
        </View>
      </View>

      {/* 服务器地址列表 */}
      {serverInfo?.addresses && serverInfo.addresses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务器地址</Text>
          {serverInfo.addresses.map((addr, index) => (
            <View key={index} style={styles.addressItem}>
              <Text style={styles.addressName}>{addr.name}</Text>
              <Text style={styles.addressUrl}>{addr.address}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 统计信息 */}
      {serverStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>统计信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Master 设备:</Text>
            <Text style={styles.value}>{serverStats.masterCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Slave 设备:</Text>
            <Text style={styles.value}>{serverStats.slaveCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>待注册设备:</Text>
            <Text style={styles.value}>{serverStats.pendingCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>运行时间:</Text>
            <Text style={styles.value}>
              {Math.floor(serverStats.uptime / 1000)} 秒
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  statusRunning: {
    color: '#34C759',
    fontWeight: 'bold',
  },
  statusStopped: {
    color: '#8E8E93',
  },
  statusError: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  statusUnknown: {
    color: '#8E8E93',
  },
  errorText: {
    color: '#FF3B30',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addressItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  addressName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressUrl: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
})
