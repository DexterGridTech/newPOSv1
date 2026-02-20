package com.impos2.turbomodules.scripts

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * ScriptEngine 管理器（单例模式）
 *
 * 设计目的:
 * 在多屏、多 JS 环境场景下，统一管理脚本执行的统计信息和日志
 *
 * 职责:
 * 1. 记录脚本执行日志
 * 2. 统计脚本执行次数、成功率、平均执行时间
 * 3. 提供脚本执行历史查询
 */
class ScriptEngineManager private constructor(
    private val context: Context
) {

    companion object {
        private const val TAG = "ScriptEngineManager"
        private const val MAX_LOG_SIZE = 100 // 最多保留 100 条日志

        @Volatile
        private var instance: ScriptEngineManager? = null

        /**
         * 获取单例实例
         */
        fun getInstance(context: Context): ScriptEngineManager {
            return instance ?: synchronized(this) {
                instance ?: ScriptEngineManager(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    // 执行统计
    private val totalExecutions = AtomicInteger(0)
    private val successfulExecutions = AtomicInteger(0)
    private val failedExecutions = AtomicInteger(0)
    private var totalExecutionTime = 0L
    private val executionLogs = ConcurrentHashMap<Long, ExecutionLog>()

    /**
     * 执行日志数据类
     */
    data class ExecutionLog(
        val timestamp: Long,
        val script: String,
        val executionTime: Int,
        val success: Boolean,
        val error: String?
    )

    /**
     * 记录脚本执行日志
     */
    @Synchronized
    fun logExecution(script: String, executionTime: Int, success: Boolean, error: String?) {
        try {
            val timestamp = System.currentTimeMillis()

            // 更新统计
            totalExecutions.incrementAndGet()
            if (success) {
                successfulExecutions.incrementAndGet()
            } else {
                failedExecutions.incrementAndGet()
            }
            totalExecutionTime += executionTime

            // 保存日志
            val log = ExecutionLog(timestamp, script, executionTime, success, error)
            executionLogs[timestamp] = log

            // 限制日志数量
            if (executionLogs.size > MAX_LOG_SIZE) {
                val oldestKey = executionLogs.keys.minOrNull()
                oldestKey?.let { executionLogs.remove(it) }
            }

            Log.d(TAG, "Script execution logged: success=$success, time=${executionTime}ms")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log execution", e)
        }
    }

    /**
     * 获取执行统计信息
     */
    fun getExecutionStats(): WritableMap {
        val stats = Arguments.createMap()

        val total = totalExecutions.get()
        val successful = successfulExecutions.get()
        val failed = failedExecutions.get()

        stats.putInt("totalExecutions", total)
        stats.putInt("successfulExecutions", successful)
        stats.putInt("failedExecutions", failed)
        stats.putDouble("successRate", if (total > 0) (successful * 100.0 / total) else 0.0)
        stats.putDouble("averageExecutionTime", if (total > 0) (totalExecutionTime.toDouble() / total) else 0.0)
        stats.putInt("logCount", executionLogs.size)

        return stats
    }

    /**
     * 清除执行统计信息
     */
    @Synchronized
    fun clearExecutionStats() {
        totalExecutions.set(0)
        successfulExecutions.set(0)
        failedExecutions.set(0)
        totalExecutionTime = 0L
        executionLogs.clear()
        Log.d(TAG, "Execution stats cleared")
    }

    /**
     * 获取最近的执行日志
     */
    fun getRecentLogs(limit: Int = 10): List<ExecutionLog> {
        return executionLogs.values
            .sortedByDescending { it.timestamp }
            .take(limit)
    }
}
