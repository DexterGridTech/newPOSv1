import { NativeModules, NativeEventEmitter } from 'react-native'
import type {
  ISystemStatusAdapter,
  PosSystemStatus,
  PowerStatusChangeEvent,
} from '@impos2/kernel-base'

const { SystemStatusTurboModule } = NativeModules

if (!SystemStatusTurboModule) {
  throw new Error('SystemStatusTurboModule not found. Please check native module registration.')
}

/**
 * SystemStatus 适配器实现
 *
 * 优化点:
 * 1. 统一的错误处理
 * 2. 类型安全的接口封装
 * 3. 支持多 ReactInstanceManager 场景
 * 4. 支持电源状态变化监听
 */
export class SystemStatusAdapter implements ISystemStatusAdapter {
  private eventEmitter: NativeEventEmitter
  private powerStatusListeners: Set<(event: PowerStatusChangeEvent) => void>
  private powerStatusSubscription: any

  constructor() {
    this.eventEmitter = new NativeEventEmitter(SystemStatusTurboModule)
    this.powerStatusListeners = new Set()
    this.powerStatusSubscription = null
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<PosSystemStatus> {
    try {
      const status = await SystemStatusTurboModule.getSystemStatus()
      return status as PosSystemStatus
    } catch (error) {
      console.error('[SystemStatusAdapter] getSystemStatus 失败:', error)
      throw error
    }
  }

  /**
   * 请求 GPS 定位权限
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      const granted = await SystemStatusTurboModule.requestLocationPermission()
      return granted
    } catch (error) {
      console.error('[SystemStatusAdapter] requestLocationPermission 失败:', error)
      return false
    }
  }

  /**
   * 获取实时 GPS 位置
   */
  async getCurrentLocation(): Promise<any> {
    try {
      const location = await SystemStatusTurboModule.getCurrentLocation()
      return location
    } catch (error) {
      console.error('[SystemStatusAdapter] getCurrentLocation 失败:', error)
      throw error
    }
  }

  /**
   * 添加电源状态变化监听器
   */
  addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void {
    // 如果是第一个监听器,启动原生监听
    if (this.powerStatusListeners.size === 0) {
      this.setupPowerStatusListener()
    }

    this.powerStatusListeners.add(listener)

    // 返回取消监听的函数
    return () => {
      this.removePowerStatusChangeListener(listener)
    }
  }

  /**
   * 移除电源状态变化监听器
   */
  removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void {
    this.powerStatusListeners.delete(listener)

    // 如果没有监听器了,停止原生监听
    if (this.powerStatusListeners.size === 0) {
      this.teardownPowerStatusListener()
    }
  }

  /**
   * 设置电源状态监听
   */
  private setupPowerStatusListener(): void {
    try {
      SystemStatusTurboModule.startPowerStatusListener()

      this.powerStatusSubscription = this.eventEmitter.addListener(
        'onPowerStatusChanged',
        (event: PowerStatusChangeEvent) => {
          this.powerStatusListeners.forEach((listener) => {
            try {
              listener(event)
            } catch (error) {
              console.error('[SystemStatusAdapter] 电源状态监听器执行失败:', error)
            }
          })
        }
      )
    } catch (error) {
      console.error('[SystemStatusAdapter] setupPowerStatusListener 失败:', error)
    }
  }

  /**
   * 清理电源状态监听
   */
  private teardownPowerStatusListener(): void {
    try {
      if (this.powerStatusSubscription) {
        this.powerStatusSubscription.remove()
        this.powerStatusSubscription = null
      }

      SystemStatusTurboModule.stopPowerStatusListener()
    } catch (error) {
      console.error('[SystemStatusAdapter] teardownPowerStatusListener 失败:', error)
    }
  }
}

// 导出单例
export const systemStatusAdapter = new SystemStatusAdapter()
