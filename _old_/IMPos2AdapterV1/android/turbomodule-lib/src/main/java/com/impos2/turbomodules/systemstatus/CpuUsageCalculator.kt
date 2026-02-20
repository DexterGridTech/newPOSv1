package com.impos2.turbomodules.systemstatus

import android.os.Debug
import android.os.SystemClock
import java.io.File

/**
 * CPU 使用率计算器
 *
 * 优化点:
 * 1. 线程安全的采样机制
 * 2. 支持系统整体和应用 CPU 使用率
 * 3. 自动处理首次采样
 */
class CpuUsageCalculator {

    data class CpuUsage(
        val overall: Double,  // 系统整体 CPU 使用率 (0-100)
        val app: Double,      // 应用 CPU 使用率 (0-100)
        val cores: Int        // CPU 核心数
    )

    private data class SystemCpuInfo(
        val totalTime: Long,
        val idleTime: Long
    )

    private var lastAppCpuTime: Long = 0
    private var lastSystemTime: Long = 0
    private var lastSystemCpuTime: Long = 0
    private var lastSystemIdleTime: Long = 0
    private var lastSampleTime: Long = 0

    private val cores = Runtime.getRuntime().availableProcessors()

    /**
     * 获取 CPU 使用率
     * 注意: 第一次调用返回 0，需要两次采样才能计算使用率
     */
    @Synchronized
    fun getCpuUsage(): CpuUsage {
        val currentTime = System.currentTimeMillis()

        // 获取应用 CPU 时间（纳秒）
        val currentAppCpuTime = Debug.threadCpuTimeNanos()

        // 获取系统运行时间（纳秒）
        val currentSystemTime = SystemClock.elapsedRealtimeNanos()

        // 读取系统 CPU 信息
        val systemCpuInfo = readSystemCpuInfo()

        // 第一次采样，保存数据并返回 0
        if (lastSampleTime == 0L) {
            lastAppCpuTime = currentAppCpuTime
            lastSystemTime = currentSystemTime
            lastSystemCpuTime = systemCpuInfo.totalTime
            lastSystemIdleTime = systemCpuInfo.idleTime
            lastSampleTime = currentTime
            return CpuUsage(0.0, 0.0, cores)
        }

        // 计算应用 CPU 使用率
        val appCpuTimeDelta = currentAppCpuTime - lastAppCpuTime
        val systemTimeDelta = currentSystemTime - lastSystemTime
        val appUsage = if (systemTimeDelta > 0) {
            (appCpuTimeDelta.toDouble() / systemTimeDelta.toDouble()) * 100.0
        } else {
            0.0
        }

        // 计算系统整体 CPU 使用率
        val systemCpuTimeDelta = systemCpuInfo.totalTime - lastSystemCpuTime
        val systemIdleTimeDelta = systemCpuInfo.idleTime - lastSystemIdleTime
        val systemBusyTime = systemCpuTimeDelta - systemIdleTimeDelta
        val overallUsage = if (systemCpuTimeDelta > 0) {
            (systemBusyTime.toDouble() / systemCpuTimeDelta.toDouble()) * 100.0
        } else {
            0.0
        }

        // 更新上次采样数据
        lastAppCpuTime = currentAppCpuTime
        lastSystemTime = currentSystemTime
        lastSystemCpuTime = systemCpuInfo.totalTime
        lastSystemIdleTime = systemCpuInfo.idleTime
        lastSampleTime = currentTime

        // 限制在 0-100 范围内
        return CpuUsage(
            overall = overallUsage.coerceIn(0.0, 100.0),
            app = appUsage.coerceIn(0.0, 100.0),
            cores = cores
        )
    }

    /**
     * 读取系统 CPU 信息（从 /proc/stat）
     */
    private fun readSystemCpuInfo(): SystemCpuInfo {
        return try {
            val statFile = File("/proc/stat")
            if (!statFile.exists()) {
                return SystemCpuInfo(0, 0)
            }

            val firstLine = statFile.readLines().firstOrNull() ?: return SystemCpuInfo(0, 0)

            // 格式: cpu user nice system idle iowait irq softirq ...
            val parts = firstLine.split("\\s+".toRegex())
            if (parts.size < 5 || parts[0] != "cpu") {
                return SystemCpuInfo(0, 0)
            }

            val user = parts[1].toLongOrNull() ?: 0
            val nice = parts[2].toLongOrNull() ?: 0
            val system = parts[3].toLongOrNull() ?: 0
            val idle = parts[4].toLongOrNull() ?: 0
            val iowait = parts.getOrNull(5)?.toLongOrNull() ?: 0
            val irq = parts.getOrNull(6)?.toLongOrNull() ?: 0
            val softirq = parts.getOrNull(7)?.toLongOrNull() ?: 0

            val totalTime = user + nice + system + idle + iowait + irq + softirq

            SystemCpuInfo(totalTime, idle)
        } catch (e: Exception) {
            SystemCpuInfo(0, 0)
        }
    }
}
