package com.impos2desktopv1

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import android.util.Log

/**
 * 屏幕初始化 TurboModule
 * 
 * 职责：
 * 1. 接收 React 层的屏幕初始化完成通知
 * 2. 将通知转发给 ScreenInitManager
 */
class ScreenInitModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "ScreenInitModule"
        const val NAME = "ScreenInitModule"
    }
    
    override fun getName(): String = NAME
    
    /**
     * React 层调用此方法通知屏幕初始化完成
     * @param props 初始化属性（包含 screenType 字段）
     */
    @ReactMethod
    fun notifyScreenInitialized(props: ReadableMap) {
        // 将 ReadableMap 转换为 Map
        val propsMap = props.toHashMap()

        // 从 props 中提取 screenType
        val screenType = propsMap["screenType"] as? String

        if (screenType == null) {
            Log.e(TAG, "props 中缺少 screenType 字段")
            return
        }

        Log.d(TAG, "收到屏幕初始化通知 - screenType: $screenType")

        when (screenType) {
            "primary" -> {
                ScreenInitManager.notifyPrimaryScreenInitialized(propsMap)
            }
            "secondary" -> {
                ScreenInitManager.notifySecondaryScreenInitialized(propsMap)
            }
            else -> {
                Log.w(TAG, "未知的屏幕类型: $screenType")
            }
        }
    }
}
