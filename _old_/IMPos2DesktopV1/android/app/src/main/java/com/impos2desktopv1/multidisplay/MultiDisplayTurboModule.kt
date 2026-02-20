package com.impos2desktopv1.multidisplay

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.impos2desktopv1.MainActivity

/**
 * 多屏显示TurboModule
 * 暴露restartApplication方法给JS层调用
 */
class MultiDisplayTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MultiDisplayTurboModule"
        private const val TAG = "MultiDisplayTurboModule"
    }

    override fun getName(): String {
        return NAME
    }

    /**
     * 重启应用（主屏+副屏）
     * 通过中间页避免退回桌面
     */
    @ReactMethod
    fun restartApplication(promise: Promise) {
        try {
            Log.d(TAG, "JS层调用restartApplication（重启主屏+副屏）")

            val activity = currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "当前Activity不存在")
                return
            }

            if (activity !is MainActivity) {
                promise.reject("INVALID_ACTIVITY", "当前Activity不是MainActivity")
                return
            }

            val multiDisplayManager = activity.getMultiDisplayManager()
            if (multiDisplayManager == null) {
                promise.reject("NO_MANAGER", "MultiDisplayManager未初始化")
                return
            }

            // 调用重启方法（重启主屏+副屏，通过中间页）
            val result = multiDisplayManager.restartApplication {
                // 跳转到中间页并重启主屏
                activity.reloadReactApplication()
            }

            if (result.success) {
                promise.resolve(true)
                Log.d(TAG, "restartApplication调用成功")
            } else {
                promise.reject(
                    result.errorCode ?: "RESTART_ERROR",
                    result.errorMessage ?: "重启应用失败"
                )
                Log.e(TAG, "restartApplication失败: ${result.errorMessage}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "restartApplication失败", e)
            promise.reject("RESTART_ERROR", "重启应用失败: ${e.message}", e)
        }
    }
}
