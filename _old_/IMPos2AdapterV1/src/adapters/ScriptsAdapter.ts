/**
 * ScriptsAdapter - 脚本执行适配器
 *
 * 使用 JavaScript Function 构造函数实现动态脚本执行能力
 * 在 Hermes 引擎下可正常工作
 *
 * 优化点:
 * 1. 使用 Function 构造函数执行脚本，支持 ES5 语法
 * 2. 提供参数传递、全局变量、原生函数注册能力
 * 3. 支持超时控制和错误处理
 * 4. 记录执行统计信息
 */

import { NativeModules } from 'react-native'
import type {
  IScriptsAdapter,
  ScriptExecutionOptions,
  ScriptExecutionError,
} from '@impos2/kernel-base'

const { ScriptsTurboModule } = NativeModules

class ScriptsAdapterImpl implements IScriptsAdapter {
  constructor() {
    console.log('[ScriptsAdapter] Initialized')
  }

  /**
   * 执行脚本
   */
  async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
    const startTime = Date.now()
    const { script, params = {}, globals = {}, nativeFunctions = {}, timeout = 5000 } = options

    try {
      // 验证参数
      await ScriptsTurboModule.validateScriptOptions({
        script,
        timeout,
      })

      // 执行脚本
      const result = await this.executeWithTimeout<T>(
        script,
        params,
        globals,
        nativeFunctions,
        timeout
      )

      const executionTime = Date.now() - startTime

      // 记录执行日志
      ScriptsTurboModule.logScriptExecution(script, executionTime, true, null)

      console.log(`[ScriptsAdapter] Script executed successfully in ${executionTime}ms`)
      return result
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      const errorMessage = error.message || String(error)

      // 记录执行日志
      ScriptsTurboModule.logScriptExecution(script, executionTime, false, errorMessage)

      console.error(`[ScriptsAdapter] Script execution failed after ${executionTime}ms:`, error)

      // 抛出自定义错误
      const scriptError = new Error(
        `Script execution failed: ${errorMessage}`
      ) as ScriptExecutionError
      scriptError.name = 'ScriptExecutionError'
      ;(scriptError as any).script = script
      ;(scriptError as any).originalError = error

      throw scriptError
    }
  }

  /**
   * 执行脚本并支持超时控制
   */
  private async executeWithTimeout<T>(
    script: string,
    params: Record<string, any>,
    globals: Record<string, any>,
    nativeFunctions: Record<string, (...args: any[]) => any>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Script execution timeout after ${timeout}ms`))
      }, timeout)

      this.executeInQuickJS<T>(script, params, globals, nativeFunctions)
        .then((result) => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * 在 JavaScript 中执行脚本
   * 使用 Function 构造函数，在 Hermes 引擎下可正常工作
   */
  private async executeInQuickJS<T>(
    script: string,
    params: Record<string, any>,
    globals: Record<string, any>,
    nativeFunctions: Record<string, (...args: any[]) => any>
  ): Promise<T> {
    try {
      // 构建函数参数名和值
      const paramNames = ['params', ...Object.keys(globals), ...Object.keys(nativeFunctions)]
      const paramValues = [params, ...Object.values(globals), ...Object.values(nativeFunctions)]

      // 使用 Function 构造函数创建脚本函数
      const scriptFunction = new Function(...paramNames, script)

      // 执行脚本
      const result = scriptFunction(...paramValues)

      return result as T
    } catch (error) {
      throw error
    }
  }

  /**
   * 获取执行统计信息
   */
  async getExecutionStats() {
    try {
      return await ScriptsTurboModule.getExecutionStats()
    } catch (error) {
      console.error('[ScriptsAdapter] Failed to get execution stats:', error)
      throw error
    }
  }

  /**
   * 清除执行统计信息
   */
  async clearExecutionStats() {
    try {
      return await ScriptsTurboModule.clearExecutionStats()
    } catch (error) {
      console.error('[ScriptsAdapter] Failed to clear execution stats:', error)
      throw error
    }
  }

  /**
   * 清理资源
   */
  destroy() {
    console.log('[ScriptsAdapter] Destroyed')
  }
}

// 导出单例
export const scriptsAdapter = new ScriptsAdapterImpl()
