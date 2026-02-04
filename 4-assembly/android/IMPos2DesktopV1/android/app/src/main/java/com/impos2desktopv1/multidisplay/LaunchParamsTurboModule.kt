package com.impos2desktopv1.multidisplay

import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * 启动参数TurboModule
 * 用于获取MainActivity传递的启动参数
 */
class LaunchParamsTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "LaunchParamsTurboModule"
        private var launchParams: Bundle? = null

        fun setLaunchParams(params: Bundle?) {
            launchParams = params
        }
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun getLaunchParams(promise: Promise) {
        try {
            val params = launchParams
            if (params != null) {
                val map: WritableMap = Arguments.createMap()
                map.putString("screenType", params.getString("screenType", "unknown"))
                map.putInt("displayId", params.getInt("displayId", 0))
                map.putString("displayName", params.getString("displayName", "Unknown Display"))
                promise.resolve(map)
            } else {
                val map: WritableMap = Arguments.createMap()
                map.putString("screenType", "unknown")
                map.putInt("displayId", 0)
                map.putString("displayName", "Unknown Display")
                promise.resolve(map)
            }
        } catch (e: Exception) {
            promise.reject("GET_PARAMS_ERROR", "获取启动参数失败: ${e.message}", e)
        }
    }
}
