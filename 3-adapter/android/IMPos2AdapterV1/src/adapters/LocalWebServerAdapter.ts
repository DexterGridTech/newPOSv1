import { NativeModules } from 'react-native'
import type {
  ILocalWebServerAdapter,
  LocalWebServerConfig,
  LocalWebServerInfo,
  ServerStats,
  ServerAddress,
} from '@impos2/kernel-base'

const { LocalWebServerTurboModule } = NativeModules

if (!LocalWebServerTurboModule) {
  throw new Error('LocalWebServerTurboModule not found. Please check native module registration.')
}

/**
 * LocalWebServer 适配器实现
 *
 * 优化点:
 * 1. 统一的错误处理
 * 2. 类型安全的接口封装
 * 3. 支持多 ReactInstanceManager 场景
 * 4. 基于 Ktor 的完整 WebSocket 支持
 * 5. 严格遵循 ILocalWebServerAdapter 接口定义
 */
export class LocalWebServerAdapter implements ILocalWebServerAdapter {
  /**
   * 启动 LocalWebServer
   * @param config 服务器配置（可选）
   * @returns Promise<ServerAddress[]> 服务器地址列表
   */
  async startLocalWebServer(config?: Partial<LocalWebServerConfig>): Promise<ServerAddress[]> {
    try {
      // 合并默认配置
      const fullConfig = {
        port: config?.port ?? 8888,
        basePath: config?.basePath ?? '/localServer',
        heartbeatInterval: config?.heartbeatInterval ?? 30000,
        heartbeatTimeout: config?.heartbeatTimeout ?? 60000,
      }

      const result = await LocalWebServerTurboModule.startLocalWebServer(fullConfig)

      // 返回地址列表
      return result.addresses || []
    } catch (error) {
      console.error('[LocalWebServerAdapter] startLocalWebServer 失败:', error)
      throw error
    }
  }

  /**
   * 停止 LocalWebServer
   * @returns Promise<void>
   */
  async stopLocalWebServer(): Promise<void> {
    try {
      await LocalWebServerTurboModule.stopLocalWebServer()
    } catch (error) {
      console.error('[LocalWebServerAdapter] stopLocalWebServer 失败:', error)
      throw error
    }
  }

  /**
   * 获取 LocalWebServer 状态
   * @returns Promise<LocalWebServerInfo> 服务器状态信息
   */
  async getLocalWebServerStatus(): Promise<LocalWebServerInfo> {
    try {
      const result = await LocalWebServerTurboModule.getLocalWebServerStatus()
      return result as LocalWebServerInfo
    } catch (error) {
      console.error('[LocalWebServerAdapter] getLocalWebServerStatus 失败:', error)
      throw error
    }
  }

  /**
   * 获取 LocalWebServer 统计信息
   * @returns Promise<ServerStats> 服务器统计信息
   */
  async getLocalWebServerStats(): Promise<ServerStats> {
    try {
      const result = await LocalWebServerTurboModule.getLocalWebServerStats()
      return result as ServerStats
    } catch (error) {
      console.error('[LocalWebServerAdapter] getLocalWebServerStats 失败:', error)
      throw error
    }
  }
}

// 导出单例
export const localWebServerAdapter = new LocalWebServerAdapter()
