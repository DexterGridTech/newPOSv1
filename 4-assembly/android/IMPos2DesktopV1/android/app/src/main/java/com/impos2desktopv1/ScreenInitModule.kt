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
     * @param screenType 屏幕类型（primary 或 secondary）
     * @param props 初始化属性
     */
    @ReactMethod
    fun notifyScreenInitialized(screenType: String, props: ReadableMap) {
        Log.d(TAG, "收到屏幕初始化通知 - screenType: $screenType")
        
        // 将 ReadableMap 转换为 Map
        val propsMap = props.toHashMap()
        
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
