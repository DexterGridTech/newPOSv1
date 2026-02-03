import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { posAdapter } from '../../../src/adapters/PosAdapter'
import type { PosSystemStatus, PowerStatusChangeEvent } from '@impos2/kernel-base'

/**
 * SystemStatus 调试器
 *
 * 功能:
 * 1. 获取完整的系统状态
 * 2. 实时显示 CPU、内存、磁盘使用情况
 * 3. 显示电源状态和 GPS 定位
 * 4. 显示设备列表（USB、蓝牙、串口）
 * 5. 显示网络连接和已安装应用
 * 6. 支持电源状态变化监听
 */
export default function SystemStatusDebugger() {
  const [systemStatus, setSystemStatus] = useState<PosSystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [powerListening, setPowerListening] = useState(false)
  const [powerEvents, setPowerEvents] = useState<PowerStatusChangeEvent[]>([])
  const [unsubscribePower, setUnsubscribePower] = useState<(() => void) | null>(null)

  // 请求 GPS 权限
  const requestGpsPermission = async () => {
    try {
      const granted = await posAdapter.systemStatus.requestLocationPermission()
      if (granted) {
        Alert.alert('成功', 'GPS 权限已授予')
        // 权限授予后重新加载系统状态
        await loadSystemStatus()
      } else {
        Alert.alert('提示', 'GPS 权限被拒绝，无法获取位置信息。请点击"请求 GPS 权限"按钮重新授权。')
      }
      return granted
    } catch (error) {
      console.error('请求 GPS 权限失败:', error)
      Alert.alert('错误', `请求 GPS 权限失败: ${error}`)
      return false
    }
  }

  // 加载系统状态
  const loadSystemStatus = async () => {
    setLoading(true)
    try {
      const status = await posAdapter.systemStatus.getSystemStatus()
      setSystemStatus(status)

      // 检查 GPS 是否可用，如果不可用且是权限问题，提示用户
      if (!status.gps.available && status.gps.provider === 'no_permission') {
        Alert.alert(
          'GPS 权限未授予',
          '检测到 GPS 权限未授予，是否现在授权？',
          [
            { text: '取消', style: 'cancel' },
            { text: '授权', onPress: requestGpsPermission }
          ]
        )
      }
    } catch (error) {
      Alert.alert('错误', `获取系统状态失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时加载系统状态
  useEffect(() => {
    loadSystemStatus()
  }, [])

  // 切换电源监听
  const togglePowerListener = () => {
    if (powerListening) {
      stopPowerListener()
    } else {
      startPowerListener()
    }
  }

  // 开始监听电源状态
  const startPowerListener = () => {
    try {
      const unsubscribe = posAdapter.systemStatus.addPowerStatusChangeListener(
        (event: PowerStatusChangeEvent) => {
          setPowerEvents((prev) => [event, ...prev].slice(0, 10)) // 只保留最近 10 条
        }
      )
      setUnsubscribePower(() => unsubscribe)
      setPowerListening(true)
      Alert.alert('成功', '已开始监听电源状态变化')
    } catch (error) {
      Alert.alert('错误', `开始监听失败: ${error}`)
    }
  }

  // 停止监听电源状态
  const stopPowerListener = () => {
    try {
      if (unsubscribePower) {
        unsubscribePower()
        setUnsubscribePower(null)
      }
      setPowerListening(false)
      Alert.alert('成功', '已停止监听电源状态变化')
    } catch (error) {
      Alert.alert('错误', `停止监听失败: ${error}`)
    }
  }

  // 后续 UI 将在下一段继续...
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadSystemStatus} />
      }
    >
      <Text style={styles.title}>SystemStatus 调试器</Text>

      {/* 操作按钮 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, powerListening && styles.buttonActive]}
          onPress={togglePowerListener}
        >
          <Text style={styles.buttonText}>
            {powerListening ? '停止监听电源' : '开始监听电源'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonGps]}
          onPress={requestGpsPermission}
        >
          <Text style={styles.buttonText}>
            请求 GPS 权限
          </Text>
        </TouchableOpacity>
      </View>

      {/* 系统状态显示 */}
      {systemStatus && (
        <>
          {/* CPU 使用情况 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CPU 使用情况</Text>
            <Text style={styles.infoText}>整体使用率: {systemStatus.cpu.overall.toFixed(2)}%</Text>
            <Text style={styles.infoText}>应用使用率: {systemStatus.cpu.app.toFixed(2)}%</Text>
            <Text style={styles.infoText}>核心数: {systemStatus.cpu.cores}</Text>
          </View>

          {/* 内存使用情况 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>内存使用情况</Text>
            <Text style={styles.infoText}>总内存: {systemStatus.memory.total.toFixed(0)} MB</Text>
            <Text style={styles.infoText}>已使用: {systemStatus.memory.used.toFixed(0)} MB</Text>
            <Text style={styles.infoText}>可用: {systemStatus.memory.available.toFixed(0)} MB</Text>
            <Text style={styles.infoText}>使用率: {systemStatus.memory.overall.toFixed(2)}%</Text>
            <Text style={styles.infoText}>应用内存: {systemStatus.memory.app.toFixed(0)} MB</Text>
          </View>

          {/* 磁盘使用情况 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>磁盘使用情况</Text>
            <Text style={styles.infoText}>总容量: {systemStatus.disk.total.toFixed(2)} GB</Text>
            <Text style={styles.infoText}>已使用: {systemStatus.disk.used.toFixed(2)} GB</Text>
            <Text style={styles.infoText}>可用: {systemStatus.disk.available.toFixed(2)} GB</Text>
            <Text style={styles.infoText}>使用率: {systemStatus.disk.overall.toFixed(2)}%</Text>
            <Text style={styles.infoText}>应用占用: {systemStatus.disk.app.toFixed(2)} MB</Text>
          </View>

          {/* 电源状态 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>电源状态</Text>
            <Text style={styles.infoText}>
              电源连接: {systemStatus.power.powerConnected ? '已连接' : '未连接'}
            </Text>
            <Text style={styles.infoText}>
              充电状态: {systemStatus.power.isCharging ? '充电中' : '未充电'}
            </Text>
            <Text style={styles.infoText}>电池电量: {systemStatus.power.batteryLevel}%</Text>
            <Text style={styles.infoText}>
              电池状态: {getBatteryStatusText(systemStatus.power.batteryStatus)}
            </Text>
            <Text style={styles.infoText}>
              电池健康: {getBatteryHealthText(systemStatus.power.batteryHealth)}
            </Text>
          </View>

          {/* GPS 定位 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GPS 定位</Text>
            <Text style={styles.infoText}>
              可用: {systemStatus.gps.available ? '是' : '否'}
            </Text>
            {systemStatus.gps.available && (
              <>
                <Text style={styles.infoText}>纬度: {systemStatus.gps.latitude}</Text>
                <Text style={styles.infoText}>经度: {systemStatus.gps.longitude}</Text>
                <Text style={styles.infoText}>精度: {systemStatus.gps.accuracy} 米</Text>
                <Text style={styles.infoText}>提供者: {systemStatus.gps.provider}</Text>
              </>
            )}
          </View>

          {/* 设备列表 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>USB 设备 ({systemStatus.usbDevices.length})</Text>
            {systemStatus.usbDevices.map((device, index) => (
              <Text key={index} style={styles.deviceText}>
                {device.name}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              蓝牙设备 ({systemStatus.bluetoothDevices.length})
            </Text>
            {systemStatus.bluetoothDevices.map((device, index) => (
              <Text key={index} style={styles.deviceText}>
                {device.name} ({device.address})
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              网络连接 ({systemStatus.networks.length})
            </Text>
            {systemStatus.networks.map((network, index) => (
              <Text key={index} style={styles.deviceText}>
                {network.type}: {network.name} ({network.ipAddress})
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              已安装应用 ({systemStatus.installedApps.length})
            </Text>
            <Text style={styles.infoText}>
              (仅显示前 10 个)
            </Text>
            {systemStatus.installedApps.slice(0, 10).map((app, index) => (
              <Text key={index} style={styles.deviceText}>
                {app.appName} ({app.packageName})
              </Text>
            ))}
          </View>
        </>
      )}

      {/* 电源事件日志 */}
      {powerEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>电源状态变化日志 (最近 10 条)</Text>
          {powerEvents.map((event, index) => (
            <View key={index} style={styles.eventItem}>
              <Text style={styles.eventText}>
                🔌 电源: {event.powerConnected ? '已连接' : '未连接'} |
                ⚡ 充电: {event.isCharging ? '是' : '否'}
              </Text>
              <Text style={styles.eventText}>
                🔋 电量: {event.batteryLevel}% |
                状态: {getBatteryStatusText(event.batteryStatus)}
              </Text>
              {event.batteryHealth && (
                <Text style={styles.eventText}>
                  💚 健康: {getBatteryHealthText(event.batteryHealth)}
                </Text>
              )}
              <Text style={styles.eventTime}>
                {new Date(event.timestamp).toLocaleString('zh-CN')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// 辅助函数：转换电池状态文本
function getBatteryStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    charging: '充电中',
    discharging: '放电中',
    full: '已充满',
    not_charging: '未充电',
    unknown: '未知',
  }
  return statusMap[status] || status
}

// 辅助函数：转换电池健康状态文本
function getBatteryHealthText(health: string): string {
  const healthMap: Record<string, string> = {
    good: '良好',
    overheat: '过热',
    dead: '损坏',
    over_voltage: '过压',
    cold: '过冷',
    unknown: '未知',
  }
  return healthMap[health] || health
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a237e',
    paddingVertical: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976d2',
  },
  button: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#2196f3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonActive: {
    backgroundColor: '#ff5722',
    shadowColor: '#ff5722',
  },
  buttonGps: {
    backgroundColor: '#4caf50',
    shadowColor: '#4caf50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 13,
    color: '#424242',
    marginBottom: 6,
    lineHeight: 18,
  },
  deviceText: {
    fontSize: 11,
    color: '#616161',
    marginBottom: 3,
    lineHeight: 16,
  },
  eventItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e3f2fd',
    paddingVertical: 8,
    backgroundColor: '#fafafa',
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  eventText: {
    fontSize: 13,
    color: '#1565c0',
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 11,
    color: '#757575',
    marginTop: 3,
  },
})
