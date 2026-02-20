import { NativeModules } from 'react-native'
import type { ILoggerAdapter, LogFile } from '@impos2/kernel-base'

const { LoggerTurboModule } = NativeModules

if (!LoggerTurboModule) {
  throw new Error('LoggerTurboModule not found. Please check native module registration.')
}

/**
 * Logger 适配器实现
 *
 * 优化点:
 * 1. 统一的错误处理
 * 2. 类型安全的接口封装
 * 3. 支持多 ReactInstanceManager 场景
 */
export class LoggerAdapter implements ILoggerAdapter {
  /**
   * 写入 DEBUG 级别日志
   */
  debug(tag: string, message: string, data?: any): void {
    try {
      const fullMessage = this.buildMessage(message, data)
      this.validateParams(tag, fullMessage)
      LoggerTurboModule.debug(tag, fullMessage)
    } catch (error) {
      console.error('[LoggerAdapter] debug 失败:', error)
    }
  }

  /**
   * 写入 INFO 级别日志
   */
  log(tag: string, message: string, data?: any): void {
    try {
      const fullMessage = this.buildMessage(message, data)
      this.validateParams(tag, fullMessage)
      LoggerTurboModule.log(tag, fullMessage)
    } catch (error) {
      console.error('[LoggerAdapter] log 失败:', error)
    }
  }

  /**
   * 写入 WARN 级别日志
   */
  warn(tag: string, message: string, data?: any): void {
    try {
      const fullMessage = this.buildMessage(message, data)
      this.validateParams(tag, fullMessage)
      LoggerTurboModule.warn(tag, fullMessage)
    } catch (error) {
      console.error('[LoggerAdapter] warn 失败:', error)
    }
  }

  /**
   * 写入 ERROR 级别日志
   */
  error(tag: string, message: string, error?: any): void {
    try {
      const fullMessage = this.buildMessage(message, error)
      this.validateParams(tag, fullMessage)
      LoggerTurboModule.error(tag, fullMessage)
    } catch (error) {
      console.error('[LoggerAdapter] error 失败:', error)
    }
  }

  /**
   * 获取所有日志文件列表
   */
  async getLogFiles(): Promise<LogFile[]> {
    try {
      const files = await LoggerTurboModule.getLogFiles()
      return files as LogFile[]
    } catch (error) {
      console.error('[LoggerAdapter] getLogFiles 失败:', error)
      throw error
    }
  }

  /**
   * 读取指定日志文件内容
   */
  async getLogContent(fileName: string): Promise<string> {
    try {
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('fileName 必须是非空字符串')
      }
      const content = await LoggerTurboModule.getLogContent(fileName)
      return content
    } catch (error) {
      console.error('[LoggerAdapter] getLogContent 失败:', error)
      throw error
    }
  }

  /**
   * 删除指定日志文件
   */
  async deleteLogFile(fileName: string): Promise<boolean> {
    try {
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('fileName 必须是非空字符串')
      }
      const success = await LoggerTurboModule.deleteLogFile(fileName)
      return success
    } catch (error) {
      console.error('[LoggerAdapter] deleteLogFile 失败:', error)
      throw error
    }
  }

  /**
   * 清空所有日志文件
   */
  async clearAllLogs(): Promise<boolean> {
    try {
      const success = await LoggerTurboModule.clearAllLogs()
      return success
    } catch (error) {
      console.error('[LoggerAdapter] clearAllLogs 失败:', error)
      throw error
    }
  }

  /**
   * 获取日志目录路径
   */
  async getLogDirPath(): Promise<string> {
    try {
      const path = await LoggerTurboModule.getLogDirPath()
      return path
    } catch (error) {
      console.error('[LoggerAdapter] getLogDirPath 失败:', error)
      throw error
    }
  }

  /**
   * 构建完整的日志消息
   */
  private buildMessage(message: string, data?: any): string {
    if (data === undefined || data === null) {
      return message
    }

    // 如果 data 是 Error 对象，提取堆栈信息
    if (data instanceof Error) {
      return `${message}\n${data.stack || data.message}`
    }

    // 如果 data 是对象，序列化为 JSON
    if (typeof data === 'object') {
      try {
        return `${message}\n${JSON.stringify(data, null, 2)}`
      } catch (e) {
        return `${message}\n[无法序列化的对象]`
      }
    }

    // 其他类型直接转为字符串
    return `${message}\n${String(data)}`
  }

  /**
   * 参数验证
   */
  private validateParams(tag: string, message: string): void {
    if (!tag || typeof tag !== 'string') {
      throw new Error('tag 必须是非空字符串')
    }
    if (typeof message !== 'string') {
      throw new Error('message 必须是字符串')
    }
  }
}

// 导出单例
export const loggerAdapter = new LoggerAdapter()
