package com.impos2desktopv1.screen

import android.app.Activity
import android.util.Log
import android.view.KeyEvent

/**
 * 屏幕控制管理器（统一入口）
 *
 * 功能：
 * 1. 统一管理 ScreenManager、KioskManager、KeyInterceptor
 * 2. 提供简洁的 API 给 MainActivity 调用
 * 3. 自动加载配置并初始化
 */
class ScreenControlManager(
    private val activity: Activity,
    private val config: ScreenControlConfig
) {
    companion object {
        private const val TAG = "ScreenControlManager"
    }

    private val screenManager: ScreenManager = ScreenManager(activity, config)
    private val kioskManager: KioskManager = KioskManager(activity)
    private val keyInterceptor: KeyInterceptor = KeyInterceptor(config)

    /**
     * 初始化屏幕控制
     */
    fun initialize() {
        Log.d(TAG, "初始化屏幕控制...")

        // 启用全屏模式
        if (config.fullscreenEnabled) {
            screenManager.enableFullscreen()
        }

        // 启动锁定任务模式
        if (config.lockTaskEnabled) {
            kioskManager.startLockTask()
        }

        Log.d(TAG, "✅ 屏幕控制初始化完成")
    }

    /**
     * 启用全屏模式
     * @param force 是否强制重新应用（用于 onResume/onWindowFocusChanged）
     */
    fun enableFullscreen(force: Boolean = false) {
        screenManager.enableFullscreen(force)
    }

    /**
     * 禁用全屏模式
     */
    fun disableFullscreen() {
        screenManager.disableFullscreen()
    }

    /**
     * 启动锁定任务模式
     */
    fun startLockTask() {
        kioskManager.startLockTask()
    }

    /**
     * 停止锁定任务模式
     */
    fun stopLockTask() {
        kioskManager.stopLockTask()
    }

    /**
     * 拦截按键事件
     */
    fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        return keyInterceptor.onKeyDown(keyCode, event)
    }

    /**
     * 获取全屏状态
     */
    fun isFullscreen(): Boolean {
        return screenManager.isFullscreen()
    }

    /**
     * 获取锁定任务模式状态
     */
    fun isInLockTaskMode(): Boolean {
        return kioskManager.isInLockTaskMode()
    }

    /**
     * 清理资源
     */
    fun destroy() {
        screenManager.destroy()
        kioskManager.destroy()
    }
}
