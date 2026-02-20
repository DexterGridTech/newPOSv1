package com.impos2desktopv1.screen

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.impos2desktopv1.MainActivity

/**
 * 屏幕控制 TurboModule
 *
 * 提供 JS 层调用的接口：
 * 1. 启用/禁用全屏模式
 * 2. 启动/停止锁定任务模式
 * 3. 获取屏幕控制状态
 */
class ScreenControlTurboModule(reactContext: ReactApplicationContext) :
    com.facebook.react.bridge.ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ScreenControlTurboModule"
        const val NAME = "ScreenControlTurboModule"
    }

    override fun getName(): String = NAME

    /**
     * 启用全屏模式
     */
    @ReactMethod
    fun enableFullscreen(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            activity.runOnUiThread {
                try {
                    activity.getScreenControlManager()?.enableFullscreen()
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "启用全屏模式失败", e)
                    promise.reject("ERROR", e.message)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "enableFullscreen 失败", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 禁用全屏模式
     */
    @ReactMethod
    fun disableFullscreen(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            activity.runOnUiThread {
                try {
                    activity.getScreenControlManager()?.disableFullscreen()
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "禁用全屏模式失败", e)
                    promise.reject("ERROR", e.message)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "disableFullscreen 失败", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 启动锁定任务模式
     */
    @ReactMethod
    fun startLockTask(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            activity.runOnUiThread {
                try {
                    activity.getScreenControlManager()?.startLockTask()
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "启动锁定任务模式失败", e)
                    promise.reject("ERROR", e.message)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "startLockTask 失败", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 停止锁定任务模式
     */
    @ReactMethod
    fun stopLockTask(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            activity.runOnUiThread {
                try {
                    activity.getScreenControlManager()?.stopLockTask()
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "停止锁定任务模式失败", e)
                    promise.reject("ERROR", e.message)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "stopLockTask 失败", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 获取全屏状态
     */
    @ReactMethod
    fun isFullscreen(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            val isFullscreen = activity.getScreenControlManager()?.isFullscreen() ?: false
            promise.resolve(isFullscreen)
        } catch (e: Exception) {
            Log.e(TAG, "isFullscreen 失败", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * 获取锁定任务模式状态
     */
    @ReactMethod
    fun isInLockTaskMode(promise: Promise) {
        try {
            val activity = currentActivity as? MainActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            val isInLockTask = activity.getScreenControlManager()?.isInLockTaskMode() ?: false
            promise.resolve(isInLockTask)
        } catch (e: Exception) {
            Log.e(TAG, "isInLockTaskMode 失败", e)
            promise.reject("ERROR", e.message)
        }
    }
}
