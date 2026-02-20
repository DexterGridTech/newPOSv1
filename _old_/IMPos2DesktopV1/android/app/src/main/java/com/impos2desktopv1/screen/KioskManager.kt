package com.impos2desktopv1.screen

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.util.Log

/**
 * 锁定任务模式管理器（Kiosk Mode）
 *
 * 功能：
 * 1. 启动/停止锁定任务模式
 * 2. 检测锁定任务模式状态
 * 3. 防止用户切换应用
 *
 * 注意：
 * - 需要在 AndroidManifest.xml 中配置 android:lockTaskMode="if_whitelisted"
 * - 需要设备管理员权限或系统应用权限
 * - 适用于企业级 POS 设备
 */
class KioskManager(private val activity: Activity) {

    companion object {
        private const val TAG = "KioskManager"
    }

    private var isLockTaskEnabled = false

    /**
     * 启动锁定任务模式
     */
    fun startLockTask() {
        if (isLockTaskEnabled) {
            Log.d(TAG, "锁定任务模式已启用，跳过")
            return
        }

        try {
            activity.startLockTask()
            isLockTaskEnabled = true
            Log.d(TAG, "✅ 锁定任务模式已启动")
        } catch (e: SecurityException) {
            Log.e(TAG, "启动锁定任务模式失败：缺少权限", e)
        } catch (e: Exception) {
            Log.e(TAG, "启动锁定任务模式失败", e)
        }
    }

    /**
     * 停止锁定任务模式
     */
    fun stopLockTask() {
        if (!isLockTaskEnabled) {
            Log.d(TAG, "锁定任务模式未启用，跳过")
            return
        }

        try {
            activity.stopLockTask()
            isLockTaskEnabled = false
            Log.d(TAG, "✅ 锁定任务模式已停止")
        } catch (e: Exception) {
            Log.e(TAG, "停止锁定任务模式失败", e)
        }
    }

    /**
     * 检测是否处于锁定任务模式
     */
    fun isInLockTaskMode(): Boolean {
        val activityManager = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            activityManager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        } else {
            @Suppress("DEPRECATION")
            activityManager.isInLockTaskMode
        }
    }

    /**
     * 获取锁定任务模式状态
     */
    fun getLockTaskModeState(): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val activityManager = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            return activityManager.lockTaskModeState
        }
        return ActivityManager.LOCK_TASK_MODE_NONE
    }

    /**
     * 清理资源
     */
    fun destroy() {
        if (isLockTaskEnabled) {
            stopLockTask()
        }
    }
}
